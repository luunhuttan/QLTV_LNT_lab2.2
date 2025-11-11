async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
}

function $(selector, root = document) {
    return root.querySelector(selector);
}

function populateTable(tbody, rows, renderRow) {
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = renderRow(row);
        frag.appendChild(tr);
    });
    tbody.appendChild(frag);
}

async function loadStats() {
    const stats = await fetchJSON('/api/stats');
    const buttons = document.querySelectorAll('.stats-container .stat-btn');
    if (buttons[0]) buttons[0].textContent = `Tổng sách: ${stats.total_books}`;
    if (buttons[1]) buttons[1].textContent = `Số Thành viên: ${stats.total_members}`;
    if (buttons[2]) buttons[2].textContent = `Đang mượn: ${stats.currently_borrowed}`;
    if (buttons[3]) buttons[3].textContent = `Trễ hạn: ${stats.overdue}`;
}

async function loadBorrowing() {
    const rows = await fetchJSON('/api/borrowing');
    const recentTBody = document.querySelectorAll('.content-block .data-table tbody')[0];
    populateTable(recentTBody, rows, (r) => `
        <td>${r.borrowing_id}</td>
        <td>${r.member_name}</td>
        <td>${r.book_title}</td>
        <td>${r.borrow_date ? new Date(r.borrow_date).toLocaleDateString() : ''}</td>
    `);

    // Upcoming due dates (simple reuse; mark status)
    const dueTBody = document.querySelectorAll('.content-block .data-table tbody')[1];
    const upcoming = rows.map(r => {
        const overdue = !r.return_date && r.due_date && new Date(r.due_date) < new Date();
        return {
            id: r.borrowing_id,
            book: r.book_title,
            status: r.return_date ? 'Đã trả' : (overdue ? 'Trễ hạn' : 'Đang mượn')
        };
    });
    populateTable(dueTBody, upcoming, (r) => `
        <td>${r.id}</td>
        <td>${r.book}</td>
        <td>${r.status}</td>
    `);
}

async function loadBooks() {
    const rows = await fetchJSON('/api/books');
    // store for click-to-edit
    window.booksById = {};
    rows.forEach(r => { window.booksById[r.book_id] = r; });
    const booksTBody = document.querySelectorAll('.content-block .data-table tbody')[2];
    populateTable(booksTBody, rows, (r) => `
        <td>${r.book_id}</td>
        <td>${r.author}</td>
        <td>${r.category}</td>
        <td>${typeof r.quantity === 'number' ? r.quantity : ''}</td>
    `);
    // add click-to-edit
    Array.from(booksTBody.querySelectorAll('tr')).forEach((tr, idx) => {
        const r = rows[idx];
        tr.classList.add('clickable-row');
        tr.dataset.bookId = r.book_id;
        tr.addEventListener('click', () => editBookPrefilled(r.book_id));
    });

    // Simple search by title/author
    const searchInput = $('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            const filtered = rows.filter(r =>
                (r.title || '').toLowerCase().includes(q) ||
                (r.author || '').toLowerCase().includes(q)
            );
            populateTable(booksTBody, filtered, (r) => `
                <td>${r.book_id}</td>
                <td>${r.author}</td>
                <td>${r.category}</td>
                <td>${typeof r.quantity === 'number' ? r.quantity : ''}</td>
            `);
            Array.from(booksTBody.querySelectorAll('tr')).forEach((tr, idx) => {
                const r = filtered[idx];
                tr.classList.add('clickable-row');
                tr.dataset.bookId = r.book_id;
                tr.addEventListener('click', () => editBookPrefilled(r.book_id));
            });
        });
    }
}

async function loadMembers() {
    const rows = await fetchJSON('/api/members');
    window.membersById = {};
    rows.forEach(r => { window.membersById[r.member_id] = r; });
    const membersTBody = document.querySelectorAll('.content-block .data-table tbody')[3];
    populateTable(membersTBody, rows, (r) => `
        <td>${r.member_id}</td>
        <td>${r.name}</td>
        <td>${r.email || ''}</td>
        <td>${r.status || ''}</td>
    `);
    Array.from(membersTBody.querySelectorAll('tr')).forEach((tr, idx) => {
        const r = rows[idx];
        tr.classList.add('clickable-row');
        tr.dataset.memberId = r.member_id;
        tr.addEventListener('click', () => editMemberPrefilled(r.member_id));
    });
}

async function init() {
    try {
        await Promise.all([loadStats(), loadBorrowing(), loadBooks(), loadMembers()]);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể tải dữ liệu từ backend. Vui lòng kiểm tra server.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', init);

// Toast helper
function toast(title, msg, type = 'success', timeoutMs = 2600) {
    const container = document.getElementById('toast-container');
    if (!container) return alert(`${title}: ${msg}`);
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<div class="title">${title}</div><div class="msg">${msg}</div>`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        setTimeout(() => container.removeChild(el), 300);
    }, timeoutMs);
}

// Add book flow
async function addBookFlow() {
    try {
        const title = prompt('Tiêu đề sách:');
        if (!title) return;
        const author = prompt('Tác giả:');
        if (!author) return;
        const pages = prompt('Số trang (number):');
        if (!pages) return;
        const year_published = prompt('Năm xuất bản (number):');
        if (!year_published) return;
        const category = prompt('Thể loại:');
        if (!category) return;
        const quantity = prompt('Số lượng (number, mặc định 0):') || '0';
        const status = 0; // 0: có sẵn

        const res = await fetch('/api/books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author, pages, year_published, category, quantity, status })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        toast('Thành công', 'Thêm sách thành công!', 'success');
        // reload books + stats
        await Promise.all([loadBooks(), loadStats()]);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể thêm sách: ' + e.message, 'error');
    }
}

const addBtn = document.querySelector('.add-book-btn');
if (addBtn) {
    addBtn.addEventListener('click', addBookFlow);
}

// Member flows
async function addMemberFlow() {
    try {
        const name = prompt('Họ tên thành viên:');
        if (!name) return;
        const email = prompt('Email (có thể bỏ trống):') || null;
        const status = 'active';
        const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, status })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'HTTP ' + res.status);
        alert('Thêm thành viên thành công!');
        await Promise.all([loadMembers(), loadStats()]);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể thêm thành viên: ' + e.message, 'error');
    }
}

async function deleteMemberFlow() {
    try {
        const id = prompt('Nhập ID thành viên cần xóa:');
        if (!id) return;
        const res = await fetch(`/api/members/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        toast('Thành công', 'Xóa thành viên thành công!', 'success');
        await loadMembers();
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể xóa thành viên: ' + e.message, 'error');
    }
}

// Borrow/Return flows
async function borrowFlow() {
    try {
        const member_id = prompt('ID thành viên:');
        if (!member_id) return;
        const book_id = prompt('ID sách:');
        if (!book_id) return;
        const days = prompt('Số ngày mượn (mặc định 7):') || '7';
        const res = await fetch('/api/borrow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id, book_id, days })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        toast('Thành công', 'Mượn sách thành công!', 'success');
        await Promise.all([loadBorrowing(), loadBooks(), loadStats()]);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể mượn sách: ' + e.message, 'error');
    }
}

async function returnFlow() {
    try {
        const borrowing_id = prompt('ID phiếu mượn cần trả:');
        if (!borrowing_id) return;
        const res = await fetch('/api/return', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ borrowing_id })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        toast('Thành công', 'Trả sách thành công!', 'success');
        await Promise.all([loadBorrowing(), loadBooks(), loadStats()]);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể trả sách: ' + e.message, 'error');
    }
}

const addMemberBtn = document.querySelector('.add-member-btn');
if (addMemberBtn) addMemberBtn.addEventListener('click', addMemberFlow);

const borrowBtn = document.querySelector('.borrow-btn');
if (borrowBtn) borrowBtn.addEventListener('click', borrowFlow);

const returnBtn = document.querySelector('.return-btn');
if (returnBtn) returnBtn.addEventListener('click', returnFlow);

// Optionally bind delete member to Ctrl+Delete via prompt
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Delete') {
        deleteMemberFlow();
    }
});

// Edit flows
async function editBookFlow() {
    try {
        const id = prompt('Nhập ID sách cần sửa:');
        if (!id) return;
        const title = prompt('Tiêu đề (để trống nếu không đổi):') || undefined;
        const author = prompt('Tác giả (để trống nếu không đổi):') || undefined;
        const pages = prompt('Số trang (để trống nếu không đổi):') || undefined;
        const year_published = prompt('Năm xuất bản (để trống nếu không đổi):') || undefined;
        const category = prompt('Thể loại (để trống nếu không đổi):') || undefined;
        const quantity = prompt('Số lượng (để trống nếu không đổi):') || undefined;
        const status = prompt('Trạng thái (0: có sẵn, 1: đã mượn, 2: khác) (để trống nếu không đổi):') || undefined;
        const payload = { title, author, pages, year_published, category, quantity, status };
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        if (Object.keys(payload).length === 0) {
            alert('Không có trường nào để cập nhật.');
            return;
        }
        const res = await fetch(`/api/books/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        toast('Thành công', 'Cập nhật sách thành công!', 'success');
        await Promise.all([loadBooks(), loadStats()]);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể sửa sách: ' + e.message, 'error');
    }
}

async function editBookPrefilled(id) {
    const r = (window.booksById || {})[id];
    if (!r) return editBookFlow(); // fallback to manual
    try {
        const title = prompt('Tiêu đề:', r.title ?? '') ?? r.title;
        const author = prompt('Tác giả:', r.author ?? '') ?? r.author;
        const pages = prompt('Số trang:', r.pages ?? '') ?? r.pages;
        const year_published = prompt('Năm xuất bản:', r.year_published ?? '') ?? r.year_published;
        const category = prompt('Thể loại:', r.category ?? '') ?? r.category;
        const quantity = prompt('Số lượng:', r.quantity ?? '') ?? r.quantity;
        const status = prompt('Trạng thái (0: có sẵn, 1: đã mượn, 2: khác):', r.status ?? 0) ?? r.status;
        const payload = { title, author, pages, year_published, category, quantity, status };
        const res = await fetch(`/api/books/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        alert('Cập nhật sách thành công!');
        await Promise.all([loadBooks(), loadStats()]);
    } catch (e) {
        console.error(e);
        alert('Không thể sửa sách: ' + e.message);
    }
}

async function editMemberFlow() {
    try {
        const id = prompt('Nhập ID thành viên cần sửa:');
        if (!id) return;
        const name = prompt('Họ tên (để trống nếu không đổi):') || undefined;
        const email = prompt('Email (để trống nếu không đổi):') || undefined;
        const status = prompt('Trạng thái (active/inactive/banned) (để trống nếu không đổi):') || undefined;
        const payload = { name, email, status };
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        if (Object.keys(payload).length === 0) {
            alert('Không có trường nào để cập nhật.');
            return;
        }
        const res = await fetch(`/api/members/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        toast('Thành công', 'Cập nhật thành viên thành công!', 'success');
        await loadMembers();
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể sửa thành viên: ' + e.message, 'error');
    }
}

async function editMemberPrefilled(id) {
    const r = (window.membersById || {})[id];
    if (!r) return editMemberFlow();
    try {
        const name = prompt('Họ tên:', r.name ?? '') ?? r.name;
        const email = prompt('Email:', r.email ?? '') ?? r.email;
        const status = prompt('Trạng thái (active/inactive/banned):', r.status ?? 'active') ?? r.status;
        const payload = { name, email, status };
        const res = await fetch(`/api/members/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        alert('Cập nhật thành viên thành công!');
        await loadMembers();
    } catch (e) {
        console.error(e);
        alert('Không thể sửa thành viên: ' + e.message);
    }
}

const editBookBtn = document.querySelector('.edit-book-btn');
if (editBookBtn) editBookBtn.addEventListener('click', editBookFlow);

const editMemberBtn = document.querySelector('.edit-member-btn');
if (editMemberBtn) editMemberBtn.addEventListener('click', editMemberFlow);


