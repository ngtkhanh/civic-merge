# CivicMerge — Phương án phát triển thống nhất cho đội 4 người

Ngày thống nhất: 13/11/2026.

Tài liệu này chốt phương án dựng nền mock, làm việc trên branch riêng và tích hợp thành sản phẩm thật để cả nhóm sử dụng chung.

## 1. Phương án đã chọn

| Nội dung | Quyết định |
|---|---|
| Thiết bị nghiệm thu bộ khung — Q1 | **iOS/iPhone thật trước**; tiếp tục tổ chức code hướng đến Android và iOS |
| Môi trường phát triển — Q2 | **Mỗi người chạy backend riêng trên máy mình**, điện thoại kết nối qua LAN |
| Môi trường tích hợp/demo | **Các điện thoại cùng gọi một backend và cùng nguồn dữ liệu** |
| Khi nhóm ở cùng địa điểm | Chạy backend tích hợp trên một laptop, các điện thoại truy cập qua LAN |
| Khi cần tích hợp từ nhiều mạng | Chuẩn bị backend tích hợp truy cập qua Internet; vẫn giữ backend local cho từng người |
| Cách chia việc | Dựng bộ khung mock chạy hoàn chỉnh trước, sau đó bốn người tạo branch từ cùng commit nền |

Nếu LAN không đáp ứng được, bổ sung tunnel cho đường kết nối cần thiết. Đây là điều chỉnh kết nối, không thay đổi contract hoặc cách phân chia module.

## 2. Mục tiêu của bộ khung chung

Chưa cần OpenAI hoặc Supabase key, nhóm vẫn phải chạy được:

**Chọn/chụp ảnh → GPS hoặc vị trí mẫu → phân tích mock → xem ứng viên nghi trùng → xác nhận tạo mới/hợp nhất → xem hồ sơ và ảnh minh chứng.**

Kịch bản kiểm chứng chính:

1. Điện thoại thứ nhất gửi ảnh ổ gà và xác nhận tạo incident A.
2. Điện thoại thứ hai gửi ảnh khác của cùng ổ gà, nhận đề xuất ghép vào A.
3. Người dùng xem minh chứng và xác nhận hợp nhất.
4. Backend có **1 incident và 2 reports** cùng liên kết đến incident A.
5. Chi tiết incident A hiển thị **2 ảnh minh chứng**.

Hai điện thoại bắt buộc gọi cùng backend khi chạy kịch bản này. Hai backend local riêng không tự chia sẻ dữ liệu.

## 3. Cách làm việc theo từng giai đoạn

### Giai đoạn 1 — Dựng nền mock chung

Thực hiện trên branch `chore/mock-foundation`:

- Chốt schema dữ liệu, request/response API và interface các module.
- Khởi tạo monorepo, Mobile, Express và shared packages.
- Dựng API có trạng thái với repository bộ nhớ, ảnh lưu local và module AI/matching mock.
- Nối bốn màn hình tối thiểu vào HTTP API thật.
- Bổ sung fixtures, kịch bản demo, reset dữ liệu và hướng dẫn chạy.
- Kiểm tra typecheck, các ca tích hợp quan trọng và luồng trên iPhone thật.

Chi tiết thực hiện nằm trong [kế hoạch dựng nền mock](CivicMerge_Mock_Foundation_Plan.md).

### Giai đoạn 2 — Mỗi thành viên phát triển trên branch riêng

Sau khi nền đã được kiểm chứng và tích hợp vào `main`, cả bốn người tạo branch từ cùng commit:

| Thành viên | Branch | Phạm vi chính | Cách chạy độc lập |
|---|---|---|---|
| 1 — Mobile | `feature/mobile` | `apps/mobile/` | Dùng backend mock local để hoàn thiện UI, camera, GPS và xử lý lỗi |
| 2 — AI Vision | `feature/ai-vision` | `packages/ai-vision/` | Chạy Vision thật với ảnh mẫu, kiểm tra output theo contracts |
| 3 — Backend/DB/Storage | `feature/backend` | `apps/api/`, `supabase/` | Nối Supabase, giữ AI/matching mock khi cần |
| 4 — Matching/Routing/Integration | `feature/matching` | `packages/matching/`, kiểm thử tích hợp | Chạy matching bằng fixtures; điều phối ghép module và demo |

Mỗi người có cấu hình local và dữ liệu mock riêng. Reset hoặc khởi động lại backend của một người không ảnh hưởng người khác.

Người làm AI/matching có thể kiểm tra module bằng fixtures mà không cần mở Mobile trong mọi lần thử.

### Giai đoạn 3 — Tích hợp và demo

- Người 3 phụ trách chạy/cấu hình backend tích hợp; Người 4 điều phối phiên kiểm thử chung.
- Backend tích hợp chạy phiên bản code đã được nhóm thống nhất, ưu tiên code đã tích hợp vào `main`.
- Các điện thoại dùng cùng địa chỉ API tích hợp.
- Không tự reset dữ liệu hoặc thay phiên bản backend trong lúc người khác đang kiểm thử/demo; thông báo và thống nhất thời điểm trước.
- Tích hợp từng phần nhỏ, không chờ bốn module hoàn tất mới ghép.
- Nếu cần backend Internet, chuẩn bị riêng cấu hình triển khai và lựa chọn hạ tầng; hiện chưa chốt nhà cung cấp hoặc dịch vụ có phí.

## 4. Kiến trúc để thay mock bằng bản thật

| Thành phần | Bộ khung ban đầu | Phiên bản thật |
|---|---|---|
| Mobile | Bốn màn hình tối thiểu, gọi HTTP API | Hoàn thiện UI và trải nghiệm thiết bị |
| AI Vision | Output theo kịch bản mẫu | OpenAI Vision, output chuẩn hóa và kiểm tra schema |
| Matching | Candidates theo kịch bản, tham chiếu dữ liệu hiện có | GPS + loại sự cố + features |
| Routing | Bảng quy tắc cho ba loại sự cố | Giữ bảng quy tắc MVP với các tổ xử lý giả định |
| Database | Repository trong bộ nhớ | Supabase PostgreSQL và transaction phù hợp |
| Ảnh | Backend lưu ảnh local, cung cấp URL | Supabase Storage |

Backend chọn các implementation tại chỗ cấu hình. Mobile tiếp tục dùng cùng contract khi backend thay mock bằng module thật.

Địa chỉ API lấy từ cấu hình từng môi trường, không ghi cứng IP trong màn hình. URL ảnh cũng phải truy cập được từ điện thoại. Key OpenAI và Supabase service-role chỉ đặt ở backend.

## 5. Quy tắc phối hợp

- **Contract dùng chung:** không tự đổi tên field, enum hoặc chữ ký hàm trong branch riêng.
- **Quản lý thay đổi:** Người 3 quản lý contract, API, database và cấu hình workspace gốc; thông báo thay đổi cho các bên liên quan.
- **Ownership:** ưu tiên sửa trong phạm vi module của mình; phối hợp trước khi sửa file dùng chung và lockfile.
- **Git:** PR nhỏ, kiểm tra cần thiết phải qua, không push trực tiếp lên `main`.
- **Mock xác định:** kịch bản phải reset và chạy lại được; tránh kết quả ngẫu nhiên làm khó tích hợp.
- **Xác nhận hợp nhất:** matching chỉ đề xuất; người dùng quyết định create hoặc merge.
- **Retry:** xác nhận lặp lại cùng lựa chọn không tạo thêm hồ sơ hoặc minh chứng.
- **Cấu hình local:** không commit secret hoặc địa chỉ máy cá nhân làm mặc định chung.

## 6. Giới hạn cần cả nhóm hiểu giống nhau

### iOS trước chưa phải nghiệm thu Android

Q1 xác định thứ tự kiểm chứng. Backend, schema và thuật toán dùng chung; phần Mobile vẫn cần kiểm tra riêng trên Android thật trước khi xác nhận hỗ trợ Android.

### Mock bộ nhớ chưa đáp ứng lưu bền vững

Đóng/mở Mobile vẫn xem được dữ liệu nếu backend còn chạy. Khởi động lại backend mock sẽ mất dữ liệu nghiệp vụ. Khi nối Supabase, phải kiểm chứng dữ liệu và ảnh còn tồn tại sau khi backend khởi động lại.

### Backend trên Internet chưa đồng nghĩa sản phẩm thật

Một backend mock được triển khai công khai vẫn là mock. Sản phẩm thật phải có AI thật, matching được kiểm chứng, lưu bền vững và quyền truy cập dữ liệu/ảnh phù hợp.

## 7. Điều kiện hoàn tất nền và bàn giao cho bốn người

- [ ] Clone repo và chạy theo README được, không cần key dịch vụ thật.
- [ ] Mobile và API import được cùng contracts.
- [ ] Chụp/chọn ảnh, vị trí, upload và xem ảnh hoạt động trên iPhone thật.
- [ ] Hai điện thoại cùng backend chạy được kịch bản **1 incident, 2 reports, 2 ảnh**.
- [ ] Kiểm tra create, merge, retry, lỗi AI và thiếu GPS đạt yêu cầu.
- [ ] Reset và chạy lại kịch bản được.
- [ ] Typecheck và kiểm thử tích hợp cần thiết đều qua.
- [ ] Có hướng dẫn chạy riêng từng module và thay mock bằng bản thật.
- [ ] Bộ khung đã được tích hợp vào `main`; nhóm ghi nhận commit nền để tạo bốn branch.

## 8. Tài liệu liên quan

- [Tổng quan sản phẩm](CivicMerge_Project_Overview.md).
- [Phân công bốn thành viên và pipeline](CivicMerge_4_Member_Integration_Pipeline.md).
- [Checklist triển khai bộ khung mock](CivicMerge_Mock_Foundation_Plan.md).

Phương án trong tài liệu này và tài liệu kế hoạch đã thống nhất Q1: B — iOS/iPhone thật trước; Q2: A — backend local riêng khi phát triển, backend chung khi tích hợp/demo. Việc chốt phương án chưa đồng nghĩa source code hoặc các branch đã được tạo.
