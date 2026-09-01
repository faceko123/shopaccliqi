const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const db = require("../utils/db");
const { signToken } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, balance: u.balance || 0, createdAt: u.createdAt };
}

// POST /api/auth/register - tự đăng ký tài khoản (mặc định role "user")
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
  }

  const users = db.getUsers();
  const exists = users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (exists) {
    return res.status(409).json({ error: "Tên đăng nhập đã tồn tại." });
  }

  const newUser = {
    id: uuidv4(),
    username: username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: "user",
    balance: 0,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await db.saveUsers(users);

  const token = signToken(newUser);
  res.status(201).json({ token, user: publicUser(newUser) });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." });
  }

  const users = db.getUsers();
  const user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu." });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me - lấy thông tin người dùng hiện tại từ token
router.get("/me", requireAuth, (req, res) => {
  const users = db.getUsers();
  const user = users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng." });
  res.json({ user: publicUser(user) });
});

module.exports = router;
