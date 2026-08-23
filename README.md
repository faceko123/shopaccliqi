# Shop Acc Liqi — Backend API + Frontend

Dự án gồm 2 phần độc lập:
- `backend/` — API Node.js/Express, lưu dữ liệu bằng file JSON (`backend/data/db.json`)
- `frontend/` — giao diện tĩnh (HTML/CSS/JS), gọi API qua `fetch`

## 1. Chạy Backend

```bash
cd backend
npm install
cp .env.example .env      # rồi mở .env đổi JWT_SECRET thành chuỗi ngẫu nhiên của riêng bạn
node seed.js               # tạo dữ liệu mẫu: 18 acc + 2 tài khoản (admin/admin123, user/user123)
npm start                  # chạy server tại http://localhost:4000
```

Kiểm tra API sống chưa: mở `http://localhost:4000/api/health`.

### Danh sách API chính

| Method | Endpoint              | Quyền       | Mô tả                                  |
|--------|------------------------|-------------|------------------------------------------|
| POST   | `/api/auth/register`   | Công khai   | Tự đăng ký tài khoản (role `user`)       |
| POST   | `/api/auth/login`      | Công khai   | Đăng nhập, trả về JWT                    |
| GET    | `/api/auth/me`         | Đăng nhập   | Lấy thông tin bản thân                   |
| GET    | `/api/accounts`        | Công khai   | Danh sách acc (`?q=&page=&limit=`)       |
| GET    | `/api/accounts/:id`    | Công khai   | Chi tiết 1 acc                           |
| POST   | `/api/accounts`        | Admin       | Thêm acc mới                             |
| PUT    | `/api/accounts/:id`    | Admin       | Sửa acc                                  |
| DELETE | `/api/accounts/:id`    | Admin       | Xóa acc                                  |
| GET    | `/api/users`           | Admin       | Danh sách người dùng                     |
| POST   | `/api/users`           | Admin       | Tạo người dùng (chọn được role)          |
| PUT    | `/api/users/:id`       | Admin       | Đổi role hoặc mật khẩu của người dùng    |
| DELETE | `/api/users/:id`       | Admin       | Xóa người dùng                           |

Xác thực dùng JWT: gửi header `Authorization: Bearer <token>` cho các route cần đăng nhập.

## 2. Chạy Frontend

Frontend là file tĩnh, chỉ cần mở bằng 1 local server (không mở trực tiếp bằng `file://` vì `fetch` có thể bị chặn bởi CORS/file policy trên một số trình duyệt).

Cách nhanh nhất — dùng extension "Live Server" của VS Code, hoặc:

```bash
cd frontend
npx serve .
# hoặc: python3 -m http.server 5500
```

Mở `frontend/config.js` và đảm bảo `API_BASE_URL` trỏ đúng địa chỉ backend (mặc định `http://localhost:4000/api`).

## 3. Thay đổi quan trọng so với bản cũ

- **Dữ liệu dùng chung, không còn lưu riêng theo từng user trong `localStorage`.** Bản cũ mỗi user có một bản sao dữ liệu riêng trong trình duyệt — điều này không hợp lý cho một shop bán acc (khách hàng cần thấy cùng một danh sách). Giờ tất cả admin/user đều thấy chung 1 danh sách lấy từ server, chỉ admin mới sửa được.
- **Mật khẩu được mã hoá (bcrypt)**, không còn so sánh chuỗi thô trong code frontend — an toàn hơn nhiều vì trước đây ai mở DevTools cũng đọc được logic đăng nhập.
- **Thêm chức năng đăng ký** tài khoản mới (role mặc định `user`).
- **Thêm trang quản lý người dùng** cho admin: xem danh sách, đổi vai trò, xoá, thêm mới.
- **Tìm kiếm & phân trang chuyển sang xử lý ở server**, phù hợp khi danh sách acc phát triển lớn hơn.
- **`data.js` không còn cần thiết** — dữ liệu mẫu giờ nằm trong `backend/seed.js`.

## 4. Nâng cấp sau này

- Đổi `backend/src/utils/db.js` sang MongoDB/PostgreSQL nếu cần mở rộng — các route không cần sửa vì đã tách lớp truy cập dữ liệu riêng.
- Thêm rate-limiting cho `/api/auth/login` để chống brute-force.
- Deploy backend lên Render/Railway/VPS, frontend lên Vercel/Netlify/Cloudflare Pages, rồi cập nhật `API_BASE_URL`.
