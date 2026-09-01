const { verifyToken } = require("../utils/jwt");

// Xác thực token nếu có, nhưng KHÔNG bắt buộc phải đăng nhập
// (dùng cho route công khai nhưng muốn biết ai đang gọi, ví dụ GET /accounts)
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch (err) {
      // token hết hạn/sai -> coi như khách vãng lai, không chặn
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

// Bắt buộc phải có token hợp lệ
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Bạn cần đăng nhập để thực hiện thao tác này." });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch (err) {
    return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
  }
}

// Bắt buộc phải là admin (phải dùng sau requireAuth)
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Chỉ quản trị viên mới có quyền thực hiện thao tác này." });
  }
  next();
}

module.exports = { optionalAuth, requireAuth, requireAdmin };
