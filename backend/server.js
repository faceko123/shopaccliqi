require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/auth.routes");
const accountsRoutes = require("./src/routes/accounts.routes");
const usersRoutes = require("./src/routes/users.routes");
const walletRoutes = require("./src/routes/wallet.routes");
const purchasesRoutes = require("./src/routes/purchases.routes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/purchases", purchasesRoutes);

// Middleware bắt lỗi chung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Đã có lỗi xảy ra ở server." });
});

app.listen(PORT, () => {
  console.log(`✅ Shop Acc Liqi API đang chạy tại http://localhost:${PORT}`);
});
