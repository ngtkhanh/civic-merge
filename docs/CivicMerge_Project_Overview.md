# CIVICMERGE — SMART URBAN INCIDENT MANAGEMENT

**AI-Powered Urban Incident Reporting & Management**

**Thông điệp:** One Issue, One Record — Một sự cố, một hồ sơ thống nhất.

> **Nguồn:** [Google Docs — CIVICMERGE](https://docs.google.com/document/d/1o8uS-ePr9GYTQwwgm-TgWIH6jWCIGw2WUeHfh5M45Kk/edit?tab=t.0)

## 1. Tổng quan dự án

CivicMerge là ứng dụng di động tích hợp AI, giúp người dân báo cáo các sự cố đô thị như ổ gà, rác thải, ngập nước chỉ bằng cách chụp ảnh.

Thay vì yêu cầu người dùng nhập mô tả, phân loại sự cố hay tìm đơn vị phụ trách, hệ thống sử dụng AI để tự động phân tích hình ảnh, kết hợp dữ liệu GPS nhằm xác định sự cố, đề xuất mức độ ưu tiên và hỗ trợ định tuyến xử lý.

**Điểm nổi bật nhất:** CivicMerge có khả năng phát hiện các phản ánh có thể đề cập đến cùng một sự cố và đề xuất hợp nhất thành một hồ sơ thống nhất, thay vì tạo ra nhiều báo cáo trùng lặp.

## 2. Vấn đề cần giải quyết

Các hệ thống phản ánh đô thị hiện nay vẫn có những hạn chế:

- **Đối với người dân:** Phải nhập nhiều thông tin, không biết chọn loại sự cố hay đơn vị tiếp nhận, khó theo dõi phản ánh.
- **Đối với đơn vị quản lý:** Phải phân loại báo cáo, xác định đơn vị xử lý và kiểm tra các phản ánh trùng lặp.
- **Về dữ liệu:** Nhiều người có thể báo cáo cùng một sự cố, khiến thông tin phân tán và khó quản lý.

CivicMerge hướng đến giảm thao tác báo cáo và hỗ trợ đơn vị quản lý tiếp nhận thông tin hiệu quả hơn.

## 3. Cách ứng dụng hoạt động

1. **Bước 1 — Chụp ảnh:** Người dùng mở ứng dụng, chụp ảnh sự cố. Ứng dụng lấy vị trí GPS khi được cho phép.
2. **Bước 2 — AI phân tích:** OpenAI Vision nhận diện loại sự cố, trích xuất đặc điểm hình ảnh, tạo mô tả và đề xuất mức độ nghiêm trọng.
3. **Bước 3 — Phát hiện trùng lặp:** Hệ thống đối chiếu GPS, loại sự cố và nội dung với các hồ sơ đã tồn tại để tìm những phản ánh có khả năng trùng nhau.
4. **Bước 4 — Xác nhận:** Nếu có sự cố tương tự, người dùng có thể xem minh chứng trước đó và xác nhận hợp nhất. Nếu không, hệ thống tạo hồ sơ mới.
5. **Bước 5 — Định tuyến thông minh:** Routing Engine xác định tổ xử lý phù hợp dựa trên loại sự cố và bảng quy tắc quản lý đã cấu hình.
6. **Bước 6 — Lưu trữ và theo dõi:** Báo cáo được lưu vào hệ thống, người dùng có thể xem lại hồ sơ, ảnh minh chứng và trạng thái sự cố.

## 4. Điều gì khiến CivicMerge khác với một ứng dụng gọi ChatGPT?

CivicMerge không chỉ sử dụng AI để mô tả hình ảnh mà kết hợp nhiều thành phần xử lý:

| Thành phần | Vai trò |
|---|---|
| AI Vision | Hiểu và phân loại nội dung hình ảnh |
| Duplicate Detection Engine | Phát hiện báo cáo có khả năng trùng bằng GPS và dữ liệu sự cố |
| Routing Engine | Gợi ý tổ xử lý theo quy tắc được cấu hình |
| Incident Management | Hợp nhất minh chứng, quản lý hồ sơ và trạng thái |

AI đóng vai trò thiết yếu trong việc chuyển dữ liệu hình ảnh thành thông tin có cấu trúc, giúp các thuật toán phía sau thực hiện hành động cụ thể.

**Giá trị cốt lõi:** Nhiều người báo cáo cùng một sự cố → Một hồ sơ thống nhất với nhiều minh chứng, được phân loại và định tuyến rõ ràng.

## 5. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Mobile App | React Native + Expo + TypeScript |
| Hệ điều hành | Android & iOS |
| Backend | Node.js + Express |
| AI | OpenAI Vision API |
| Database | Supabase PostgreSQL |
| Lưu trữ ảnh | Supabase Storage |
| Phát hiện trùng | GPS + thuật toán so khớp |

## 6. Phạm vi MVP trong 5 giờ Hackathon

Để đảm bảo sản phẩm hoạt động ổn định, phiên bản đầu tiên chỉ tập trung vào:

- **3 loại sự cố:** Ổ gà, rác thải, ngập nước.
- **4 màn hình:** Trang chủ, báo cáo sự cố, kết quả AI, chi tiết sự cố.
- **Các chức năng chính:** Chụp ảnh, GPS, phân tích AI, phát hiện báo cáo trùng, xác nhận hợp nhất, định tuyến theo quy tắc và lưu lịch sử.
- **Định tuyến thử nghiệm:** Sử dụng các tổ xử lý giả định trong một khu vực thí điểm.

MVP chưa tích hợp trực tiếp hệ thống chính quyền, chưa tự động gửi báo cáo đến cơ quan nhà nước và chưa triển khai hệ thống quản trị quy mô lớn.

## 7. Đối tượng người dùng và tiềm năng phát triển

**Giai đoạn đầu:** Sinh viên, cư dân chung cư, ban quản lý trường đại học và khu đô thị.

**Giai đoạn tiếp theo:** Phát triển thành nền tảng hỗ trợ tiếp nhận và quản lý sự cố cho các tổ chức, khu dân cư và đơn vị vận hành cơ sở hạ tầng.

**Dài hạn:** Hướng đến tích hợp với các hệ thống phản ánh đô thị và nền tảng dịch vụ công hiện có, thay vì cạnh tranh trực tiếp với chúng.

Mô hình kinh doanh tiềm năng là B2B SaaS, cung cấp công cụ quản lý sự cố cho các tổ chức vận hành.

## 8. Mục tiêu của đội trong Hackathon

Trong 5 giờ, đội cần tạo được một ứng dụng chạy trên điện thoại thật và trình diễn hoàn chỉnh quy trình:

**Chụp ảnh → AI phân tích → Tìm báo cáo trùng → Xác nhận hợp nhất → Định tuyến → Lưu hồ sơ.**

**Kịch bản demo quan trọng nhất:** Hai người báo cáo cùng một ổ gà. CivicMerge nhận diện sự tương đồng, đề xuất hợp nhất và cập nhật hai ảnh minh chứng vào một hồ sơ.

**Tiêu chí thành công:** AI hoạt động thực tế, dữ liệu được lưu bền vững, ứng dụng có thể mở lại và tiếp tục sử dụng.

### Tầm nhìn sản phẩm

CivicMerge không chỉ giúp người dân báo cáo sự cố nhanh hơn mà còn biến các phản ánh riêng lẻ thành dữ liệu có tổ chức, hỗ trợ quá trình tiếp nhận, phân loại và quản lý sự cố đô thị hiệu quả hơn.

**One Issue. One Record. Smarter Cities.**
