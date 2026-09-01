const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "..", "data");
const DATABASE_URL = process.env.DATABASE_URL;
const DATA_KEYS = ["accounts", "users", "purchases", "transactions"];

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

function filePath(key) {
  return path.join(DATA_DIR, `${key}.json`);
}

function readFileData(key) {
  try {
    return JSON.parse(fs.readFileSync(filePath(key), "utf-8"));
  } catch {
    return [];
  }
}

function writeFileData(key, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return fs.promises.writeFile(filePath(key), JSON.stringify(value, null, 2), "utf-8");
}

// Khởi tạo kho dữ liệu PostgreSQL và nhập dữ liệu JSON mẫu đúng một lần.
async function initialize() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_data (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const key of DATA_KEYS) {
    const result = await pool.query("SELECT 1 FROM shop_data WHERE key = $1", [key]);
    if (result.rowCount === 0) {
      await pool.query(
        "INSERT INTO shop_data (key, value) VALUES ($1, $2::jsonb)",
        [key, JSON.stringify(readFileData(key))]
      );
    }
  }
}

async function get(key) {
  if (!pool) return readFileData(key);
  const result = await pool.query("SELECT value FROM shop_data WHERE key = $1", [key]);
  return result.rows[0]?.value || [];
}

async function save(key, value) {
  if (!pool) return writeFileData(key, value);
  await pool.query(
    `INSERT INTO shop_data (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

module.exports = {
  initialize,
  getAccounts: () => get("accounts"),
  saveAccounts: (items) => save("accounts", items),
  getUsers: () => get("users"),
  saveUsers: (items) => save("users", items),
  getPurchases: () => get("purchases"),
  savePurchases: (items) => save("purchases", items),
  getTransactions: () => get("transactions"),
  saveTransactions: (items) => save("transactions", items),
};
