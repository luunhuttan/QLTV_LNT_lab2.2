from datetime import date

class Borrowing:
    def __init__(self, borrowing_id, member_id, book_id, borrow_date, due_date, return_date=None):
        self.borrowing_id = borrowing_id
        self.member_id = member_id
        self.book_id = book_id
        self.borrow_date = borrow_date
        self.due_date = due_date
        self.return_date = return_date

    # Mượn sách
    def borrow_book(self, db):
        #1) Check member tồn tại?
        check_query_member_id = "SELECT 1 FROM members WHERE member_id=%s"
        if not db.fetch_one(check_query_member_id, (self.member_id,)):
            raise ValueError("Thành viên không tồn tại.")
        #2) Check sách tồn tại + có sẵn?
        check_query_book_id = "SELECT status FROM books WHERE book_id=%s"
        row = db.fetch_one(check_query_book_id, (self.book_id,))
        if not row:
            raise ValueError("Sách không tồn tại.")
        if row[0] != 0:
            raise ValueError("Sách không ở trạng thái 'có sẵn'.")

        #3) Cập nhật sách mượn vào table borrowing
        query_borrowing = "INSERT INTO borrowing(member_id,book_id,borrow_date,due_date,return_date) VALUES (%s,%s,%s,%s,%s)"
        db.execute_query(query_borrowing, (self.member_id, self.book_id, self.borrow_date, self.due_date, self.return_date))
    
        #4) Cập nhật status
        query_book_starus = "UPDATE books SET status=1 WHERE book_id=%s"
        db.execute_query(query_book_starus, (self.book_id,))

    # Trả sách
    def return_book(self, db):
        query = """
            SELECT borrowing_id FROM borrowing
            WHERE member_id=%s AND book_id=%s AND return_date IS NULL
            ORDER BY borrow_date DESC LIMIT 1
            """
        row = db.fetch_one(query, (self.member_id, self.book_id))
        if not row:
            raise ValueError("Không có giao dịch mượn mở để trả.")
        
        found_borrowing_id = row[0]
        #Cập nhật ngày trả sách
        query_book_day_return = "UPDATE borrowing SET return_date=%s WHERE borrowing_id=%s"
        db.execute_query(query_book_day_return, (self.return_date, found_borrowing_id))
        #update status của book đã trả
        query_book_status = "UPDATE books SET status=0 WHERE book_id=%s"
        db.execute_query(query_book_status, (self.book_id,))

    # Danh sách quá hạn (kèm người mượn)
    @staticmethod
    def get_overdue_books(db):
        today = date.today()
        query = """
            SELECT m.member_id, m.name, b.book_id, b.title,
                   bo.borrow_date, bo.due_date, DATEDIFF(%s, bo.due_date) AS days_over
            FROM borrowing bo
            JOIN books b   ON b.book_id   = bo.book_id
            JOIN members m ON m.member_id = bo.member_id
            WHERE bo.return_date IS NULL AND bo.due_date < %s
            ORDER BY days_over DESC
        """
        return db.fetch_all(query, (today, today))
    
    @staticmethod
    def get_currently_borrowed_by_member(db, member_id):
        query = """
            SELECT b.book_id, b.title, b.author
            FROM borrowing bo
            JOIN books b ON b.book_id = bo.book_id
            WHERE bo.member_id = %s AND bo.return_date IS NULL
        """
        return db.fetch_all(query, (member_id,))
    
    @staticmethod
    def get_history_by_member(db,member_id):
        query = """
            SELECT b.title, b.author, bo.borrow_date, bo.due_date, bo.return_date
            FROM borrowing bo
            JOIN books b ON b.book_id = bo.book_id
            WHERE bo.member_id = %s
            ORDER BY bo.borrow_date DESC
        """
        return db.fetch_all(query, (member_id,))
    
    @staticmethod
    def get_all_currently_borrowed(db):
        """
        Lấy TẤT CẢ sách đang được mượn (chưa trả)
        """
        query = """
            SELECT m.name, b.title, bo.borrow_date, bo.due_date
            FROM borrowing bo
            JOIN books b ON b.book_id = bo.book_id
            JOIN members m ON m.member_id = bo.member_id
            WHERE bo.return_date IS NULL
            ORDER BY bo.due_date ASC
        """
        return db.fetch_all(query)