class Book:
    def __init__(self, book_id, title, author, pages, year_published, status, category):
        self.book_id = book_id
        self.title = title
        self.author = author
        self.pages = pages
        self.year_published = year_published
        self.status = status
        self.category = category

    def __str__(self):
        st = {0: "có sẵn", 1: "đã mượn", 2: "khác"}.get(self.status, str(self.status))
        return f"[{self.book_id}] {self.title} - {self.author} | {self.pages} tr | {self.year_published} | {self.category} | {st}"

    # CREATE
    def add_book(self, db):
        query = """INSERT INTO books(title,author,pages,year_published,status,category)
               VALUES(%s,%s,%s,%s,%s,%s)"""
        db.execute_query(query,(self.title, self.author, self.pages, self.year_published, self.status, self.category))

    # UPDATE
    def update_book(self, db):
        query = """UPDATE books SET title=%s, author=%s, pages=%s, year_published=%s,
                      status=%s, category=%s WHERE book_id=%s"""
        db.execute_query(query, (self.title, self.author, self.pages, self.year_published, self.status, self.category, self.book_id))

    # DELETE
    def delete_book(self, db):
        check_query = "SELECT status FROM books WHERE book_id = %s"
        row = db.fetch_one(check_query, (self.book_id,))
        
        if not row:
            raise ValueError("Sách không tồn tại để xóa.")
        
        if row[0] == 1:
            raise ValueError("Không thể xóa. Sách này đang được mượn.")

        query = "DELETE FROM books WHERE book_id=%s"
        db.execute_query(query, (self.book_id,))
        
    # READ / SEARCH
    @staticmethod
    def get_all_books(db):
        return [Book(*row) for row in db.fetch_all("SELECT * FROM books")]

    #Tìm sách với id
    @staticmethod
    def search_by_id(db, book_id):
        query = "SELECT * FROM books WHERE book_id=%s"
        row = db.fetch_one(query, (book_id,))
        return Book(*row) if row else None

    #Tìm sách với title
    @staticmethod
    def search_by_title(db, title):
        query = "SELECT * FROM books WHERE title=%s"
        row = db.fetch_one(query, (title,))
        return Book(*row) if row else None

    # chỉnh sửa trọng thái 0 1 2
    @staticmethod
    def set_status(db, book_id, status):
        query = "UPDATE books SET status=%s WHERE book_id=%s"
        db.execute_query(query, (status, book_id))

    #Tìm kiếm sách theo từ khóa và trạng thái = 0
    @staticmethod
    def search_available_by_title_like(db,key_word):
        query = "SELECT * FROM books WHERE title LIKE %s AND status = 0"
        rows = db.fetch_all(query,(f"%{key_word}%",))
        return [Book(*i) for i in rows]

    #Tìm kiếm theo từ khóa
    @staticmethod
    def search_by_title_like(db,key_word):
        query = "SELECT * FROM books WHERE title LIKE %s"
        rows = db.fetch_all(query,(f"%{key_word}%",))
        return [Book(*i) for i in rows]
    