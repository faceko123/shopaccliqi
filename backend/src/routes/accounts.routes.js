const express = require("express");
const { v4: uuidv4 } = require("uuid");

const db = require("../utils/db");
const { optionalAuth, requireAuth, requireAdmin } = require("../middleware/auth");
const { decryptCredential, encryptCredential } = require("../utils/credentials-crypto");

const router = express.Router();

// Thông tin đăng nhập game không bao giờ được gửi ra danh sách acc công khai.
function toPublicAccount(account) {
  const { gameUsername, gamePassword, ...publicAccount } = account;
  return publicAccount;
}

function toAdminAccount(account) {
  return {
    ...account,
    gameUsername: decryptCredential(account.gameUsername),
    gamePassword: decryptCredential(account.gamePassword),
  };
}

// Nhận diện cú pháp tìm giá kiểu rút gọn: "1xx" -> 100-199 (nghìn đồng), "2x" -> 20-29 (nghìn đồng)
// Quy tắc: 1 chữ số đứng đầu + một hoặc nhiều chữ "x" phía sau, không phân biệt hoa thường.
function parsePricePattern(query) {
  const match = /^(\d)(x+)$/i.exec(query.trim());
  if (!match) return null;

  const leadingDigit = parseInt(match[1], 10);
  const xCount = match[2].length;
  const rangeSize = Math.pow(10, xCount);

  return {
    minThousand: leadingDigit * rangeSize,
    maxThousand: leadingDigit * rangeSize + rangeSize - 1,
  };
}

// GET /api/accounts?q=&page=1&limit=16&sort=price_asc|price_desc
// Công khai - ai cũng xem được, không cần đăng nhập
// Acc đã bán (sold=true) sẽ bị ẩn khỏi danh sách công khai, chỉ admin mới thấy để đối soát
router.get("/", optionalAuth, async (req, res) => {
  const { q = "", page = "1", limit = "16", sort = "" } = req.query;
  const keyword = q.trim().toLowerCase();
  const pricePattern = parsePricePattern(q);
  const isAdmin = req.user && req.user.role === "admin";

  let list = await db.getAccounts();

  if (!isAdmin) {
    list = list.filter((item) => !item.sold);
  }

  if (pricePattern) {
    // Tìm theo giá dạng rút gọn, ví dụ "1xx" => giá từ 100.000đ đến 199.000đ
    list = list.filter((item) => {
      const priceThousand = Math.floor((item.price || 0) / 1000);
      return priceThousand >= pricePattern.minThousand && priceThousand <= pricePattern.maxThousand;
    });
  } else if (keyword) {
    list = list
      .map((item) => {
        const matchInfo = (item.info || "").toLowerCase().includes(keyword);
        const matchingSkins = (item.skins || []).filter((s) => s.toLowerCase().includes(keyword));
        const nonMatchingSkins = (item.skins || []).filter((s) => !s.toLowerCase().includes(keyword));
        return {
          ...item,
          skins: [...matchingSkins, ...nonMatchingSkins],
          _match: matchInfo || matchingSkins.length > 0,
        };
      })
      .filter((item) => item._match)
      .map(({ _match, ...rest }) => rest);
  }

  if (sort === "price_asc") {
    list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (sort === "price_desc") {
    list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 16);
  const total = list.length;
  const start = (pageNum - 1) * limitNum;
  const items = list.slice(start, start + limitNum).map(toPublicAccount);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  });
});

// GET /api/accounts/:id
router.get("/:id", optionalAuth, async (req, res) => {
  const item = (await db.getAccounts()).find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Không tìm thấy acc." });
  const isAdmin = req.user && req.user.role === "admin";
  res.json({ item: isAdmin ? toAdminAccount(item) : toPublicAccount(item) });
});

// POST /api/accounts - chỉ admin
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { price, image, info, skins, gameUsername, gamePassword, adminNote = "" } = req.body;
  const priceNum = Number(price);

  if (!image || price === undefined || price === "" || Number.isNaN(priceNum) || priceNum < 0) {
    return res.status(400).json({ error: "Vui lòng nhập giá hợp lệ (số, >= 0) và URL hình ảnh." });
  }
  if (!gameUsername?.trim() || !gamePassword?.trim()) {
    return res.status(400).json({ error: "Vui lòng nhập tài khoản và mật khẩu game." });
  }
  if (typeof adminNote !== "string" || adminNote.trim().length > 160) {
    return res.status(400).json({ error: "Tag lưu ý tối đa 160 ký tự." });
  }

  const accounts = await db.getAccounts();
  const newItem = {
    id: uuidv4(),
    price: priceNum,
    image: image.trim(),
    info: (info || "").trim(),
    skins: Array.isArray(skins) ? skins.filter(Boolean) : [],
    adminNote: adminNote.trim(),
    gameUsername: encryptCredential(gameUsername.trim()),
    gamePassword: encryptCredential(gamePassword.trim()),
    sold: false,
    createdAt: new Date().toISOString(),
  };

  accounts.unshift(newItem);
  await db.saveAccounts(accounts);

  res.status(201).json({ item: toAdminAccount(newItem) });
});

// PUT /api/accounts/:id - chỉ admin
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const accounts = await db.getAccounts();
  const index = accounts.findIndex((a) => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy acc." });

  const { price, image, info, skins, gameUsername, gamePassword, adminNote } = req.body;

  let priceValue = accounts[index].price;
  if (price !== undefined && price !== "") {
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: "Giá không hợp lệ." });
    }
    priceValue = priceNum;
  }
  if (gameUsername !== undefined && !gameUsername.trim()) {
    return res.status(400).json({ error: "Tài khoản game không được để trống." });
  }
  if (gamePassword !== undefined && !gamePassword.trim()) {
    return res.status(400).json({ error: "Mật khẩu game không được để trống." });
  }
  if (adminNote !== undefined && (typeof adminNote !== "string" || adminNote.trim().length > 160)) {
    return res.status(400).json({ error: "Tag lưu ý tối đa 160 ký tự." });
  }

  accounts[index] = {
    ...accounts[index],
    price: priceValue,
    image: image !== undefined ? image.trim() : accounts[index].image,
    info: info !== undefined ? info.trim() : accounts[index].info,
    skins: Array.isArray(skins) ? skins.filter(Boolean) : accounts[index].skins,
    adminNote: adminNote !== undefined ? adminNote.trim() : accounts[index].adminNote,
    gameUsername: gameUsername !== undefined ? encryptCredential(gameUsername.trim()) : accounts[index].gameUsername,
    gamePassword: gamePassword !== undefined ? encryptCredential(gamePassword.trim()) : accounts[index].gamePassword,
    updatedAt: new Date().toISOString(),
  };

  await db.saveAccounts(accounts);
  res.json({ item: toAdminAccount(accounts[index]) });
});

// DELETE /api/accounts/:id - chỉ admin
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const accounts = await db.getAccounts();
  const index = accounts.findIndex((a) => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy acc." });

  const [removed] = accounts.splice(index, 1);
  await db.saveAccounts(accounts);
  res.json({ item: removed });
});

// POST /api/accounts/:id/purchase - mua acc, yêu cầu đăng nhập
// Trừ tiền trong ví, đánh dấu acc đã bán, ghi lại lịch sử mua hàng
router.post("/:id/purchase", requireAuth, async (req, res) => {
  const accounts = await db.getAccounts();
  const accIndex = accounts.findIndex((a) => a.id === req.params.id);
  if (accIndex === -1) return res.status(404).json({ error: "Không tìm thấy acc." });

  const account = accounts[accIndex];
  if (account.sold) {
    return res.status(409).json({ error: "Tài khoản này vừa được người khác mua mất, vui lòng chọn acc khác." });
  }

  const users = await db.getUsers();
  const userIndex = users.findIndex((u) => u.id === req.user.sub);
  if (userIndex === -1) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  const buyer = users[userIndex];
  const balance = buyer.balance || 0;

  if (balance < account.price) {
    return res.status(400).json({
      error: `Số dư không đủ. Bạn cần ${account.price.toLocaleString("vi-VN")}đ nhưng ví chỉ có ${balance.toLocaleString("vi-VN")}đ. Vui lòng nạp thêm tiền.`,
      code: "INSUFFICIENT_BALANCE",
    });
  }

  // Trừ tiền trong ví người mua
  const newBalance = balance - account.price;
  users[userIndex] = { ...buyer, balance: newBalance };
  await db.saveUsers(users);

  // Đánh dấu acc đã bán, không cho ai mua lại nữa
  accounts[accIndex] = {
    ...account,
    sold: true,
    soldTo: buyer.id,
    soldAt: new Date().toISOString(),
  };
  await db.saveAccounts(accounts);

  // Ghi lại lịch sử mua hàng (lưu kèm snapshot thông tin acc tại thời điểm mua)
  const purchases = await db.getPurchases();
  const purchaseRecord = {
    id: uuidv4(),
    userId: buyer.id,
    accountId: account.id,
    price: account.price,
    image: account.image,
    info: account.info,
    skins: account.skins,
    adminNote: account.adminNote,
    gameUsername: account.gameUsername,
    gamePassword: account.gamePassword,
    purchasedAt: new Date().toISOString(),
  };
  purchases.unshift(purchaseRecord);
  await db.savePurchases(purchases);

  res.json({
    purchase: {
      ...purchaseRecord,
      gameUsername: decryptCredential(purchaseRecord.gameUsername),
      gamePassword: decryptCredential(purchaseRecord.gamePassword),
    },
    balance: newBalance,
  });
});

module.exports = router;
