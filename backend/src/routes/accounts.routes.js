const express = require("express");
const { v4: uuidv4 } = require("uuid");

const db = require("../utils/db");
const { optionalAuth, requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/accounts?q=tuk-hoa&page=1&limit=16
// Công khai - ai cũng xem được, không cần đăng nhập
router.get("/", optionalAuth, (req, res) => {
  const { q = "", page = "1", limit = "16" } = req.query;
  const keyword = q.trim().toLowerCase();

  let list = db.getAccounts();

  if (keyword) {
    list = list
      .map((item) => {
        const matchTitle = item.title.toLowerCase().includes(keyword);
        const matchingSkins = (item.skins || []).filter((s) => s.toLowerCase().includes(keyword));
        const nonMatchingSkins = (item.skins || []).filter((s) => !s.toLowerCase().includes(keyword));
        return {
          ...item,
          skins: [...matchingSkins, ...nonMatchingSkins],
          _match: matchTitle || matchingSkins.length > 0,
        };
      })
      .filter((item) => item._match)
      .map(({ _match, ...rest }) => rest);
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
  const { title, image, skins } = req.body;
  if (!title || !image) {
    return res.status(400).json({ error: "Vui lòng nhập tên tài khoản và URL hình ảnh." });
  }

  const accounts = db.getAccounts();
  const newItem = {
    id: uuidv4(),
    title: title.trim(),
    image: image.trim(),
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

  const { title, image, skins } = req.body;
  accounts[index] = {
    ...accounts[index],
    title: title !== undefined ? title.trim() : accounts[index].title,
    image: image !== undefined ? image.trim() : accounts[index].image,
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
