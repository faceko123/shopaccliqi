const fs = require("fs");
const path = require("path");

const ACCOUNTS_PATH = path.join(__dirname, "..", "..", "data", "accounts.json");
const USERS_PATH = path.join(__dirname, "..", "..", "data", "users.json");
const PURCHASES_PATH = path.join(__dirname, "..", "..", "data", "purchases.json");

// Hàng đợi ghi riêng cho từng file, tránh 2 request ghi đè lên nhau cùng lúc
const writeQueues = new Map();

function readJSON(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeJSON(filePath, data) {
  const prevQueue = writeQueues.get(filePath) || Promise.resolve();
  const nextQueue = prevQueue.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8", (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
  );
  writeQueues.set(filePath, nextQueue);
  return nextQueue;
}

// ===== Accounts (danh sách acc liên quân - data/accounts.json) =====
function getAccounts() {
  return readJSON(ACCOUNTS_PATH);
}
function saveAccounts(accounts) {
  return writeJSON(ACCOUNTS_PATH, accounts);
}

// ===== Users (người dùng hệ thống - data/users.json) =====
function getUsers() {
  return readJSON(USERS_PATH);
}
function saveUsers(users) {
  return writeJSON(USERS_PATH, users);
}

// ===== Purchases (lịch sử mua acc - data/purchases.json) =====
function getPurchases() {
  return readJSON(PURCHASES_PATH);
}
function savePurchases(purchases) {
  return writeJSON(PURCHASES_PATH, purchases);
}

module.exports = {
  getAccounts,
  saveAccounts,
  getUsers,
  saveUsers,
  getPurchases,
  savePurchases,
};
