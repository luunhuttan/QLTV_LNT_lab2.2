
---

# 📖 Hệ thống Quản lý Thư viện (Console Application)

Đây là một dự án ứng dụng console bằng Python để quản lý một hệ thống thư viện cơ bản. Dự án này bao gồm các chức năng cốt lõi như quản lý Sách, Thành viên và các giao dịch Mượn/Trả sách, đồng thời tập trung mạnh vào việc **xác thực dữ liệu** và đảm bảo **logic nghiệp vụ** vững chắc.

## ✨ Các Tính năng Chính

Hệ thống cung cấp 15 chức năng chính, được chia thành 3 nhóm:

### 1. Quản lý Sách (Book)
* **1. Thêm sách:** Thêm một cuốn sách mới vào cơ sở dữ liệu.
* **2. Sửa thông tin sách:** Cập nhật chi tiết của một cuốn sách (dựa trên ID).
* **3. Xóa sách:** Xóa một cuốn sách khỏi cơ sở dữ liệu (dựa trên ID).
* **4. Tìm kiếm sách:** Tìm sách theo ID, Tiêu đề chính xác, hoặc Từ khóa (LIKE).
* **5. Hiển thị tất cả sách:** Liệt kê toàn bộ sách trong thư viện.

### 2. Quản lý Thành viên (Member)
* **6. Thêm thành viên:** Thêm thành viên mới.
* **7. Sửa thông tin thành viên:** Cập nhật tên thành viên (dựa trên ID).
* **8. Xóa thành viên:** Xóa một thành viên (dựa trên ID).
* **9. Tìm kiếm thành viên:** Tìm thành viên theo ID hoặc Tên (LIKE).
* **10. Hiển thị tất cả thành viên:** Liệt kê toàn bộ thành viên.

### 3. Quản lý Mượn/Trả (Borrowing)
* **11. Mượn sách:** Quy trình mượn sách thân thiện với người dùng (Tìm theo tên, Mượn bằng ID).
* **12. Trả sách:** Quy trình trả sách thông minh (Hiển thị sách đang mượn, Trả bằng ID).
* **13. Hiển thị sách quá hạn:** Báo cáo các sách đã quá hạn trả (kèm người mượn).
* **14. Xem lịch sử mượn của thành viên:** Xem toàn bộ lịch sử (đã trả và đang mượn) của một thành viên.
* **15. Báo cáo sách đang được mượn:** Báo cáo *tất cả* các sách đang lưu hành (chưa trả).

---

## 🛠️ Các Hàm Bổ Trợ & Logic Cải Tiến

Phần quan trọng nhất của dự án này là cách chúng ta xử lý đầu vào của người dùng và các quy tắc nghiệp vụ.

### 1. Tại sao chúng ta xây dựng các hàm bổ trợ?

Ban đầu, chúng ta dùng `input()` và `int()` trực tiếp.

* **Vấn đề:** Điều này gây ra 2 lỗi nghiêm trọng:
    1.  **Crash chương trình:** Nếu người dùng nhập chữ (ví dụ: "abc") khi chương trình mong đợi số (`int(input())`), chương trình sẽ dừng đột ngột với lỗi `ValueError`.
    2.  **Dữ liệu "rác":** Nếu người dùng chỉ nhấn Enter (chuỗi rỗng) hoặc nhập dữ liệu phi logic (ví dụ: `Tên sách: "1"`, `Năm xuất bản: 12345`), CSDL của chúng ta sẽ bị ô nhiễm.
* **Giải pháp:** Chúng ta đã xây dựng một bộ 4 hàm "trợ giúp" để "bọc thép" đầu vào:
    * `get_safe_int_input(prompt)`: Đảm bảo người dùng chỉ có thể nhập số nguyên. **Giải quyết: Lỗi `ValueError` khi crash.**
    * `get_string_input(prompt, min_length=2)`: Đảm bảo đầu vào là chuỗi, không rỗng, có độ dài tối thiểu, không chỉ chứa số, và phải bắt đầu bằng chữ cái. **Giải quyết: Dữ liệu "rác" như "123", "a", "" (rỗng).**
    * `get_integer_in_range(prompt, valid_options)`: Đảm bảo số nhập vào phải nằm trong một danh sách cụ thể. **Giải quyết: Nhập `status = 5` (chỉ cho phép `[0, 1, 2]`).**
    * `get_integer_with_min_max(prompt, min_val, max_val)`: Đảm bảo số nhập vào phải nằm trong một khoảng. **Giải quyết: Nhập `Năm xuất bản: 1` (chỉ cho phép từ 1500 - năm hiện tại).**

### 2. Tại sao chúng ta sửa logic nghiệp vụ?

Một hệ thống backend "chắc" không chỉ là về đầu vào, mà còn là về các quy tắc.

* **Vấn đề (Xóa):** Ban đầu, chúng ta có thể xóa một thành viên đang mượn sách, hoặc xóa một cuốn sách đang được mượn.
* **Tại sao đây là lỗi:** Điều này làm hỏng tính toàn vẹn CSDL (lỗi khóa ngoại, dữ liệu "mồ côi").
* **Giải pháp:** Chúng ta đã cập nhật hàm `delete_member()` và `delete_book()`. Giờ đây, các hàm này sẽ kiểm tra (`SELECT`) trạng thái (sách đang mượn `status=1` hoặc thành viên có `return_date IS NULL`) *trước khi* thực hiện `DELETE`. Nếu vi phạm, chúng sẽ ném ra `ValueError` và `lab2.2.py` sẽ bắt lỗi này lại, hiển thị thông báo thân thiện cho người dùng.

* **Vấn đề (Mượn/Trả):** Ban đầu, chúng ta yêu cầu người dùng nhập Tên sách chính xác để mượn/trả.
* **Tại sao đây là lỗi:** Người dùng không thể nhớ tên chính xác, và tệ hơn, nếu có 2 sách cùng tên, logic sẽ bị sai. Mặt khác, yêu cầu người dùng nhập `book_id` (như mentor đề xuất ban đầu) thì lại không thân thiện.
* **Giải pháp (Tìm bằng Tên, Thực thi bằng ID):** Chúng ta đã tạo ra logic tốt nhất:
    * **Mượn (11):** Người dùng nhập *từ khóa* (`LIKE`) -> Hệ thống chỉ hiển thị sách *có sẵn* (`status=0`) -> Người dùng chọn `book_id` từ danh sách đó.
    * **Trả (12):** Người dùng nhập `member_id` -> Hệ thống hiển thị *chỉ* các sách thành viên đó *đang mượn* (`return_date IS NULL`) -> Người dùng chọn `book_id` từ danh sách đó.