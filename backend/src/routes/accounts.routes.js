const express = require("express");
const { v4: uuidv4 } = require("uuid");

const db = require("../utils/db");
const { optionalAuth, requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/accounts?q=&page=1&limit=16&sort=price_asc|price_desc
// Công khai - ai cũng xem được, không cần đăng nhập
router.get("/", optionalAuth, (req, res) => {
  const { q = "", page = "1", limit = "16", sort = "" } = req.query;
  const keyword = q.trim().toLowerCase();

  let list = db.getAccounts();

  if (keyword) {
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
  const items = list.slice(start, start + limitNum);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  });
});

// GET /api/accounts/:id
router.get("/:id", (req, res) => {
  const item = db.getAccounts().find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Không tìm thấy acc." });
  res.json({ item });
});

// POST /api/accounts - chỉ admin
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { price, image, info, skins } = req.body;
  const priceNum = Number(price);

  if (!image || price === undefined || price === "" || Number.isNaN(priceNum) || priceNum < 0) {
    return res.status(400).json({ error: "Vui lòng nhập giá hợp lệ (số, >= 0) và URL hình ảnh." });
  }

  const accounts = db.getAccounts();
  const newItem = {
    id: uuidv4(),
    price: priceNum,
    image: image.trim(),
    info: (info || "").trim(),
    skins: Array.isArray(skins) ? skins.filter(Boolean) : [],
    createdAt: new Date().toISOString(),
  };

  accounts.unshift(newItem);
  await db.saveAccounts(accounts);

  res.status(201).json({ item: newItem });
});

// PUT /api/accounts/:id - chỉ admin
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const accounts = db.getAccounts();
  const index = accounts.findIndex((a) => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy acc." });

  const { price, image, info, skins } = req.body;

  let priceValue = accounts[index].price;
  if (price !== undefined && price !== "") {
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: "Giá không hợp lệ." });
    }
    priceValue = priceNum;
  }

  accounts[index] = {
    ...accounts[index],
    price: priceValue,
    image: image !== undefined ? image.trim() : accounts[index].image,
    info: info !== undefined ? info.trim() : accounts[index].info,
    skins: Array.isArray(skins) ? skins.filter(Boolean) : accounts[index].skins,
    updatedAt: new Date().toISOString(),
  };

  await db.saveAccounts(accounts);
  res.json({ item: accounts[index] });
});

// DELETE /api/accounts/:id - chỉ admin
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const accounts = db.getAccounts();
  const index = accounts.findIndex((a) => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy acc." });

  const [removed] = accounts.splice(index, 1);
  await db.saveAccounts(accounts);
  res.json({ item: removed });
});

module.exports = router;
