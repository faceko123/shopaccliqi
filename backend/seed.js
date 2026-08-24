/**
 * Script khởi tạo dữ liệu mẫu cho database (data/db.json).
 * Chạy: node seed.js
 *
 * - Tạo danh sách acc mẫu (lấy từ data.js cũ của frontend)
 * - Tạo 2 tài khoản mặc định: admin/admin123 và user/user123 (mật khẩu đã mã hoá)
 *
 * An toàn khi chạy nhiều lần: nếu db.json đã có dữ liệu, script sẽ hỏi lại
 * bằng cách không ghi đè trừ khi truyền --force
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const DB_PATH = path.join(__dirname, "data", "db.json");
const force = process.argv.includes("--force");

if (fs.existsSync(DB_PATH) && !force) {
  const existing = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  if ((existing.accounts && existing.accounts.length) || (existing.users && existing.users.length)) {
    console.log("⚠️  data/db.json đã có dữ liệu. Dùng `node seed.js --force` nếu muốn ghi đè.");
    process.exit(0);
  }
}

const rawAccounts = [
  {
    price: 120000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239601/krteg.png",
    info: "Mã acc: kzreg.2529 · Rank Cao Thủ · Đầy đủ thông tin, chưa từng bị khóa.",
    skins: ["Ryoma samurai huyền thoại", "Zephyr kỷ nguyên hổ phách", "Murad Siêu Việt"],
  },
  {
    price: 135000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239683/yahiii.png",
    info: "Mã acc: yahiikko723 · Rank Tinh Anh · Nhiều tướng mạnh, phù hợp leo rank.",
    skins: ["Ngộ không siêu việt 2.0", "Zephyr kỷ nguyên hổ phách", "Florentino kỷ nguyên hổ phách"],
  },
  {
    price: 125000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787238584/bzmxite.40.png",
    info: "Mã acc: bzmxite.40 · Rank Cao Thủ · Kho skin xịn, hỗ trợ đổi mail sau mua.",
    skins: ["Zephyr kỷ nguyên hổ phách", "Florentino kỷ nguyên hổ phách", "Murad chí tôn thần kiếm", "Toro tử lôi thần ngưu"],
  },
  {
    price: 65000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239710/yay.png",
    info: "Mã acc: Yayacc.s560 · Rank Tinh Anh · Tài khoản sạch, chưa liên kết mạng xã hội.",
    skins: ["Zephyr kỷ nguyên hổ phách", "Florentino kỷ nguyên hổ phách", "Murad siêu việt"],
  },
  {
    price: 65000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239735/ytru.xz613.png",
    info: "Mã acc: ytru.613 · Rank Cao Thủ · Đa dạng tướng, phù hợp mọi vị trí.",
    skins: ["Quillen nghịch thiên long đế", "Enzo sát thần bạch hổ", "Tulen tiêu dao vũ thần", "Aoi hoàng kim công chúa"],
  },
  {
    price: 60000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787240601/kasjc.png",
    info: "Mã acc: may1.k4418 · Rank Cao Thủ · Kho skin khủng, đáng để đầu tư.",
    skins: ["Paine cửu sơn tương liễu", "Tulen tiêu dao vũ thần", "Lauriel tháng quang sứ", "Verra A.I love you", "Nakroth khiêu chiến"],
  },
  {
    price: 50000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239251/a3.png",
    info: "Mã acc: exbu.9910 · Rank Tinh Anh · Tài khoản ổn định, ít bị report.",
    skins: ["Enzo sát thần bạch hổ", "Tulen tiêu dao vũ thần", "Elsu trấn thiên phi hồ"],
  },
  {
    price: 120000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239483/gyjx.png",
    info: "Mã acc: gyjx.2253 · Rank Cao Thủ · Nhiều skin hiếm, giá tốt.",
    skins: ["Enzo sát thần bạch hổ", "Butterfly kim ngư thần nữ", "Verra A.I love you", "Murad siêu việt"],
  },
  {
    price: 25000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787313405/bjkfdhc.png",
    info: "Mã acc: gbgux2151 · Rank Kim Cương · Hợp cho người mới bắt đầu.",
    skins: ["Laville vệ binh giáng sinh", "Laville tiệc bãi biển"],
  },
  {
    price: 7000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787314660/merged-1787314564705.png",
    info: "Mã acc: UId.u1044 · Rank Vàng · Giá rẻ, phù hợp trải nghiệm thử.",
    skins: ["Omen đao phủ tận thế"],
  },
  {
    price: 7000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787315358/arumvk.png",
    info: "Mã acc: ntp.yn3660 · Rank Vàng · Tài khoản sạch, chưa từng bị khóa.",
    skins: ["Arum vũ khúc long hổ"],
  },
  {
    price: 7000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787315656/Screenshot_20260821-193242.png",
    info: "Mã acc: begn.4469 · Rank Bạch Kim · Sở hữu 1 skin hiếm ít người có.",
    skins: ["Lữ bố tư lệnh robot"],
  },
  {
    price: 25000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787315939/Screenshot_20260821-193656.png",
    info: "Mã acc: uocex634 · Rank Vàng · Giá rẻ, giao dịch nhanh gọn.",
    skins: ["Quillen nghịch thiên long đế"],
  },
  {
    price: 7000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787316256/Screenshot_20260821-194032.png",
    info: "Mã acc: cc0ue5845 · Rank Bạch Kim · Hợp cày rank hoặc chơi giải trí.",
    skins: ["Lauriel tháng quang sứ"],
  },
  {
    price: 15000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787320324/Screenshot_20260821-205034.png",
    info: "Mã acc: may7.q19989 · Rank Kim Cương · Kèm 2 skin đẹp mắt.",
    skins: ["Triệu vân kỵ sĩ tận thế", "Laville xạ thần tinh vệ"],
  },
  {
    price: 30000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787320764/Screenshot_20260821-205616.png",
    info: "Mã acc: Mosawe.84 · Rank Kim Cương · 2 skin kỷ nguyên hổ phách siêu hiếm.",
    skins: ["Florentino kỷ nguyên hổ phách", "Tel'annas kỷ nguyên hổ phách"],
  },
  {
    price: 10000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787394389/merged-1787394282028.png",
    info: "Mã acc: fkda.4271 · Rank Kim Cương · Tài khoản đẹp, ít trận đấu.",
    skins: ["Điêu thuyền wave", "Verra A.I love you"],
  },
  {
    price: 25000,
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787394628/Screenshot_20260822-172842.png",
    info: "Mã acc: knyx.9603 · Rank Bạch Kim · Sở hữu skin phù thủy bóng đêm hiếm.",
    skins: ["Natalya phù thủy bóng đêm"],
  },
];

async function main() {
  const accounts = rawAccounts.map((a) => ({
    id: uuidv4(),
    price: a.price,
    image: a.image,
    info: a.info || "",
    skins: a.skins || [],
    createdAt: new Date().toISOString(),
  }));

  const users = [
    {
      id: uuidv4(),
      username: "admin",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "admin",
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      username: "user",
      passwordHash: bcrypt.hashSync("user123", 10),
      role: "user",
      createdAt: new Date().toISOString(),
    },
  ];

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify({ accounts, users }, null, 2), "utf-8");

  console.log(`✅ Đã tạo ${accounts.length} acc mẫu và ${users.length} tài khoản mặc định.`);
  console.log("   Admin: admin / admin123");
  console.log("   User:  user / user123");
}

main();
