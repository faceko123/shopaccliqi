const express = require("express");

const db = require("../utils/dbt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/purchases/me - lịch sử mua acc của người dùng hiện tại
router.get("/me", requireAuth, (req, res) => {
  const purchases = db
    .getPurchases()
    .filter((p) => p.userId === req.user.sub)
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));

  res.json({ items: purchases });
});

module.exports = router;
