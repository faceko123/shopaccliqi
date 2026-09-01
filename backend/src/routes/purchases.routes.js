const express = require("express");

const db = require("../utils/db");
const { requireAuth } = require("../middleware/auth");
const { decryptCredential } = require("../utils/credentials-crypto");

const router = express.Router();

// GET /api/purchases/me - lịch sử mua acc của người dùng hiện tại
router.get("/me", requireAuth, async (req, res) => {
  const purchases = (await db
    .getPurchases())
    .filter((p) => p.userId === req.user.sub)
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));

  // Chỉ giải mã sau khi đã lọc theo userId của token hiện tại.
  const items = purchases.map((purchase) => ({
    ...purchase,
    gameUsername: decryptCredential(purchase.gameUsername),
    gamePassword: decryptCredential(purchase.gamePassword),
  }));

  res.json({ items });
});

module.exports = router;
