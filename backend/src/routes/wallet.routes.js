const express = require("express");
const crypto = require("crypto");
const db = require("../utils/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function secretsMatch(expected, received) {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && crypto.timingSafeEqual(expectedBytes, receivedBytes);
}

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

    if (!webhookSecret || webhookSecret.length < 32) {
      console.error("SEPAY_WEBHOOK_SECRET chưa được cấu hình an toàn (tối thiểu 32 ký tự).");
      return res.status(503).json({ error: "Webhook is not configured" });
    }
    if (!secretsMatch(webhookSecret, incomingSecret)) {
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

    // 4. Chỉ nhận mã nạp do server tạo. Không suy diễn username từ nội dung
    // chuyển khoản, vì phần này do người gửi kiểm soát.
    const match = typeof content === "string" ? content.match(/\b(NAP[A-Z0-9]{10})\b/i) : null;
    
    if (!match) {
      return res.status(200).json({ success: true, message: "No valid recharge code found" });
    }
    const amountNum = Number(transferAmount);
    if (!Number.isSafeInteger(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "Invalid transfer amount" });
    }
    const result = await db.processRecharge({
      code: match[1].toUpperCase(), referenceCode, amount: amountNum, now: new Date().toISOString(),
    });
    if (result.status !== "SUCCESS") {
      // Trả 200 để SePay không gửi lặp vô hạn, nhưng tuyệt đối không cộng tiền.
      return res.status(200).json({ success: true, message: result.status.toLowerCase() });
    }

    console.log(`✅ [TỰ ĐỘNG SEPAY] User "${result.buyer.username}" +${amountNum.toLocaleString("vi-VN")}đ (Mã GD: ${referenceCode})`);
    
    return res.status(200).json({ success: true, newBalance: result.balance });

  } catch (err) {
    console.error("❌ Lỗi Webhook SePay:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =========================================================================
// 2. CÁC ROUTE YÊU CẦU ĐĂNG NHẬP (USER API)
// =========================================================================

// POST /api/wallet/recharges - tạo mã nạp dùng một lần, hết hạn sau 30 phút.
router.post("/recharges", requireAuth, async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isSafeInteger(amount) || amount < 10000) {
    return res.status(400).json({ error: "Số tiền nạp phải là số nguyên, tối thiểu 10.000đ." });
  }
  const now = new Date();
  // randomBytes không dựa vào username và không thể đoán được mã nạp của người khác.
  const code = `NAP${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  const recharge = await db.createRecharge({
    userId: req.user.sub, code, amount, now: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
  });
  if (recharge.status === "USER_NOT_FOUND") return res.status(404).json({ error: "Không tìm thấy người dùng." });
  if (recharge.status === "CODE_COLLISION") return res.status(503).json({ error: "Không thể tạo mã nạp, vui lòng thử lại." });
  return res.status(201).json({ code, amount, expiresAt: recharge.recharge.expiresAt });
});

// GET /api/wallet/me - Lấy số dư hiện tại
router.get("/me", requireAuth, async (req, res) => {
  const users = await db.getUsers();
  const user = users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng." });
  res.json({ balance: user.balance || 0 });
});

// GET /api/wallet/transactions - Lịch sử nạp tiền của người dùng hiện tại
router.get("/transactions", requireAuth, async (req, res) => {
  const users = await db.getUsers();
  const user = users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  const transactions = await db.getTransactions();
  const items = transactions
    .filter((transaction) => transaction.username?.toLowerCase() === user.username.toLowerCase())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ referenceCode, amount, createdAt }) => ({ referenceCode, amount, createdAt }));

  res.json({ items });
});

module.exports = router;
