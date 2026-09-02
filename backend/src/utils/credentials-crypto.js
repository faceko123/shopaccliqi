const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const encodedKey = process.env.GAME_CREDENTIALS_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw new Error("Thiếu GAME_CREDENTIALS_ENCRYPTION_KEY. Server không thể khởi động an toàn.");
  }

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("GAME_CREDENTIALS_ENCRYPTION_KEY phải là khóa Base64 của đúng 32 byte.");
  }
  return key;
}

function validateEncryptionKey() {
  getEncryptionKey();
}

function isEncryptedCredential(value) {
  if (typeof value !== "string") return false;
  const [version, ivBase64, authTagBase64, ciphertextBase64, ...extra] = value.split(":");
  if (version !== VERSION || !ivBase64 || !authTagBase64 || !ciphertextBase64 || extra.length > 0) return false;
  return Buffer.from(ivBase64, "base64").length === IV_LENGTH
    && Buffer.from(authTagBase64, "base64").length === AUTH_TAG_LENGTH
    && Buffer.from(ciphertextBase64, "base64").length > 0;
}

function encryptCredential(value) {
  if (value === undefined || value === null || value === "") return value;
  if (isEncryptedCredential(value)) return value;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

function decryptCredential(value) {
  if (value === undefined || value === null || value === "") return value;

  // Dữ liệu cũ được đọc tương thích và sẽ được mã hóa tự động khi server khởi động.
  if (!isEncryptedCredential(value)) return value;

  const [version, ivBase64, authTagBase64, ciphertextBase64] = value.split(":");
  if (version !== VERSION || !ivBase64 || !authTagBase64 || !ciphertextBase64) {
    throw new Error("Dữ liệu thông tin game đã mã hóa không hợp lệ.");
  }

  try {
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const ciphertext = Buffer.from(ciphertextBase64, "base64");
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid encrypted credential format");
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    throw new Error("Không thể giải mã thông tin game. Hãy kiểm tra khóa mã hóa trên server.");
  }
}

module.exports = {
  decryptCredential,
  encryptCredential,
  isEncryptedCredential,
  validateEncryptionKey,
};
