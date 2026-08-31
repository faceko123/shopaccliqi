const express = require("express");

const db = require("../utils/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const MAX_TOPUP_AMOUNT = 50000000; // giới hạn 1 lần nạp, tránh nhập nhầm số quá lớn

// GET /api/wallet/me - lấy số dư hiện tại
router.get("/me", requireAuth, (req, res) => {
  const users = db.getUsers();
  const user = users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng." });
  res.json({ balance: user.balance || 0 });
});

// POST /api/wallet/topup - nạp tiền vào ví
// LƯU Ý: đây là ví DEMO, cộng thẳng số dư mà KHÔNG qua cổng thanh toán thật.
// Khi triển khai thật, thay logic này bằng tích hợp cổng thanh toán (VNPay, Momo, Stripe...)
// và chỉ cộng tiền sau khi cổng thanh toán xác nhận giao dịch thành công (qua webhook).
router.post("/topup", requireAuth, async (req, res) => {
  const { amount } = req.body;
  const amountNum = Number(amount);

  if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: "Số tiền nạp không hợp lệ." });
  }
  if (amountNum > MAX_TOPUP_AMOUNT) {
    return res.status(400).json({ error: `Số tiền nạp vượt quá giới hạn (${MAX_TOPUP_AMOUNT.toLocaleString("vi-VN")}đ).` });
  }

  const users = db.getUsers();
  const index = users.findIndex((u) => u.id === req.user.sub);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  const newBalance = (users[index].balance || 0) + amountNum;
  users[index] = { ...users[index], balance: newBalance };
  await db.saveUsers(users);

  res.json({ balance: newBalance });
});

module.exports = router;

// POST /api/wallet/webhook - Tiếp nhận dữ liệu chuyển khoản tự động từ SePay
router.post("/webhook", async (req, res) => {
  try {
    // 1. Xác thực Secret Key từ SePay gửi qua Header
    const secretKey = req.headers["x-sepay-secret-key"] || req.headers["authorization"];
    if (secretKey !== process.env.SEPAY_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized webhook" });
    }

    const { content, transferType, transferAmount, referenceCode } = req.body;

    // Chỉ xử lý các giao dịch tiền vào (transferType = "in")
    if (transferType !== "in" || !transferAmount || transferAmount <= 0) {
      return res.status(200).json({ success: true, message: "Ignored non-credit transaction" });
    }

    // 2. Trích xuất username từ Nội dung chuyển khoản (Ví dụ cú pháp: NAP USER123)
    const match = content.match(/NAP\s+([A-Za-z0-9_]+)/i);
    if (!match) {
      return res.status(200).json({ success: true, message: "No valid user pattern found in content" });
    }

    const username = match[1].trim().toLowerCase();

    // 3. Tìm người dùng & Cộng số dư
    const users = db.getUsers();
    const userIndex = users.findIndex((u) => u.username.toLowerCase() === username);

    if (userIndex === -1) {
      console.warn(`⚠️ Nhận tiền thành công nhưng không tìm thấy user: ${username}`);
      return res.status(200).json({ success: true, message: "User not found" });
    }

    const buyer = users[userIndex];
    const newBalance = (buyer.balance || 0) + Number(transferAmount);

    users[userIndex] = {
      ...buyer,
      balance: newBalance,
      updatedAt: new Date().toISOString()
    };

    await db.saveUsers(users);

    console.log(`✅ [TỰ ĐỘNG NẠP] User "${buyer.username}" +${transferAmount.toLocaleString()}đ (Mã GD: ${referenceCode})`);
    return res.status(200).json({ success: true, newBalance });

  } catch (err) {
    console.error("❌ Lỗi Webhook:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});