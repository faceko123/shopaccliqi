require("dotenv").config();

const path = require("path");
const { execFileSync } = require("child_process");
const express = require("express");
const cors = require("cors");
const db = require("./src/utils/db");

const authRoutes = require("./src/routes/auth.routes");
const accountsRoutes = require("./src/routes/accounts.routes");
const walletRoutes = require("./src/routes/wallet.routes");
const purchasesRoutes = require("./src/routes/purchases.routes");
const usersRoutes = require("./src/routes/users.routes");

const app = express();
const port = Number(process.env.PORT) || 4000;

// Persistent Disk của Render ban đầu trống. Seed chỉ tạo dữ liệu mẫu khi chưa có dữ liệu,
// nên chạy lại lúc khởi động không làm mất tài khoản hoặc giao dịch đã lưu.
if (process.env.DATA_DIR) {
  execFileSync(process.execPath, [path.join(__dirname, "seed.js")], {
    env: process.env,
    stdio: "inherit",
  });
}

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/purchases", purchasesRoutes);
app.use("/api/users", usersRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}` });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);
  res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
});

async function start() {
  await db.initialize();
  app.listen(port, () => {
    console.log(`API đang chạy tại cổng ${port}`);
  });
}

start().catch((error) => {
  console.error("Không thể khởi tạo kho dữ liệu:", error);
  process.exit(1);
});
