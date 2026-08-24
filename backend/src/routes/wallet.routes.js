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
