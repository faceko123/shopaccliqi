const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data", "db.json");

// Hàng đợi ghi đơn giản để tránh 2 request ghi đè lên nhau cùng lúc
let writeQueue = Promise.resolve();

function readDB() {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8", (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
  );
  return writeQueue;
}

// ===== Accounts (danh sách acc) =====
function getAccounts() {
  return readDB().accounts;
}

function saveAccounts(accounts) {
  const data = readDB();
  data.accounts = accounts;
  return writeDB(data);
}

// ===== Users (người dùng hệ thống) =====
function getUsers() {
  return readDB().users;
}

function saveUsers(users) {
  const data = readDB();
  data.users = users;
  return writeDB(data);
}

module.exports = {
  getAccounts,
  saveAccounts,
  getUsers,
  saveUsers,
};
