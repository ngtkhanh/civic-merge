# CivicMerge — Kế hoạch dựng luồng mock trên branch nền chung

## 1. Mục tiêu và phạm vi

Dựng một bộ khung để cả bốn thành viên có thể clone repo, chạy ứng dụng và phát triển module riêng mà chưa cần OpenAI hoặc Supabase.

Luồng bắt buộc:

**Chọn/chụp ảnh → lấy GPS hoặc dùng vị trí mẫu → phân tích mock → xem hồ sơ nghi trùng → xác nhận tạo mới/hợp nhất → xem chi tiết và các ảnh minh chứng.**

Kịch bản nghiệm thu chính: ảnh thứ nhất tạo incident A; ảnh thứ hai được đề xuất ghép vào A; sau xác nhận, hệ thống có **1 incident, 2 reports và 2 ảnh minh chứng**.

Tiến độ 13/11/2026: đã triển khai code nền trên `chore/mock-foundation`, typecheck/lint/test và export bundle iOS đã qua. Chưa nghiệm thu iPhone/hai điện thoại, chưa tích hợp main hoặc push. Người dùng đã yêu cầu commit riêng các mốc hoàn thành.

Các checkbox ở phần triển khai ghi nhận code đã có; nghiệm thu trên thiết bị được theo dõi riêng và chưa đánh dấu hoàn tất. Xem [báo cáo kiểm chứng](VERIFICATION_REPORT.md).

Tham chiếu:

- [Tổng quan dự án](CivicMerge_Project_Overview.md).
- [Phân công và pipeline tích hợp](CivicMerge_4_Member_Integration_Pipeline.md).

## 2. Những quyết định đã chốt

Đã chốt **Q1: B — iOS/iPhone thật trước** và **Q2: A — mỗi người chạy backend riêng qua LAN**. Khi tích hợp/demo, các điện thoại cùng gọi một backend và cùng nguồn dữ liệu. Các phương án dưới đây được giữ để tham khảo.

### Q1. Thiết bị dùng để nghiệm thu bộ khung

| Lựa chọn | Phạm vi | Ảnh hưởng |
|---|---|---|
| A — Android thật trước | Nghiệm thu Android trước; vẫn tổ chức code hướng đến Android và iOS | Một thiết bị ưu tiên giúp tập trung kiểm tra camera, GPS và kết nối API |
| **B — iOS/iPhone thật trước (đã chọn)** | Nghiệm thu trên iPhone trước; vẫn tổ chức code hướng đến Android và iOS | Cần có iPhone để kiểm tra quyền và luồng thực tế |
| C — Cả Android và iPhone ngay | Nghiệm thu cả hai nền tảng trong giai đoạn nền | Cần đủ thiết bị và thời gian kiểm tra trên cả hai |

Chạy trên điện thoại qua Expo Go nếu các dependency đã chọn tương thích; kiểm tra điều này khi khởi tạo. Nếu phát sinh yêu cầu development build, ghi rõ nguyên nhân và điều chỉnh hướng dẫn chạy.

### Q2. Nhóm sẽ kết nối backend theo cách nào?

| Lựa chọn | Cách chạy | Ảnh hưởng |
|---|---|---|
| **A — Mỗi người chạy local; điện thoại cùng LAN (đã chọn)** | Mỗi máy có backend và dữ liệu mock riêng; điện thoại gọi địa chỉ LAN của máy đó | Đơn giản để chia branch, không cần dịch vụ hosting |
| B — Làm việc từ xa; mỗi người vẫn chạy backend riêng | Mỗi người chạy trên máy mình; điện thoại dùng LAN hoặc một tunnel khi cần | Cần ghi rõ cách kết nối; tunnel chỉ bổ sung khi mạng thực tế yêu cầu |
| C — Một backend demo dùng chung qua Internet | Mọi người gọi một backend chung; vẫn giữ khả năng chạy local | Cần chọn nơi chạy, cấu hình triển khai và ngăn dữ liệu demo của mọi người ảnh hưởng nhau |

Nếu chọn C, trước hết hoàn thành bản local; sau đó chuẩn bị cấu hình triển khai và làm rõ tài khoản/dịch vụ sẵn có. Chưa tự chọn dịch vụ có phí hoặc công khai backend ra Internet.

**Lựa chọn đã xác nhận:** `Q1: B; Q2: A`. Xem [phương án phát triển thống nhất cho đội](CivicMerge_Team_Development_Agreement.md).

## 3. Các quyết định kỹ thuật tôi sẽ tự triển khai

Bạn không cần chọn riêng các mục dưới đây, trừ khi muốn thay đổi yêu cầu.

| Hạng mục | Phương án triển khai |
|---|---|
| Cấu trúc | Monorepo gồm mobile, API và các package dùng chung |
| Package manager | npm workspaces; một lockfile ở root |
| Runtime | Chọn phiên bản Node LTS được Expo và dependency lúc khởi tạo hỗ trợ; ghi phiên bản trong repo |
| Mobile | React Native + Expo + TypeScript; bốn màn hình tối thiểu |
| Backend | Node.js + Express + TypeScript |
| Contract | Zod làm nguồn schema dùng chung, suy ra TypeScript types |
| Giao tiếp | Mobile gọi Express qua HTTP thật ngay từ đầu |
| Mock nghiệp vụ | AI và matching theo kịch bản xác định; routing dùng bảng quy tắc thật |
| Lưu dữ liệu giai đoạn nền | Repository trong bộ nhớ; reset khi backend khởi động lại |
| Ảnh giai đoạn nền | Backend lưu tệp trong thư mục local dành cho mock, trả URL truy cập được từ điện thoại |
| Thay module | Inject AI, matching, routing, repository và storage tại chỗ cấu hình backend |
| Branch nền | `chore/mock-foundation`; kiểm tra branch và thay đổi hiện có trước khi tạo |
| Cấu hình | `.env.example`, hướng dẫn địa chỉ API và mock mode; không cần key dịch vụ thật |
| Kiểm thử | Typecheck, kiểm thử API có trạng thái và smoke test trên thiết bị đã chọn |

Lưu trong bộ nhớ là giới hạn có chủ đích của bộ khung. Đóng/mở lại Mobile vẫn đọc được dữ liệu nếu backend còn chạy; khởi động lại backend sẽ mất dữ liệu nghiệp vụ. Yêu cầu lưu bền vững của MVP sẽ được nghiệm thu sau khi Người 3 nối Supabase.

## 4. Thứ tự thực hiện

### Bước 1 — Chốt contract và quy tắc nghiệp vụ

- [x] Định nghĩa `IncidentType`, `Severity`, `Location`, `AIAnalysis`.
- [x] Định nghĩa `Report`, `IncidentSummary`, `IncidentDetail`, `MatchCandidate`.
- [x] Định nghĩa schema request/response của cả bốn API.
- [x] Định nghĩa interface cho AI, matching, routing, repository và storage.
- [x] Viết ví dụ dữ liệu hợp lệ dùng chung cho cả nhóm.

Các quy tắc sẽ áp dụng:

- `POST /api/reports/analyze` dùng multipart, tên field ảnh là `image`; tọa độ là `latitude`, `longitude` và phải có đủ cặp nếu được gửi.
- Cho phép thiếu GPS. Khi đó không thực hiện matching theo vị trí, trả candidates rỗng và một cảnh báo có cấu trúc để Mobile hiển thị.
- Analyze thành công chỉ tạo report `pending`, chưa tạo incident.
- Confirm tạo mới hoặc gắn report vào một incident hợp lệ; report chuyển thành `confirmed`.
- Merge phải có `targetIncidentId`; backend kiểm tra hồ sơ tồn tại và cùng loại sự cố.
- Confirm lại cùng report và cùng lựa chọn trả kết quả xác nhận đã lưu, không thêm dữ liệu.
- Confirm lại nhưng đổi action hoặc incident đích trả HTTP 409 với mã lỗi rõ ràng.
- `IncidentDetail` có reports, URL ảnh, số lượng minh chứng, trạng thái, đơn vị xử lý và lịch sử tối thiểu.
- `features` dùng quy ước tag thống nhất, có ví dụ; AI thật sau này phải chuẩn hóa output theo quy ước đã chốt.
- Schema mô tả rõ lỗi, giá trị thiếu và định dạng thời gian; không tự đổi enum ở từng module.

**Hoàn thành khi:** tất cả fixtures hợp lệ theo schema; mobile và backend có thể import cùng package contracts.

### Bước 2 — Khởi tạo workspace và khung package

```text
apps/
  mobile/                    # Người 1
    src/
      screens/
      services/api.ts
  api/                       # Người 3
    src/
      routes/
      services/
      repositories/
      storage/
      bootstrap/
packages/
  contracts/                 # Người 3 quản lý thay đổi
  ai-vision/                 # Người 2
  matching/                  # Người 4: matching và routing
mocks/
  fixtures/
  images/
tests/
  integration/
.env.example
README.md
```

- [x] Tạo workspace và script chạy từng ứng dụng/module.
- [x] Thiết lập TypeScript và exports của các package.
- [x] Kiểm tra cách import shared package ở cả Expo và Node.
- [x] Ghi rõ Node, package manager và biến môi trường cần dùng.
- [x] Bổ sung ignore cho dependency, secret và ảnh runtime phát sinh nếu cần; giữ nguyên các thay đổi có sẵn của người dùng.

**Hoàn thành khi:** cài dependency từ root được, typecheck qua và hai ứng dụng sử dụng được contracts.

### Bước 3 — Xây backend mock có trạng thái

- [x] Tạo `GET /health` để kiểm tra backend và kết nối mạng.
- [x] Tạo `POST /api/reports/analyze`.
- [x] Tạo `POST /api/reports/confirm`.
- [x] Tạo `GET /api/incidents` với response cố định về cấu trúc, chưa cần pagination.
- [x] Tạo `GET /api/incidents/:id`.
- [x] Nhận và lưu ảnh thật ở local; kiểm tra loại và kích thước ảnh.
- [x] Tạo repository bộ nhớ cho reports, incidents và lịch sử.
- [x] Áp dụng confirm idempotent và đảm bảo cập nhật bộ nhớ không bị xen kẽ giữa kiểm tra và ghi.
- [x] Cấu hình base URL ảnh để điện thoại truy cập được; không trả đường dẫn filesystem hoặc URL `localhost` của laptop.
- [x] Chuẩn hóa lỗi theo contract.

Mobile chỉ gọi API, không truy cập trực tiếp repository hoặc dữ liệu fixtures. Mọi response phản ánh dữ liệu đang có: confirm phải cập nhật kết quả mà API danh sách/chi tiết trả về.

**Hoàn thành khi:** gọi API độc lập có thể tạo rồi hợp nhất hai reports và đọc lại một incident với hai ảnh.

### Bước 4 — Tạo mock module và các kịch bản tái lập

- [x] AI mock trả `AIAnalysis` theo kịch bản, không cần API key.
- [x] Matching mock chỉ đề xuất incident hiện có, không trả ID giả không tồn tại.
- [x] Routing ánh xạ `pothole`, `trash`, `flood` sang ba tổ xử lý giả định.
- [x] Thêm fixtures, ảnh mẫu được phép sử dụng và dữ liệu GPS mẫu.
- [x] Có cách chọn/reset kịch bản dành riêng cho môi trường mock.
- [x] Chặn cơ chế điều khiển kịch bản/reset khi không chạy mock; không trộn field điều khiển demo vào contract production.

| Kịch bản | Kết quả bắt buộc |
|---|---|
| Ổ gà đầu tiên | Không có candidate; confirm tạo incident A |
| Ảnh thứ hai của cùng ổ gà | Candidate tham chiếu A; merge làm A có hai reports |
| Rác gần ổ gà | Không đề xuất incident ổ gà làm ứng viên |
| Confirm lặp lại cùng lựa chọn | Trả kết quả cũ; không tăng số report/incident |
| Confirm lại với lựa chọn khác | Trả lỗi xung đột; giữ nguyên dữ liệu đã xác nhận |
| AI thất bại | Trả lỗi có cấu trúc; không tạo pending report với analysis sai |
| Không có GPS | Cho phép tạo báo cáo; candidates rỗng và có cảnh báo |
| Incident đích không tồn tại | Merge thất bại; không làm hỏng pending report |

Mock matching chỉ kiểm chứng cách các module phối hợp. Độ chính xác GPS và so khớp hình ảnh sẽ do Người 4 kiểm chứng khi thay bằng thuật toán thật.

**Hoàn thành khi:** reset rồi chạy lại từng kịch bản luôn cho cùng kết quả nghiệp vụ.

### Bước 5 — Nối Mobile và đi hết luồng

- [x] Trang chủ đọc danh sách từ API.
- [x] Màn báo cáo cho chọn/chụp ảnh, xin quyền camera và GPS.
- [x] Có vị trí mẫu được ghi rõ là dữ liệu demo trong mock mode.
- [x] Màn kết quả hiển thị analysis, cảnh báo và ứng viên nghi trùng.
- [x] Người dùng xem được ảnh minh chứng của hồ sơ ứng viên trước khi chọn merge; có thể lấy qua API chi tiết.
- [x] Nút tạo mới/hợp nhất gọi confirm, sau đó mở chi tiết incident.
- [x] Chi tiết hiển thị ảnh, số reports, tổ xử lý, trạng thái và lịch sử tối thiểu.
- [x] Có trạng thái đang tải, lỗi, danh sách rỗng và xử lý từ chối quyền.
- [x] Tập trung HTTP client trong `services/api.ts`; base URL đọc từ cấu hình.
- [ ] Kiểm tra upload ảnh và tải ảnh trên iPhone thật theo Q1/Q2 đã chốt.

**Hoàn thành khi:** người dùng thực hiện được toàn bộ luồng qua UI; dữ liệu hiển thị lấy từ backend.

### Bước 6 — Kiểm chứng và viết hướng dẫn bàn giao

- [x] Typecheck toàn workspace.
- [x] Kiểm thử tích hợp API: create, merge, retry cùng lựa chọn, đổi lựa chọn và merge đích không hợp lệ.
- [x] Kiểm tra response đúng schema và số lượng incident/report sau các thao tác.
- [x] Kiểm tra AI lỗi và thiếu GPS không tạo dữ liệu sai.
- [ ] Smoke test thiết bị: ảnh đầu tiên tạo hồ sơ; ảnh thứ hai merge; xem hai ảnh; đóng/mở Mobile và xem lại khi backend vẫn chạy.
- [x] Thử bản sao source sạch: `npm ci`, typecheck, lint, modules và integration đều qua; chưa phải clone từ commit đã push.
- [x] Ghi rõ cách reset dữ liệu, đổi kịch bản và khắc phục lỗi kết nối API.
- [x] Ghi vị trí thay adapter mock bằng module thật, command kiểm tra và giới hạn bộ nhớ hiện tại.

Các lệnh đã có sau triển khai:

```text
npm ci
npm run dev:api
npm run dev:mobile
npm run typecheck
npm run lint
npm run test:modules
npm run test:integration
npm run mobile:export
npm run mock:reset
```

`mock:reset` phải reset đúng backend đang chạy ở mock mode; không chỉ sửa fixtures trên đĩa mà để dữ liệu bộ nhớ cũ còn nguyên.

**Hoàn thành khi:** thành viên khác có thể tự chạy mà không cần người dựng nền giải thích trực tiếp.

## 5. Điều kiện chia bốn branch

Chỉ dùng bộ khung làm nền chung khi:

- [x] Contracts và interface module đã có trong source code.
- [x] Bộ khung chạy mà không cần OpenAI/Supabase key.
- [ ] Mobile gọi được Express trên iPhone thật.
- [ ] Demo đạt **1 incident, 2 reports, 2 ảnh**.
- [ ] Reset và chạy lại demo được.
- [x] Typecheck và kiểm thử tích hợp cần thiết đều qua.
- [x] README có hướng dẫn chạy, mock scenarios và ownership.
- [ ] Thay đổi trên branch nền được review/tích hợp theo workflow của repo.

Sau khi branch nền được tích hợp vào `main`, cả bốn người tạo branch từ **cùng commit nền**:

| Branch | Chủ sở hữu | Công việc tiếp theo | Cách làm độc lập |
|---|---|---|---|
| `feature/mobile` | Người 1 | Hoàn thiện UI, camera, GPS và thông báo | Chạy backend mock có sẵn |
| `feature/ai-vision` | Người 2 | Tích hợp Vision thật, chuẩn hóa output và lỗi | Chạy module với ảnh mẫu và contracts |
| `feature/backend` | Người 3 | Supabase DB/Storage, transaction và persistence | Giữ AI/matching mock trong lúc làm backend |
| `feature/matching` | Người 4 | Haversine, scoring và hoàn thiện routing | Chạy thuật toán bằng analysis/incident fixtures |

Quy tắc phối hợp:

- Người 3 quản lý contracts, API, database và cấu hình workspace gốc.
- Người 4 điều phối tích hợp; cả nhóm chịu trách nhiệm sửa lỗi thuộc module mình.
- Không tự đổi field/enum hoặc chữ ký interface trong branch riêng.
- Mock và bản thật phải cùng interface; khi nối bản thật ưu tiên thay tại chỗ cấu hình backend.
- Gửi thay đổi nhỏ, tích hợp sớm; không đợi cả bốn module hoàn tất mới ghép.
- Khi đổi dependency, phối hợp cập nhật lockfile để tránh xung đột.

## 6. Ranh giới nghiệm thu bộ khung và sản phẩm thật

| Bộ khung mock phải chứng minh | Phần thật cần hoàn thiện sau khi chia branch |
|---|---|
| Luồng UI/API và contract khớp nhau | AI phân tích ảnh thật đúng schema |
| Create/merge/idempotency hoạt động với repository bộ nhớ | Transaction và concurrency an toàn trong database |
| Candidate dẫn đến hồ sơ và ảnh có thật trong mock | Matching phân biệt được các sự cố dựa trên GPS và features |
| Đọc lại dữ liệu khi backend còn chạy | Dữ liệu và ảnh tồn tại sau khi backend khởi động lại |
| Điện thoại truy cập được backend và URL ảnh | Quyền truy cập Storage và cấu hình dịch vụ thật phù hợp |

Bộ khung hoàn tất khi nhóm có một điểm xuất phát chung đã kiểm chứng. MVP chỉ hoàn tất sau khi thay các module mock cần thiết bằng bản thật và nghiệm thu lại luồng hai ảnh vào một hồ sơ.
