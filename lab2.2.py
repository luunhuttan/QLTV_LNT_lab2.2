from database import Database
from book import Book
from member import Member
from borrowing import Borrowing
from datetime import date, timedelta

#Hàm trợ giúp để nhập chuỗi không rỗng
def get_string_input(prompt, min_length=2, require_alpha_start=False):
    """
    Hiển thị 'prompt' và yêu cầu người dùng nhập.
    Lặp lại cho đến khi người dùng nhập một chuỗi
    1. Không rỗng
    2. Có độ dài ít nhất min_length
    3. Không chỉ chứa số
    4. (Tùy chọn) Phải bắt đầu bằng một chữ cái khi require_alpha_start=True
    """
    while True:
        user_input = input(prompt).strip()
        
        if not user_input: # 1. Kiểm tra rỗng
            print("Lỗi: Thông tin này không được để trống. Vui lòng nhập lại.")
            continue 

        if len(user_input) < min_length: # 2. Kiểm tra độ dài tối thiểu
            print(f"Lỗi: Phải có ít nhất {min_length} ký tự. Vui lòng nhập lại.")
            continue 
        
        if user_input.isdigit(): # 3. Kiểm tra chỉ chứa số
            print("Lỗi: Thông tin này không thể chỉ chứa số. Vui lòng nhập lại.")
            continue
            
        # 4. KIỂM TRA MỚI (tuỳ chọn): Ký tự đầu tiên phải là chữ cái
        # (isalpha() hoạt động tốt với cả tiếng Việt có dấu)
        if require_alpha_start and not user_input[0].isalpha():
            print("Lỗi: Thông tin này phải bắt đầu bằng một chữ cái. Vui lòng nhập lại.")
            continue

        return user_input # Trả về nếu mọi thứ đều ổn

#Hàm bổ trợ cho người dùng nhập int
def get_safe_int_input(prompt):
    while True:
        user_input = input(prompt).strip()
        try:
            value = int(user_input)
            return value
        except ValueError:
            print("Lỗi: vui lòng chỉ nhập một số nguyên.")

# Thêm hàm này vào khu vực hàm trợ giúp
def get_integer_in_range(prompt, valid_options):
    """
    Yêu cầu người dùng nhập một số nguyên cho đến khi
    số đó nằm trong 'valid_options' (một list).
    """
    while True:
        # Dùng lại hàm get_safe_int_input bạn đã viết
        value = get_safe_int_input(prompt) 
        
        if value in valid_options:
            return value # Trả về nếu số nằm trong danh sách
        else:
            # Số hợp lệ, nhưng không nằm trong phạm vi
            print(f"Lỗi: Vui lòng chỉ chọn một trong các giá trị: {valid_options}")

def get_integer_with_min_max(prompt, min_val=None, max_val=None):
    """
    Hiển thị 'prompt' và yêu cầu người dùng nhập một số nguyên.
    Lặp lại cho đến khi số đó nằm trong khoảng [min_val, max_val].
    """
    while True:
        # Chúng ta dùng lại hàm get_integer_input cũ để lấy số
        value = get_safe_int_input(prompt) 
        
        # Kiểm tra giới hạn dưới
        if min_val is not None and value < min_val:
            print(f"Lỗi: Giá trị phải lớn hơn hoặc bằng {min_val}.")
            continue # Yêu cầu nhập lại

        # Kiểm tra giới hạn trên
        if max_val is not None and value > max_val:
            print(f"Lỗi: Giá trị phải nhỏ hơn hoặc bằng {max_val}.")
            continue # Yêu cầu nhập lại
        
        return value 

#Hiển thị ds Boo
def print_books(books):
    if not books:
        print("Không có sách phù hợp.")
    else:
        for b in books:
            print(" -", b)

#Hiển thị danh sách sinh viên
def print_members(members):
    if not members:
        print("Không có thành viên phù hợp.")
    else:
        for m in members:
            print(" -", m)


def main():
    db = Database()

    while True:
        print("==============Menu===============")
        print("HỆ THỐNG QUẢN LÝ THƯ VIỆN")
        print("1. Thêm sách")
        print("2. Sửa thông tin sách")
        print("3. Xóa sách")
        print("4. Tìm kiếm sách")
        print("5. Hiển thị tất cả sách")
        print("6. Thêm thành viên")
        print("7. Sửa thông tin thành viên")
        print("8. Xóa thành viên")
        print("9. Tìm kiếm thành viên")
        print("10. Hiển thị tất cả thành viên")
        print("11. Mượn sách")
        print("12. Trả sách")
        print("13. Hiển thị sách quá hạn (kèm người mượn)")
        print("14. Xem lịch sử mượn của thành viên")
        print("15. Báo cáo sách đang được mượn")
        print("0. Thoát")
        print("====================================")

        choice = input("Chọn chức năng: ").strip()

        if choice == "1":
            title = get_string_input("Tên sách: ").strip()
            author = get_string_input("Tác giả: ").strip()
            pages = get_integer_with_min_max("Số trang: ",min_val= 10)#Change 03/11/2025
            current_year = date.today().year
            year = get_integer_with_min_max("Năm xuất bản: ",min_val=1500,max_val=current_year)#Change 03/11/2025
            category = get_string_input("Chủng loại: ")
            status = get_integer_in_range("Trạng thái (0: có sẵn, 1: đã mượn, 2: khác): ",[0,1,2])#change 03/11/2025
            Book(None, title, author, pages, year, status, category).add_book(db)
            print("Đã thêm sách.")

        elif choice == "2":
            book_id = get_safe_int_input("ID sách cần sửa: ")
            check_book_id = Book.search_by_id(db, book_id)
            if not check_book_id:
                print("Không tìm thấy sách.")
            else:
                print("Hiện tại:", check_book_id)
                title = get_string_input("Tên mới: ")
                author = get_string_input("Tác giả mới: ")
                pages = get_integer_with_min_max("Số trang mới: ",min_val=100)
                year = get_integer_with_min_max("Năm XB mới: ",min_val=1500,max_val=current_year)
                status = get_integer_in_range("Trạng thái mới (0/1/2): ",[0,1,2])
                category = get_string_input("Chủng loại mới: ")
                Book(book_id, title, author, pages, year, status, category).update_book(db)
                print("Đã cập nhật.")

        elif choice == "3":
            book_id = get_safe_int_input("ID sách cần xóa: ")
            check_book_id = Book.search_by_id(db, book_id)
            try:
                book_to_delete = Book(book_id, None, None, None, None, None, None)
                book_to_delete.delete_book(db)
                print("Đã xóa sách.")
            except ValueError as e:
                    print(f"Lỗi {e}")
                    
        elif choice == "4":
            print(" a) Theo ID")
            print(" b) Theo tiêu đề")
            print(" c) Theo từ khóa")
            choice = input("Chọn kiểu tìm: ").strip().lower()
            if choice == "a":
                book_id = get_safe_int_input("Nhập ID: ")
                check_book_id = Book.search_by_id(db, book_id)
                print(check_book_id if check_book_id else "Không thấy.")
            elif choice == "b":
                title = get_string_input("Nhập tiêu đề chính xác: ").strip()
                check_book_id = Book.search_by_title(db, title)
                print(check_book_id if check_book_id else "Không thấy.")
            elif choice == "c":
                key_word = get_string_input("Nhập từ khóa sách: ")
                books_found = Book.search_by_title_like(db,key_word)
                print_books(books_found)
            else:
                print("Lựa chọn không hợp lệ.")

        elif choice == "5":
            print_books(Book.get_all_books(db))

        elif choice == "6":
            name = get_string_input("Tên thành viên: ", require_alpha_start=True).strip()
            Member(None, name).add_member(db)
            print("Đã thêm thành viên.")

        elif choice == "7":
            member_id = get_safe_int_input("ID thành viên cần sửa: ")
            check_member_id = Member.search_by_id(db, member_id)
            if not check_member_id:
                print("Không tìm thấy thành viên.")
            else:
                print("Hiện tại:", check_member_id)
                new_name = get_string_input("Tên mới: ", require_alpha_start=True)
                Member(member_id, new_name).update_member_info(db)
                print("Đã cập nhật.")

        elif choice == "8":
            member_id = get_safe_int_input("ID thành viên cần xóa: ")
            check_member_id = Member.search_by_id(db, member_id)
            if not check_member_id:
                print("Không tìm thấy thành viên.")
            else:
                try:
                    Member(member_id, None).delete_member(db)
                    print("Đã xóa thành viên.")
                except ValueError as e:
                    print(f"Lỗi{e}")

        elif choice == "9":
            print(" a) Theo ID")
            print(" b) Theo tên")
            choice = input("Chọn kiểu tìm: ").strip().lower()
            if choice == "a":
                member_id = get_safe_int_input("Nhập ID: ")
                check_member_id = Member.search_by_id(db, member_id)
                print(check_member_id if check_member_id else "Không thấy.")
            elif choice == "b":
                key_word = get_string_input("Nhập từ khóa tên: ").strip()
                check_member_id = Member.search_by_name_like(db, key_word)
                print_members(check_member_id)
            else:
                print("Lựa chọn không hợp lệ.")

        elif choice == "10":
            print_members(Member.get_all_members(db))

        elif choice == "11": 
            member_id = get_safe_int_input("ID thành viên: ")
            
            keyword = get_string_input("Nhập từ khóa tên sách cần mượn: ")
            available_books = Book.search_available_by_title_like(db, keyword)
            
            if not available_books:
                print("Không tìm thấy sách nào 'có sẵn' khớp với từ khóa.")
                continue

            print("== Các sách 'có sẵn' tìm thấy: ==")
            valid_book_ids = [] 
            for book in available_books:
                print(f" - [{book.book_id}] {book.title} - {book.author}")
                valid_book_ids.append(book.book_id)

            book_id_to_borrow = get_safe_int_input("Nhập ID sách bạn muốn mượn: ")
            

            if book_id_to_borrow not in valid_book_ids:
                print("Lỗi: ID sách không hợp lệ.")
                continue
                

            borrow_date = date.today()
            due_date = borrow_date + timedelta(days=14)
            try:
                Borrowing(None, member_id, book_id_to_borrow, borrow_date, due_date).borrow_book(db)
                print(f"Mượn thành công. Hạn trả: {due_date:%Y-%m-%d}")
            except ValueError as Errorr:
                print(Errorr)

        elif choice == "12":
            member_id = get_safe_int_input("ID thành viên: ")
            borrowed_books = Borrowing.get_currently_borrowed_by_member(db, member_id)
            
            if not borrowed_books:
                print("Thành viên này không có sách nào đang mượn.")
                continue


            print("== Các sách bạn đang mượn: ==")
            valid_book_ids = [] 
            for book_id, title, author in borrowed_books:
                print(f" - [{book_id}] {title} - {author}")
                valid_book_ids.append(book_id)

            book_id_to_return = get_safe_int_input("Nhập ID sách bạn muốn trả: ")
            
            if book_id_to_return not in valid_book_ids:
                print("Lỗi: Bạn không mượn sách có ID này.")
                continue

            try:
                Borrowing(None, member_id, book_id_to_return, None, None, return_date=date.today()).return_book(db)
                print("Trả sách thành công.")
            except ValueError as e:
                print("Lỗi", e)

        elif choice == "13":
            rows = Borrowing.get_overdue_books(db)
            if not rows:
                print("Không có sách quá hạn.")
            else:
                print("== DANH SÁCH QUÁ HẠN ==")
                for member_id, name, book_id, title, borrow_date, due_date, days in rows:
                    print(f"- TV [{member_id}] {name} | Sách [{book_id}] {title} | Mượn {borrow_date} | Hạn {due_date} | Trễ {days} ngày")

        elif choice == "14":
            member_id = get_safe_int_input("Nhập ID thành viên: ")
            check_member_id = Member.search_by_id(db,member_id)
            if not check_member_id:
                print("Lỗi: Không thấy thành viên.")
                continue

            history = Borrowing.get_history_by_member(db,member_id)
            if not history:
                print(f"Thành viên[{member_id}] {check_member_id.name} chưa mượn sách nào ")
            else:
                print(f"== Lịch sử mượn của TV [{member_id}] {check_member_id.name} ==")
                for title,author,borrow_date,due_date,return_date in history:
                    if return_date:
                        status = f"Đã trả: {return_date}"
                    else:
                        status = f"Đang mượn (Hạn: {due_date})"
                    
                    print(f"- Sách: {title} - {author}")
                    print(f"  Ngày mượn: {borrow_date} | {status}")
            
        elif choice == "15": # Đổi từ 16 sang 15
            borrowed_books = Borrowing.get_all_currently_borrowed(db)
            if not borrowed_books:
                print("Không có sách nào đang được mượn.")
            else:
                print("== DANH SÁCH TẤT CẢ SÁCH ĐANG ĐƯỢC MƯỢN ==")
                for name, title, borrow_date, due_date in borrowed_books:
                    print(f"- Sách: {title}")
                    print(f"  Người mượn: {name}")
                    print(f"  Mượn từ: {borrow_date} | Hạn trả: {due_date}")
        
            
        elif choice == "0":
            print("Tạm biệt")
            break

        else:
            print(f"Vẫn chưa chưa có chức năng {choice}. Vui lòng nhập lại")

if __name__ == "__main__":
    main()
