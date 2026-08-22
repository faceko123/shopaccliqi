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
    title: "kzreg.2529",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239601/krteg.png",
    skins: ["Ryoma samurai huyền thoại", "Zephyr kỷ nguyên hổ phách", "Murad Siêu Việt"],
  },
  {
    title: "yahiikko723",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239683/yahiii.png",
    skins: ["Ngộ không siêu việt 2.0", "Zephyr kỷ nguyên hổ phách", "Florentino kỷ nguyên hổ phách"],
  },
  {
    title: "bzmxite.40",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787238584/bzmxite.40.png",
    skins: ["Zephyr kỷ nguyên hổ phách", "Florentino kỷ nguyên hổ phách", "Murad chí tôn thần kiếm", "Toro tử lôi thần ngưu"],
  },
  {
    title: "Yayacc.s560",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239710/yay.png",
    skins: ["Zephyr kỷ nguyên hổ phách", "Florentino kỷ nguyên hổ phách", "Murad siêu việt"],
  },
  {
    title: "ytru.613",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239735/ytru.xz613.png",
    skins: ["Quillen nghịch thiên long đế", "Enzo sát thần bạch hổ", "Tulen tiêu dao vũ thần", "Aoi hoàng kim công chúa"],
  },
  {
    title: "may1.k4418",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787240601/kasjc.png",
    skins: ["Paine cửu sơn tương liễu", "Tulen tiêu dao vũ thần", "Lauriel tháng quang sứ", "Verra A.I love you", "Nakroth khiêu chiến"],
  },
  {
    title: "exbu.9910",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239251/a3.png",
    skins: ["Enzo sát thần bạch hổ", "Tulen tiêu dao vũ thần", "Elsu trấn thiên phi hồ"],
  },
  {
    title: "gyjx.2253",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787239483/gyjx.png",
    skins: ["Enzo sát thần bạch hổ", "Butterfly kim ngư thần nữ", "Verra A.I love you", "Murad siêu việt"],
  },
  {
    title: "gbgux2151",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787313405/bjkfdhc.png",
    skins: ["Laville vệ binh giáng sinh", "Laville tiệc bãi biển"],
  },
  {
    title: "UId.u1044",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787314660/merged-1787314564705.png",
    skins: ["Omen đao phủ tận thế"],
  },
  {
    title: "ntp.yn3660",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787315358/arumvk.png",
    skins: ["Arum vũ khúc long hổ"],
  },
  {
    title: "begn.4469",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787315656/Screenshot_20260821-193242.png",
    skins: ["Lữ bố tư lệnh robot"],
  },
  {
    title: "uocex634",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787315939/Screenshot_20260821-193656.png",
    skins: ["Quillen nghịch thiên long đế"],
  },
  {
    title: "cc0ue5845",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787316256/Screenshot_20260821-194032.png",
    skins: ["Lauriel tháng quang sứ"],
  },
  {
    title: "may7.q19989",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787320324/Screenshot_20260821-205034.png",
    skins: ["Triệu vân kỵ sĩ tận thế", "Laville xạ thần tinh vệ"],
  },
  {
    title: "Mosawe.84",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787320764/Screenshot_20260821-205616.png",
    skins: ["Florentino kỷ nguyên hổ phách", "Tel'annas kỷ nguyên hổ phách"],
  },
  {
    title: "fkda.4271",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787394389/merged-1787394282028.png",
    skins: ["Điêu thuyền wave", "Verra A.I love you"],
  },
  {
    title: "knyx.9603",
    image: "https://res.cloudinary.com/zv0jlmxj/image/upload/v1787394628/Screenshot_20260822-172842.png",
    skins: ["Natalya phù thủy bóng đêm"],
  },
];

async function main() {
  const accounts = rawAccounts.map((a) => ({
    id: uuidv4(),
    ...a,
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
