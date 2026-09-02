# Shop Acc Liqi — Backend API + Frontend

Dự án gồm 2 phần độc lập:
- `backend/` — API Node.js/Express, lưu dữ liệu bằng các file JSON khi phát triển hoặc PostgreSQL khi triển khai:
  - `backend/data/accounts.json` — danh sách acc Liên Quân
  - `backend/data/users.json` — người dùng hệ thống (kèm số dư ví)
  - `backend/data/purchases.json` — lịch sử mua acc
- `frontend/` — giao diện tĩnh (HTML/CSS/JS), gọi API qua `fetch`

## 1. Chạy Backend

```bash
cd backend
npm install
cp .env.example .env      # rồi mở .env đổi JWT_SECRET thành chuỗi ngẫu nhiên của riêng bạn
npm start                  # chạy server tại http://localhost:4000
```

Trước khi chạy server, tạo khóa mã hóa AES-256-GCM và đặt vào `backend/.env` (không commit file này):

```powershell
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Sao chép kết quả vào `GAME_CREDENTIALS_ENCRYPTION_KEY`. Khóa này bắt buộc phải được giữ nguyên vĩnh viễn; thay đổi hoặc làm mất khóa sẽ khiến dữ liệu credential đã mã hóa không thể giải mã.

Kiểm tra API sống chưa: mở `http://localhost:4000/api/health`.

### Deploy backend lên Render

Tạo một **Web Service** và cấu hình:

- **Root Directory:** `backend`
- **Build Command:** `npm install` (tự chạy seed để tạo dữ liệu mẫu khi dữ liệu đang trống)
- **Start Command:** `npm start`

Thiết lập biến môi trường `JWT_SECRET` bằng chuỗi ngẫu nhiên dài ít nhất 32 ký tự (API sẽ từ chối khởi động nếu thiếu/yếu), `GAME_CREDENTIALS_ENCRYPTION_KEY` là khóa Base64 32 byte và `SEPAY_WEBHOOK_SECRET` là chuỗi ngẫu nhiên riêng của SePay. Đặt `CORS_ORIGIN` là domain frontend (không dùng `*` ở môi trường thật). Không cần đặt `PORT`, vì Render tự cấp biến này. Không đổi hoặc làm mất `GAME_CREDENTIALS_ENCRYPTION_KEY` sau khi đã có acc/đơn hàng.

Không có tài khoản thử nghiệm mặc định. Hãy tạo user/admin bằng quy trình quản trị của bạn trước khi đưa shop vào sử dụng.

Nếu dùng SePay, URL webhook phải là `https://shopaccliqi.onrender.com/api/wallet/webhook` và phương thức là `POST`. Frontend tạo một mã nạp một lần dạng `NAP...` (hết hạn sau 30 phút); khách phải chuyển **đúng số tiền và đúng mã này**. Webhook chỉ chấp nhận mã nạp đang chờ, số tiền khớp tuyệt đối và `referenceCode` chưa từng xử lý — không suy diễn người nhận từ username trong nội dung chuyển khoản.

Để tài khoản đăng ký, số dư và đơn hàng không mất sau khi Render deploy/restart, đặt `DATABASE_URL` là **Session pooler connection string** của Supabase PostgreSQL. Ứng dụng tự tạo bảng dữ liệu và nhập dữ liệu mẫu một lần khi database còn trống. Không đưa `DATABASE_URL` vào frontend hoặc GitHub.

Nếu dùng Render gói trả phí, có thể thay thế bằng Persistent Disk với mount path `/var/data` và `DATA_DIR=/var/data`; gói Free nên dùng PostgreSQL.

### Danh sách API chính

| Method | Endpoint                     | Quyền       | Mô tả                                          |
|--------|-------------------------------|-------------|--------------------------------------------------|
| POST   | `/api/auth/register`          | Công khai   | Tự đăng ký tài khoản (role `user`, số dư 0đ)     |
| POST   | `/api/auth/login`             | Công khai   | Đăng nhập, trả về JWT                            |
| GET    | `/api/auth/me`                | Đăng nhập   | Lấy thông tin bản thân (kèm số dư)               |
| GET    | `/api/accounts`                | Công khai   | Danh sách acc chưa bán (`?q=&page=&limit=&sort=`)|
| GET    | `/api/accounts/:id`            | Công khai   | Chi tiết 1 acc                                   |
| POST   | `/api/accounts`                | Admin       | Thêm acc mới                                     |
| PUT    | `/api/accounts/:id`            | Admin       | Sửa acc                                          |
| DELETE | `/api/accounts/:id`            | Admin       | Xóa acc                                          |
| POST   | `/api/accounts/:id/purchase`   | Đăng nhập   | **Mua acc** — trừ tiền ví, đánh dấu đã bán       |
| GET    | `/api/wallet/me`               | Đăng nhập   | Xem số dư ví hiện tại                            |
| POST   | `/api/wallet/recharges`        | Đăng nhập   | Tạo mã nạp một lần cho số tiền chỉ định          |
| GET    | `/api/wallet/transactions`     | Đăng nhập   | Xem lịch sử nạp tiền của bản thân                |
| POST   | `/api/wallet/topup`            | Đăng nhập   | **Nạp tiền vào ví** (demo, chưa qua cổng thanh toán thật) |
| GET    | `/api/purchases/me`            | Đăng nhập   | Lịch sử acc đã mua của bản thân                  |
| GET    | `/api/users`                   | Admin       | Danh sách người dùng                             |
| POST   | `/api/users`                   | Admin       | Tạo người dùng (chọn được role)                  |
| PUT    | `/api/users/:id`                | Admin       | Đổi role hoặc mật khẩu của người dùng            |
| DELETE | `/api/users/:id`                | Admin       | Xóa người dùng                                   |

Xác thực dùng JWT: gửi header `Authorization: Bearer <token>` cho các route cần đăng nhập.

Tìm kiếm `q` hỗ trợ cú pháp giá rút gọn: `1xx` → 100.000–199.000đ, `2x` → 20.000–29.000đ (số đầu × 10^số chữ "x").

**Lưu ý về tìm kiếm & acc đã bán**: `GET /api/accounts` mặc định chỉ trả về acc **chưa bán**. Khi gọi kèm token admin, API sẽ trả về cả acc đã bán (đánh dấu `sold: true`) để admin đối soát.

## 2. Chạy Frontend

Frontend là file tĩnh, chỉ cần mở bằng 1 local server (không mở trực tiếp bằng `file://` vì `fetch` có thể bị chặn bởi CORS/file policy trên một số trình duyệt).

Cách nhanh nhất — dùng extension "Live Server" của VS Code, hoặc:

```bash
cd frontend
npx serve .
# hoặc: python3 -m http.server 5500
```

Mở `frontend/config.js` và đảm bảo `API_BASE_URL` trỏ đúng địa chỉ backend (mặc định `http://localhost:4000/api`).

## 3. Luồng mua acc (Shop thật sự)

1. Người dùng đăng ký/đăng nhập — số dư ví bắt đầu ở **0đ**
2. Bấm nút 💰 (Ví) trên header → nạp tiền (demo, cộng thẳng vào ví, chưa qua cổng thanh toán thật)
3. Bấm "Xem" trên 1 acc → modal hiện ảnh to + giá + thông tin + skin → bấm "🛒 Mua tài khoản này"
4. Hệ thống trừ tiền trong ví, đánh dấu acc đã bán (không ai mua lại được nữa), ghi vào lịch sử
5. Sau khi mua thành công, tự động chuyển sang modal **"Lịch sử mua acc"** của người dùng đó

⚠️ **Đây là ví demo**: nạp tiền được cộng thẳng vào số dư mà không qua cổng thanh toán thật. Trước khi dùng thật, cần thay logic trong `backend/src/routes/wallet.routes.js` bằng tích hợp cổng thanh toán (VNPay, Momo, Stripe...) và chỉ cộng tiền sau khi cổng thanh toán xác nhận qua webhook.

## 4. Thay đổi quan trọng so với bản cũ

- **Tách dữ liệu thành 3 file riêng** (`accounts.json`, `users.json`, `purchases.json`) thay vì gộp chung 1 file `db.json` — dễ quản lý, dễ backup riêng từng phần.
- **Trở thành shop mua-bán thật sự**: mỗi acc chỉ bán được 1 lần, tự động ẩn khỏi danh sách sau khi bán.
- **Ví tiền nội bộ**: mỗi user có số dư riêng, bắt đầu ở 0đ, có chức năng nạp tiền và lịch sử mua hàng.
- **Dữ liệu dùng chung, không còn lưu riêng theo từng user trong `localStorage`.**
- **Mật khẩu được mã hoá (bcrypt)**, không còn so sánh chuỗi thô trong code frontend.
- **Thêm chức năng đăng ký** tài khoản mới (role mặc định `user`).
- **Trang quản lý người dùng** cho admin, gộp chung vào 1 menu "⚙️ Tính năng" cùng "Thêm acc mới".
- **Tìm kiếm & phân trang xử lý ở server**, hỗ trợ tìm theo giá dạng rút gọn (`1xx`, `2x`...).
- **`data.js` và `seed.js` không còn cần thiết** — dữ liệu được quản lý trực tiếp qua API hoặc PostgreSQL.

## 5. Nâng cấp sau này

- Đổi `backend/src/utils/db.js` sang MongoDB/PostgreSQL nếu cần mở rộng — các route không cần sửa vì đã tách lớp truy cập dữ liệu riêng.
- Tích hợp cổng thanh toán thật (VNPay/Momo/Stripe) thay cho nạp tiền demo.
- Thêm rate-limiting cho `/api/auth/login` để chống brute-force.
- Deploy backend lên Render/Railway/VPS, frontend lên Vercel/Netlify/Cloudflare Pages, rồi cập nhật `API_BASE_URL`.
