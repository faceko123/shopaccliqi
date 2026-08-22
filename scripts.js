const ITEMS_PER_PAGE = 16;

let storiesData = [];
let filtered = [];
let currentPage = 1;
let editingIndex = null;

// Lấy thông tin user hiện tại từ LocalStorage
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;

// DOM Elements chính
const grid = document.getElementById("grid");
const pagination = document.getElementById("pagination");
const search = document.getElementById("search");

// Auth Elements
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const userDisplay = document.getElementById("user-display");
const loginModal = document.getElementById("login-modal");
const loginModalClose = document.getElementById("login-modal-close");
const loginForm = document.getElementById("login-form");

// Lightbox Modal
const modal = document.getElementById("image-modal");
const modalImg = document.getElementById("modal-img");
const modalClose = document.getElementById("modal-close");

// CRUD Elements
const addAccBtn = document.getElementById("add-acc-btn");
const crudModal = document.getElementById("crud-modal");
const crudModalClose = document.getElementById("crud-modal-close");
const cancelFormBtn = document.getElementById("cancel-form-btn");
const accForm = document.getElementById("acc-form");
const modalFormTitle = document.getElementById("modal-form-title");
const inputTitle = document.getElementById("acc-title");
const inputImage = document.getElementById("acc-image");
const inputSkins = document.getElementById("acc-skins");

// ================= LƯU TRỮ THEO USER =================

function getUserStorageKey() {
    if (currentUser) {
        return `stories_${currentUser.username.toLowerCase()}`;
    }
    return "stories_guest";
}

function loadDataForCurrentUser() {
    const key = getUserStorageKey();
    const storedData = localStorage.getItem(key);

    storiesData = typeof stories !== 'undefined' ? JSON.parse(JSON.stringify(stories)) : [];
    
    applyFilter();
}

// Thêm hàm xóa bộ nhớ đệm để đồng bộ lại file data.js khi cần
function resetToDefaultData() {
    const key = getUserStorageKey();
    localStorage.removeItem(key);
    loadDataForCurrentUser();
}

function saveData() {
    const key = getUserStorageKey();
    localStorage.setItem(key, JSON.stringify(storiesData));
}

// ================= LUỒNG ĐĂNG NHẬP / ĐĂNG XUẤT =================

function updateAuthUI() {
    if (currentUser) {
        loginBtn.classList.add("hidden");
        userInfo.classList.remove("hidden");
        userDisplay.innerHTML = `👤 <strong>${currentUser.username}</strong> (${currentUser.role.toUpperCase()})`;

        if (currentUser.role === "admin") {
            document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
        } else {
            document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
        }
    } else {
        loginBtn.classList.remove("hidden");
        userInfo.classList.add("hidden");
        document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    }
}

loginBtn.addEventListener("click", () => {
    loginModal.classList.add("active");
});

loginModalClose.addEventListener("click", closeLoginModal);

function closeLoginModal() {
    loginModal.classList.remove("active");
    loginForm.reset();
}

loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const userVal = document.getElementById("username").value.trim();
    const passVal = document.getElementById("password").value.trim();

    if (userVal === "admin" && passVal === "admin123") {
        currentUser = { username: "admin", role: "admin" };
    } else if (userVal === "user" && passVal === "user123") {
        currentUser = { username: "user", role: "user" };
    } else if (userVal && passVal) {
        currentUser = { username: userVal, role: "user" };
    } else {
        alert("Vui lòng nhập tên đăng nhập và mật khẩu!");
        return;
    }

    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    updateAuthUI();
    closeLoginModal();
    loadDataForCurrentUser();
});

logoutBtn.addEventListener("click", () => {
    currentUser = null;
    localStorage.removeItem("currentUser");
    updateAuthUI();
    loadDataForCurrentUser();
});

// ================= RENDER & PHÂN TRANG =================

function applyFilter() {
    const keyword = search ? search.value.toLowerCase().trim() : "";

    if (!keyword) {
        // Tạo bản sao sâu để tránh ghi đè dữ liệu gốc khi xóa từ khóa
        filtered = storiesData.map(item => ({
            ...item,
            skins: item.skins ? [...item.skins] : []
        }));
    } else {
        filtered = [];
        storiesData.forEach(story => {
            const matchTitle = story.title.toLowerCase().includes(keyword);
            const matchingSkins = [];
            const nonMatchingSkins = [];

            if (story.skins && story.skins.length > 0) {
                story.skins.forEach(skin => {
                    if (skin.toLowerCase().includes(keyword)) {
                        matchingSkins.push(skin);
                    } else {
                        nonMatchingSkins.push(skin);
                    }
                });
            }

            const matchSkin = matchingSkins.length > 0;

            if (matchTitle || matchSkin) {
                filtered.push({
                    ...story,
                    // Đặt các skin khớp với từ khóa lên đầu danh sách
                    skins: [...matchingSkins, ...nonMatchingSkins]
                });
            }
        });
    }

    renderPage(1);
}

function renderPage(page) {
    currentPage = page;

    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const items = filtered.slice(start, end);

    if (!grid) return;
    grid.innerHTML = "";

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = search.value.trim()
            ? `Không tìm thấy acc hoặc skin nào khớp với “<strong>${search.value}</strong>”`
            : `Chưa có acc nào trong thư viện.`;

        grid.appendChild(empty);
        renderPagination();
        return;
    }

    const isAdmin = currentUser && currentUser.role === "admin";

    items.forEach((item) => {
        const originalIndex = storiesData.indexOf(item);

        const card = document.createElement("div");
        card.className = "card";

        let skinTagsHTML = '';
        if (item.skins && item.skins.length > 0) {
            const keyword = search ? search.value.toLowerCase().trim() : "";
            const displaySkins = item.skins.slice(0, 3);
            const hasMore = item.skins.length > 3;

            skinTagsHTML = `<div class="skin-list">
                ${displaySkins.map(skin => {
                    const isMatched = keyword && skin.toLowerCase().includes(keyword);
                    return `<span class="skin-tag ${isMatched ? 'highlight' : ''}">${skin}</span>`;
                }).join("")}
                ${hasMore ? `<span class="skin-more">...</span>` : ''}
            </div>`;
        }

        const viewBtnHTML = `<button class="btn-card view-btn" onclick="openImageModal('${item.image}')">👁️ Xem</button>`;
        const adminActionsHTML = isAdmin ? `
            <button class="btn-card edit-btn" onclick="openEditModal(${originalIndex})">Sửa</button>
            <button class="btn-card delete-btn" onclick="deleteStory(${originalIndex})">Xóa</button>
        ` : '';

        card.innerHTML = `
            <div class="card-image-wrap" onclick="openImageModal('${item.image}')">
                <img loading="lazy" src="${item.image}" alt="${item.title}">
                <div class="page-edge"></div>
            </div>
            <div class="info">
                <div class="title">${item.title}</div>
                ${skinTagsHTML}
                <div class="card-actions">
                    ${viewBtnHTML}
                    ${adminActionsHTML}
                </div>
            </div>  
        `;

        grid.appendChild(card);
    });

    renderPagination();
}

function renderPagination() {
    if (!pagination) return;
    pagination.innerHTML = "";

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;

        if (i === currentPage) {
            btn.classList.add("active");
        }

        btn.onclick = () => renderPage(i);
        pagination.appendChild(btn);
    }
}

// ================= CRUD =================

if (addAccBtn) {
    addAccBtn.addEventListener("click", () => {
        if (!currentUser || currentUser.role !== "admin") return;
        editingIndex = null;
        modalFormTitle.textContent = "Thêm Tài Khoản Mới";
        accForm.reset();
        openCrudModal();
    });
}

window.openEditModal = function (index) {
    if (!currentUser || currentUser.role !== "admin") return;
    editingIndex = index;
    const target = storiesData[index];

    modalFormTitle.textContent = "Chỉnh Sửa Tài Khoản";
    inputTitle.value = target.title;
    inputImage.value = target.image;
    inputSkins.value = target.skins ? target.skins.join("\n") : "";

    openCrudModal();
};

if (accForm) {
    accForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!currentUser || currentUser.role !== "admin") return;

        const title = inputTitle.value.trim();
        const image = inputImage.value.trim();
        const skins = inputSkins.value
            .split("\n")
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (editingIndex !== null) {
            storiesData[editingIndex] = { title, image, skins };
        } else {
            storiesData.unshift({ title, image, skins });
        }

        saveData();
        applyFilter();
        closeCrudModal();
    });
}

window.deleteStory = function (index) {
    if (!currentUser || currentUser.role !== "admin") return;
    if (confirm("Bạn có chắc chắn muốn xóa tài khoản này?")) {
        storiesData.splice(index, 1);
        saveData();
        applyFilter();
    }
};

// ================= MODALS & EVENTS =================

function openCrudModal() { crudModal.classList.add("active"); }
function closeCrudModal() { crudModal.classList.remove("active"); }

if (crudModalClose) crudModalClose.addEventListener("click", closeCrudModal);
if (cancelFormBtn) cancelFormBtn.addEventListener("click", closeCrudModal);

window.openImageModal = function(imgSrc) {
    if (imgSrc && modalImg && modal) {
        modalImg.src = imgSrc;
        modal.classList.add("active");
    }
};

if (modalClose) modalClose.addEventListener("click", closeModal);

window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
    if (e.target === crudModal) closeCrudModal();
    if (e.target === loginModal) closeLoginModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeModal();
        closeCrudModal();
        closeLoginModal();
    }
});

function closeModal() {
    if (modal) modal.classList.remove("active");
}

if (search) search.addEventListener("input", applyFilter);

// Khởi tạo
updateAuthUI();
loadDataForCurrentUser();