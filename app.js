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
    rows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = renderRow(row, idx);
        frag.appendChild(tr);
    });
    tbody.appendChild(frag);
}

let booksCache = [];
let booksSearchTimer = null;
let searchInputInitialized = false;

function updateBooksMap(rows) {
    window.booksById = window.booksById || {};
    rows.forEach(r => {
        if (r && typeof r.book_id !== 'undefined') {
            window.booksById[r.book_id] = r;
        }
    });
}

function renderBooksTable(rows) {
    const tables = document.querySelectorAll('.content-block .data-table tbody');
    const booksTBody = tables[2];
    if (!booksTBody) return;

    populateTable(booksTBody, rows, (r, idx) => `
        <td>${idx + 1}</td>
        <td>${r.book_id}</td>
        <td>${r.title || ''}</td>
        <td>${r.author}</td>
        <td>${r.category}</td>
        <td>${typeof r.quantity === 'number' ? r.quantity : ''}</td>
    `);

    Array.from(booksTBody.querySelectorAll('tr')).forEach((tr, idx) => {
        const r = rows[idx];
        if (!r) return;
        tr.classList.add('clickable-row');
        tr.dataset.bookId = r.book_id;
        tr.addEventListener('click', () => editBookPrefilled(r.book_id));
    });
}

async function searchAndRenderBooks(query, { silent = true } = {}) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
        renderBooksTable(booksCache);
        return booksCache;
    }

    try {
        const numeric = /^\d+$/.test(trimmed);
        if (numeric) {
            const local = window.booksById ? window.booksById[Number(trimmed)] : undefined;
            if (local) {
                renderBooksTable([local]);
                return [local];
            }
        } else if (booksCache.length) {
            const lower = trimmed.toLowerCase();
            const localMatches = booksCache.filter(r =>
                (r.title || '').toLowerCase().includes(lower) ||
                (r.author || '').toLowerCase().includes(lower) ||
                (r.category || '').toLowerCase().includes(lower)
            );
            if (localMatches.length) {
                renderBooksTable(localMatches);
                return localMatches;
            }
        }

        if (numeric) {
            const result = await fetchJSON(`/api/books/search/id/${encodeURIComponent(trimmed)}`);
            const rows = result ? [result] : [];
            updateBooksMap(rows);
            renderBooksTable(rows);
            if (!rows.length && !silent) {
                toast('Thông báo', 'Không tìm thấy sách với ID này.', 'info');
            }
            return rows;
        }

        const rows = await fetchJSON(`/api/books/search/keyword?keyword=${encodeURIComponent(trimmed)}`);
        updateBooksMap(rows);
        renderBooksTable(rows);
        if (!rows.length && !silent) {
            toast('Thông báo', 'Không tìm thấy sách nào khớp với từ khóa.', 'info');
        }
        return rows;
    } catch (e) {
        console.error(e);
        if (!silent) {
            toast('Lỗi', 'Không thể tìm kiếm sách: ' + e.message, 'error');
        }
        return [];
    }
}

function setupSearchInput() {
    if (searchInputInitialized) return;
    const searchInput = $('.search-input');
    if (!searchInput) return;
    searchInputInitialized = true;

    searchInput.addEventListener('input', () => {
        clearTimeout(booksSearchTimer);
        booksSearchTimer = setTimeout(() => {
            const value = searchInput.value.trim();
            if (!value) {
                renderBooksTable(booksCache);
            } else {
                searchAndRenderBooks(value, { silent: true });
            }
        }, 250);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchAndRenderBooks(searchInput.value, { silent: false });
        } else if (e.key === 'Escape') {
            searchInput.value = '';
            renderBooksTable(booksCache);
        }
    });
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
    booksCache = rows;
    updateBooksMap(rows);
    renderBooksTable(rows);

    const searchInput = $('.search-input');
    if (searchInput && searchInput.value.trim()) {
        await searchAndRenderBooks(searchInput.value.trim(), { silent: true });
    }
}

async function loadMembers() {
    const rows = await fetchJSON('/api/members');
    window.membersById = {};
    rows.forEach(r => { window.membersById[r.member_id] = r; });
    const membersTBody = document.querySelectorAll('.content-block .data-table tbody')[3];
    populateTable(membersTBody, rows, (r, idx) => `
        <td>${idx + 1}</td>
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
        setupSearchInput();
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
        const member_id = prompt('ID thành viên:');
        if (!member_id) return;
        
        // Get currently borrowed books for this member
        const res = await fetch(`/api/members/${encodeURIComponent(member_id)}/currently-borrowed`);
        const borrowedBooks = await res.json();
        if (!res.ok) throw new Error(borrowedBooks.error || 'HTTP ' + res.status);
        
        if (!borrowedBooks || borrowedBooks.length === 0) {
            alert('Thành viên này không có sách nào đang mượn.');
            return;
        }
        
        // Show list of borrowed books
        let msg = '== Các sách bạn đang mượn: ==\n\n';
        borrowedBooks.forEach((b, idx) => {
            msg += ` - [${b.book_id}] ${b.title} - ${b.author}\n`;
        });
        msg += '\nNhập ID sách bạn muốn trả:';
        
        const book_id = prompt(msg);
        if (!book_id) return;
        
        const bookIdNum = parseInt(book_id);
        const validBookIds = borrowedBooks.map(b => b.book_id);
        if (!validBookIds.includes(bookIdNum)) {
            alert('Lỗi: Bạn không mượn sách có ID này.');
            return;
        }
        
        const returnRes = await fetch('/api/return', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: parseInt(member_id), book_id: bookIdNum })
        });
        const data = await returnRes.json().catch(() => ({}));
        if (!returnRes.ok) throw new Error(data.error || 'HTTP ' + returnRes.status);
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

// Delete book flow
async function deleteBookFlow() {
    try {
        const id = prompt('Nhập ID sách cần xóa:');
        if (!id) return;
        if (!confirm(`Bạn có chắc chắn muốn xóa sách có ID ${id}?`)) return;
        const res = await fetch(`/api/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
        toast('Thành công', 'Xóa sách thành công!', 'success');
        await Promise.all([loadBooks(), loadStats()]);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể xóa sách: ' + e.message, 'error');
    }
}

// Search book flow
async function searchBookFlow() {
    try {
        const choice = prompt('Chọn kiểu tìm:\na) Theo ID\nb) Theo tiêu đề chính xác\nc) Theo từ khóa');
        if (!choice) return;
        const opt = choice.trim().toLowerCase();

        if (opt === 'a') {
            const id = prompt('Nhập ID sách:');
            if (!id) return;
            const rows = await searchAndRenderBooks(id, { silent: false });
            if (rows.length === 1) {
                const b = rows[0];
                alert(`Tìm thấy:\nID: ${b.book_id}\nTiêu đề: ${b.title}\nTác giả: ${b.author}\nSố trang: ${b.pages}\nNăm XB: ${b.year_published}\nThể loại: ${b.category}\nTrạng thái: ${b.status === 0 ? 'Có sẵn' : b.status === 1 ? 'Đã mượn' : 'Khác'}`);
            }
        } else if (opt === 'b') {
            const title = prompt('Nhập tiêu đề chính xác:');
            if (!title) return;
            const res = await fetchJSON(`/api/books/search/title?title=${encodeURIComponent(title)}`);
            if (!res) {
                alert('Không tìm thấy sách với tiêu đề này.');
                return;
            }
            updateBooksMap([res]);
            renderBooksTable([res]);
            alert(`Tìm thấy:\nID: ${res.book_id}\nTiêu đề: ${res.title}\nTác giả: ${res.author}\nSố trang: ${res.pages}\nNăm XB: ${res.year_published}\nThể loại: ${res.category}\nTrạng thái: ${res.status === 0 ? 'Có sẵn' : res.status === 1 ? 'Đã mượn' : 'Khác'}`);
        } else if (opt === 'c') {
            const keyword = prompt('Nhập từ khóa:');
            if (!keyword) return;
            const rows = await searchAndRenderBooks(keyword, { silent: false });
            if (rows.length) {
                let msg = `Tìm thấy ${rows.length} sách:\n\n`;
                rows.forEach(b => {
                    msg += `[${b.book_id}] ${b.title} - ${b.author}\n`;
                });
                alert(msg);
            }
        } else {
            alert('Lựa chọn không hợp lệ.');
        }
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể tìm kiếm sách: ' + e.message, 'error');
    }
}

// Search member flow
async function searchMemberFlow() {
    try {
        const choice = prompt('Chọn kiểu tìm:\na) Theo ID\nb) Theo tên');
        if (!choice) return;
        const choiceLower = choice.trim().toLowerCase();
        let result;
        
        if (choiceLower === 'a') {
            const id = prompt('Nhập ID thành viên:');
            if (!id) return;
            const res = await fetch(`/api/members/search/id/${encodeURIComponent(id)}`);
            result = await res.json();
            if (!res.ok) throw new Error(result.error || 'HTTP ' + res.status);
            if (!result) {
                alert('Không tìm thấy thành viên với ID này.');
                return;
            }
            alert(`Tìm thấy:\nID: ${result.member_id}\nTên: ${result.name}\nEmail: ${result.email || 'N/A'}\nTrạng thái: ${result.status || 'N/A'}`);
        } else if (choiceLower === 'b') {
            const keyword = prompt('Nhập từ khóa tên:');
            if (!keyword) return;
            const res = await fetch(`/api/members/search/name?keyword=${encodeURIComponent(keyword)}`);
            const results = await res.json();
            if (!res.ok) throw new Error(results.error || 'HTTP ' + res.status);
            if (!results || results.length === 0) {
                alert('Không tìm thấy thành viên nào khớp với từ khóa.');
                return;
            }
            let msg = `Tìm thấy ${results.length} thành viên:\n\n`;
            results.forEach(m => {
                msg += `[${m.member_id}] ${m.name}${m.email ? ' - ' + m.email : ''}\n`;
            });
            alert(msg);
        } else {
            alert('Lựa chọn không hợp lệ.');
        }
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể tìm kiếm thành viên: ' + e.message, 'error');
    }
}

// Overdue books flow
async function overdueBooksFlow() {
    try {
        const rows = await fetchJSON('/api/overdue');
        if (!rows || rows.length === 0) {
            alert('Không có sách quá hạn.');
            return;
        }
        let msg = `== DANH SÁCH QUÁ HẠN (${rows.length} sách) ==\n\n`;
        rows.forEach(r => {
            msg += `TV [${r.member_id}] ${r.member_name} | Sách [${r.book_id}] ${r.title}\n`;
            msg += `  Mượn: ${r.borrow_date} | Hạn: ${r.due_date} | Trễ: ${r.days_overdue} ngày\n\n`;
        });
        alert(msg);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể tải danh sách sách quá hạn: ' + e.message, 'error');
    }
}

// Member history flow
async function memberHistoryFlow() {
    try {
        const member_id = prompt('Nhập ID thành viên:');
        if (!member_id) return;
        const res = await fetch(`/api/members/search/id/${encodeURIComponent(member_id)}`);
        const member = await res.json();
        if (!res.ok || !member) {
            alert('Không tìm thấy thành viên với ID này.');
            return;
        }
        const history = await fetchJSON(`/api/members/${encodeURIComponent(member_id)}/history`);
        if (!history || history.length === 0) {
            alert(`Thành viên [${member_id}] ${member.name} chưa mượn sách nào.`);
            return;
        }
        let msg = `== Lịch sử mượn của TV [${member_id}] ${member.name} ==\n\n`;
        history.forEach(h => {
            msg += `Sách: ${h.title} - ${h.author}\n`;
            msg += `  Ngày mượn: ${h.borrow_date}`;
            if (h.return_date) {
                msg += ` | Đã trả: ${h.return_date}\n`;
            } else {
                msg += ` | Đang mượn (Hạn: ${h.due_date})\n`;
            }
            msg += '\n';
        });
        alert(msg);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể tải lịch sử mượn: ' + e.message, 'error');
    }
}

// Currently borrowed report flow
async function currentlyBorrowedFlow() {
    try {
        const rows = await fetchJSON('/api/currently-borrowed');
        if (!rows || rows.length === 0) {
            alert('Không có sách nào đang được mượn.');
            return;
        }
        let msg = `== DANH SÁCH TẤT CẢ SÁCH ĐANG ĐƯỢC MƯỢN (${rows.length} sách) ==\n\n`;
        rows.forEach(r => {
            msg += `Sách: ${r.title}\n`;
            msg += `  Người mượn: ${r.member_name}\n`;
            msg += `  Mượn từ: ${r.borrow_date} | Hạn trả: ${r.due_date}\n\n`;
        });
        alert(msg);
    } catch (e) {
        console.error(e);
        toast('Lỗi', 'Không thể tải báo cáo: ' + e.message, 'error');
    }
}

// Bind new buttons
const deleteBookBtn = document.querySelector('.delete-book-btn');
if (deleteBookBtn) deleteBookBtn.addEventListener('click', deleteBookFlow);

const searchBookBtn = document.querySelector('.search-book-btn');
if (searchBookBtn) searchBookBtn.addEventListener('click', searchBookFlow);

const deleteMemberBtn = document.querySelector('.delete-member-btn');
if (deleteMemberBtn) deleteMemberBtn.addEventListener('click', deleteMemberFlow);

const searchMemberBtn = document.querySelector('.search-member-btn');
if (searchMemberBtn) searchMemberBtn.addEventListener('click', searchMemberFlow);

const overdueBtn = document.querySelector('.overdue-btn');
if (overdueBtn) overdueBtn.addEventListener('click', overdueBooksFlow);

const historyBtn = document.querySelector('.history-btn');
if (historyBtn) historyBtn.addEventListener('click', memberHistoryFlow);

const reportBtn = document.querySelector('.report-btn');
if (reportBtn) reportBtn.addEventListener('click', currentlyBorrowedFlow);


