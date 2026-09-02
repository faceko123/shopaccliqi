const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "..", "data");
const DATABASE_URL = process.env.DATABASE_URL;
const DATA_KEYS = ["accounts", "users", "purchases", "transactions", "recharges"];

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

// Các thao tác làm thay đổi nhiều collection phải đi qua hàm này. Với
// PostgreSQL, FOR UPDATE giữ khóa cho tới COMMIT nên một snapshot cũ không thể
// ghi đè snapshot mới. Chế độ file cũng tuần tự hóa cùng các thao tác này.
let fileLock = Promise.resolve();
async function withLockedData(keys, mutate) {
  const uniqueKeys = [...new Set(keys)].sort();
  if (!pool) {
    const previous = fileLock;
    let release;
    fileLock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      const data = Object.fromEntries(uniqueKeys.map((key) => [key, readFileData(key)]));
      const result = await mutate(data);
      for (const key of uniqueKeys) await writeFileData(key, data[key]);
      return result;
    } finally {
      release();
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rows = await client.query(
      "SELECT key, value FROM shop_data WHERE key = ANY($1::text[]) ORDER BY key FOR UPDATE",
      [uniqueKeys]
    );
    const data = Object.fromEntries(uniqueKeys.map((key) => [key, []]));
    for (const row of rows.rows) data[row.key] = row.value;
    const result = await mutate(data);
    for (const key of uniqueKeys) {
      await client.query(
        "UPDATE shop_data SET value = $2::jsonb, updated_at = NOW() WHERE key = $1",
        [key, JSON.stringify(data[key])]
      );
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function purchaseAccount({ accountId, userId, purchaseId, now }) {
  return withLockedData(["accounts", "users", "purchases"], async (data) => {
    const account = data.accounts.find((item) => item.id === accountId);
    if (!account) return { status: "ACCOUNT_NOT_FOUND" };
    if (account.sold) return { status: "ALREADY_SOLD" };
    const buyer = data.users.find((item) => item.id === userId);
    if (!buyer) return { status: "USER_NOT_FOUND" };
    const balance = Number(buyer.balance) || 0;
    if (balance < account.price) return { status: "INSUFFICIENT_BALANCE", account, balance };

    buyer.balance = balance - account.price;
    buyer.updatedAt = now;
    account.sold = true;
    account.soldTo = buyer.id;
    account.soldAt = now;
    const purchase = {
      id: purchaseId, userId: buyer.id, accountId: account.id, price: account.price,
      image: account.image, info: account.info, skins: account.skins, adminNote: account.adminNote,
      gameUsername: account.gameUsername, gamePassword: account.gamePassword, purchasedAt: now,
    };
    data.purchases.unshift(purchase);
    return { status: "SUCCESS", purchase, balance: buyer.balance };
  });
}

async function createRecharge({ userId, code, amount, now, expiresAt }) {
  return withLockedData(["users", "recharges"], async (data) => {
    if (!data.users.some((user) => user.id === userId)) return { status: "USER_NOT_FOUND" };
    const nowMs = new Date(now).getTime();
    // Mã chưa thanh toán đã hết hạn không còn giá trị đối soát và được dọn ở
    // lần tạo mã kế tiếp. Chỉ giữ pending còn hiệu lực hoặc mã đã hoàn tất.
    data.recharges = data.recharges.filter((recharge) =>
      recharge.status === "completed" || new Date(recharge.expiresAt).getTime() > nowMs
    );
    const activeRecharge = data.recharges.find((recharge) =>
      recharge.userId === userId && recharge.status === "pending"
    );
    if (activeRecharge) return { status: "ACTIVE_RECHARGE", recharge: activeRecharge };
    if (data.recharges.some((recharge) => recharge.code === code)) return { status: "CODE_COLLISION" };
    const recharge = { code, userId, amount, status: "pending", createdAt: now, expiresAt };
    data.recharges.push(recharge);
    return { status: "SUCCESS", recharge };
  });
}

async function processRecharge({ code, referenceCode, amount, now }) {
  return withLockedData(["users", "recharges", "transactions"], async (data) => {
    if (data.transactions.some((transaction) => transaction.referenceCode === referenceCode)) {
      return { status: "DUPLICATE" };
    }
    const recharge = data.recharges.find((item) => item.code === code);
    if (!recharge || recharge.status !== "pending") return { status: "UNKNOWN_CODE" };
    if (new Date(recharge.expiresAt).getTime() < Date.now()) {
      recharge.status = "expired";
      return { status: "EXPIRED" };
    }
    if (Number(recharge.amount) !== amount) return { status: "AMOUNT_MISMATCH" };
    const buyer = data.users.find((user) => user.id === recharge.userId);
    if (!buyer) return { status: "USER_NOT_FOUND" };

    buyer.balance = (Number(buyer.balance) || 0) + amount;
    buyer.updatedAt = now;
    recharge.status = "completed";
    recharge.completedAt = now;
    recharge.referenceCode = referenceCode;
    data.transactions.push({ referenceCode, userId: buyer.id, username: buyer.username, amount, rechargeCode: code, createdAt: now });
    return { status: "SUCCESS", buyer, balance: buyer.balance };
  });
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
  getRecharges: () => get("recharges"),
  saveRecharges: (items) => save("recharges", items),
  purchaseAccount,
  createRecharge,
  processRecharge,
};
