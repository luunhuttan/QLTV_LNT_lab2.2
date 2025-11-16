-- BƯỚC 0: XÓA TOÀN BỘ DỮ LIỆU VÀ SCHEMA HIỆN TẠI (NẾU CÓ)
DROP DATABASE IF EXISTS library;

-- BƯỚC 1: TẠO LẠI CƠ SỞ DỮ LIỆU VÀ SỬ DỤNG
CREATE DATABASE library;
USE library;

-- BƯỚC 2: TẠO BẢNG SÁCH
CREATE TABLE books (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    pages INT NOT NULL,
    year_published INT NOT NULL,
    status INT NOT NULL, -- 0: có sẵn, 1: đã mượn, 2: trạng thái khác
    category VARCHAR(255) NOT NULL, -- Cho phép nhập tự do loại sách
    quantity INT NOT NULL DEFAULT 0 -- Số lượng tồn
);


-- BƯỚC 3: TẠO BẢNG THÀNH VIÊN
CREATE TABLE members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' -- active/inactive/banned
);

-- BƯỚC 4: TẠO BẢNG MƯỢN SÁCH
CREATE TABLE borrowing (
    borrowing_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    book_id INT NOT NULL,
    borrow_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE,
    FOREIGN KEY (member_id) REFERENCES members(member_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id)
);
-- KẾT THÚC: SCHEMA SẠCH ĐÃ SẴN SÀNG
select * from books;
select * from members;
select * from borrowing;

