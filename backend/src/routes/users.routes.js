const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const db = require("../utils/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, balance: u.balance || 0, createdAt: u.createdAt };
}

// Tất cả route trong file này đều yêu cầu đăng nhập + quyền admin
router.use(requireAuth, requireAdmin);

// GET /api/users - danh sách người dùng
router.get("/", async (req, res) => {
  const users = (await db.getUsers()).map(publicUser);
  res.json({ items: users });
});

// POST /api/users - admin tạo tài khoản mới (có thể chọn role)
router.post("/", async (req, res) => {
  const { username, password, role = "user" } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." });
  }
  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ error: "Vai trò không hợp lệ." });
  }

  const users = await db.getUsers();
  const exists = users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (exists) return res.status(409).json({ error: "Tên đăng nhập đã tồn tại." });

  const newUser = {
    id: uuidv4(),
    username: username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    balance: 0,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await db.saveUsers(users);
  res.status(201).json({ item: publicUser(newUser) });
});

// PUT /api/users/:id - đổi vai trò / mật khẩu
router.put("/:id", async (req, res) => {
  const users = await db.getUsers();
  const index = users.findIndex((u) => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  const { role, password } = req.body;

  // Chặn admin tự hạ quyền chính mình để tránh tự khoá tài khoản duy nhất
  if (req.user.sub === users[index].id && role && role !== "admin") {
    const otherAdmins = users.filter((u) => u.role === "admin" && u.id !== users[index].id);
    if (otherAdmins.length === 0) {
      return res.status(400).json({ error: "Không thể hạ quyền admin cuối cùng trong hệ thống." });
    }
  }

  if (role && ["admin", "user"].includes(role)) {
    users[index].role = role;
  }
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
    }
    users[index].passwordHash = bcrypt.hashSync(password, 10);
  }

  await db.saveUsers(users);
  res.json({ item: publicUser(users[index]) });
});

// PUT /api/users/:id/balance - Admin chỉnh sửa số dư người dùng
router.put("/:id/balance", async (req, res) => {
  const users = await db.getUsers();
  const index = users.findIndex((u) => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  const { balance } = req.body;
  const balanceNum = Number(balance);

  if (balance === undefined || Number.isNaN(balanceNum) || balanceNum < 0) {
    return res.status(400).json({ error: "Số dư phải là một số hợp lệ (không âm)." });
  }

  // Cập nhật số dư mới
  users[index].balance = balanceNum;
  await db.saveUsers(users);

  res.json({ item: publicUser(users[index]) });
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  const users = await db.getUsers();
  const index = users.findIndex((u) => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  if (req.user.sub === users[index].id) {
    return res.status(400).json({ error: "Bạn không thể tự xoá tài khoản đang đăng nhập." });
  }

  const [removed] = users.splice(index, 1);
  await db.saveUsers(users);
  res.json({ item: publicUser(removed) });
});

module.exports = router;
