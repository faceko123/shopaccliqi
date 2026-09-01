const express = require("express");
const db = require("../utils/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// =========================================================================
// 1. WEBHOOK SEPAY (Xử lý tự động nạp tiền từ ngân hàng)
// POST /api/wallet/webhook
// LƯU Ý: Phải đặt TRƯỚC các middleware requireAuth để SePay truy cập công khai
// =========================================================================
router.post("/webhook", async (req, res) => {
  try {
    // 1. Xác thực Secret Key bắt buộc. SePay gửi dạng: Authorization: Apikey <secret>.
    const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
    const authorization = req.headers["authorization"];
    const incomingSecret = req.headers["x-sepay-secret-key"] ||
      (typeof authorization === "string" ? authorization.replace(/^apikey\s+/i, "").trim() : "");

    if (!webhookSecret || incomingSecret !== webhookSecret) {
      return res.status(401).json({ error: "Unauthorized webhook" });
    }

    const { content, transferType, transferAmount, referenceCode } = req.body;

    // 2. Chỉ xử lý các giao dịch tiền vào hợp lệ
    if (transferType !== "in" || !transferAmount || Number(transferAmount) <= 0) {
      return res.status(200).json({ success: true, message: "Ignored non-credit transaction" });
    }

    // 3. Chống nạp trùng (Idempotency) bằng referenceCode
    if (!referenceCode) {
      return res.status(400).json({ error: "Missing referenceCode" });
    }

    const transactions = await db.getTransactions();
    const isProcessed = transactions.some((t) => t.referenceCode === referenceCode);
    
    if (isProcessed) {
      return res.status(200).json({ success: true, message: "Transaction already processed" });
    }

    // 4. Trích xuất username từ nội dung QR. Ngân hàng/SePay có thể thêm mã giao dịch
    // trước hoặc sau, ví dụ: "...-USER CHUC MUNG SINH NHAT-CHUYEN TIEN-...".
    const match = content
      ? content.match(/(?:^|[^A-Za-z0-9_])([A-Za-z0-9_]+)\s+CHUC\s+MUNG\s+SINH\s+NHAT\b/i)
      : null;
    
    if (!match) {
      return res.status(200).json({ success: true, message: "No valid top-up pattern found in content" });
    }

    const username = match[1].trim().toLowerCase();

    // 5. Tìm người dùng trong database
    const users = await db.getUsers();
    const userIndex = users.findIndex((u) => u.username.toLowerCase() === username);

    if (userIndex === -1) {
      console.warn(`⚠️ Nhận tiền thành công nhưng không tìm thấy user: ${username}`);
      return res.status(200).json({ success: true, message: "User not found" });
    }

    // 6. Cộng số dư tài khoản
    const buyer = users[userIndex];
    const amountNum = Number(transferAmount);
    const newBalance = (buyer.balance || 0) + amountNum;

    users[userIndex] = {
      ...buyer,
      balance: newBalance,
      updatedAt: new Date().toISOString(),
    };

    // 7. Lưu lịch sử giao dịch để chống nạp trùng
    transactions.push({
      referenceCode,
      username: buyer.username,
      amount: amountNum,
      createdAt: new Date().toISOString(),
    });

    await db.saveUsers(users);
    if (db.saveTransactions) await db.saveTransactions(transactions);

    console.log(`✅ [TỰ ĐỘNG SEPAY] User "${buyer.username}" +${amountNum.toLocaleString("vi-VN")}đ (Mã GD: ${referenceCode})`);
    
    return res.status(200).json({ success: true, newBalance });

  } catch (err) {
    console.error("❌ Lỗi Webhook SePay:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =========================================================================
// 2. CÁC ROUTE YÊU CẦU ĐĂNG NHẬP (USER API)
// =========================================================================

// GET /api/wallet/me - Lấy số dư hiện tại
router.get("/me", requireAuth, async (req, res) => {
  const users = await db.getUsers();
  const user = users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng." });
  res.json({ balance: user.balance || 0 });
});

module.exports = router;
