require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./src/utils/db");
const { encryptCredential, isEncryptedCredential, validateEncryptionKey } = require("./src/utils/credentials-crypto");

const authRoutes = require("./src/routes/auth.routes");
const accountsRoutes = require("./src/routes/accounts.routes");
const walletRoutes = require("./src/routes/wallet.routes");
const purchasesRoutes = require("./src/routes/purchases.routes");
const usersRoutes = require("./src/routes/users.routes");

const app = express();
const port = Number(process.env.PORT) || 4000;

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

async function encryptStoredGameCredentials() {
  const encryptCollection = async (getItems, saveItems) => {
    const items = await getItems();
    let changed = false;
    const encryptedItems = items.map((item) => {
      const encryptedUsername = item.gameUsername && !isEncryptedCredential(item.gameUsername)
        ? encryptCredential(item.gameUsername)
        : item.gameUsername;
      const encryptedPassword = item.gamePassword && !isEncryptedCredential(item.gamePassword)
        ? encryptCredential(item.gamePassword)
        : item.gamePassword;
      changed ||= encryptedUsername !== item.gameUsername || encryptedPassword !== item.gamePassword;
      return { ...item, gameUsername: encryptedUsername, gamePassword: encryptedPassword };
    });
    if (changed) await saveItems(encryptedItems);
  };

  await encryptCollection(db.getAccounts, db.saveAccounts);
  await encryptCollection(db.getPurchases, db.savePurchases);
}

async function start() {
  // Không dùng khóa mặc định: credential game chỉ được lưu khi có khóa bí mật hợp lệ.
  validateEncryptionKey();
  if (typeof db.initialize === "function") {
    await db.initialize();
  } else {
    console.warn("Kho dữ liệu PostgreSQL chưa được nạp; đang dùng chế độ tương thích tạm thời.");
  }
  await encryptStoredGameCredentials();
  app.listen(port, () => {
    console.log(`API đang chạy tại cổng ${port}`);
  });
}

start().catch((error) => {
  console.error("Không thể khởi tạo kho dữ liệu:", error);
  process.exit(1);
});
