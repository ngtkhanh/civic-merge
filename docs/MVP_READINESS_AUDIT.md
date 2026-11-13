# CivicMerge — đối chiếu MVP và backlog thực hiện

Ngày đối chiếu: **14/11/2026**. Nguồn: source đang có trên `feature/backend`, [tổng quan sản phẩm](CivicMerge_Project_Overview.md), [pipeline bốn người](CivicMerge_4_Member_Integration_Pipeline.md), [thỏa thuận nhóm](CivicMerge_Team_Development_Agreement.md), contracts và báo cáo kiểm chứng.

**Cập nhật sau audit:** Người 3 đã implement Storage private, tham chiếu ảnh bền vững, cấu hình provider và điểm lắp factory; đã kiểm thử trên Storage thật + PostgreSQL test riêng. P0-06/07 hoàn thành phần code và kiểm thử tự động; P0-08 còn chờ AI/matching thật từ Người 2/4. Không thay/restart backend tích hợp đang chạy và không tự bật selector trong `.env`. Xem [hướng dẫn](BACKEND_STORAGE.md) và [kết quả](BACKEND_VERIFICATION.md). Các mục nghiệm thu thiết bị vẫn chưa hoàn thành.

## 1. Mục tiêu phải giữ

**Chụp/chọn ảnh → GPS → AI phân tích ảnh thật → tìm hồ sơ nghi trùng → người dùng xem minh chứng và xác nhận create/merge → gán tổ xử lý theo rule → lưu ảnh, hồ sơ, lịch sử và xem lại.**

MVP gốc có **ba loại** `pothole|trash|flood` và **bốn màn hình nghiệp vụ**. Tổ xử lý là đơn vị giả định ở khu vực thí điểm; không gửi báo cáo tới cơ quan nhà nước thật. Người dùng đã quyết định **để FPT Cloud làm sau**; backend local và điện thoại cùng Wi-Fi vẫn dùng để hoàn thiện MVP.

Không mặc định bổ sung đăng nhập đầy đủ, bản đồ thời gian thực, dashboard quản trị lớn hoặc thông báo đẩy vào phạm vi bắt buộc của MVP gốc.

## 2. Hiện trạng dựa trên code

| Thành phần | Đã có | Thiếu / giới hạn |
|---|---|---|
| Trang chủ | Kết nối backend, lưu URL trên thiết bị, danh sách incident, mở chi tiết | Cấu hình và banner demo chiếm nhiều diện tích; danh sách chưa có filter/phân trang |
| Báo cáo | Camera/gallery, xem ảnh trước gửi, chuẩn hóa JPEG, GPS, từ chối GPS, vị trí demo, khóa bấm lặp | Chưa nghiệm thu đầy đủ camera/GPS trên APK và iPhone; cần polish UX |
| Kết quả | Type/severity/description, warnings, candidate score/distance/reasons, ảnh minh chứng cũ, create/merge, retry cùng lựa chọn | AI/matching đang mock; lỗi tải một candidate làm cả `Promise.all` thất bại; chưa có so sánh ảnh mới rõ ràng |
| Chi tiết | Type/status/description/severity, team, reportCount, ảnh/timestamps, lịch sử create/merge, reload | Chưa hiển thị location; chưa có nghiệp vụ thay đổi status |
| API | Analyze/confirm/list/detail, runtime validation, giới hạn ảnh 8 MB, MIME/chữ ký, lỗi có cấu trúc | Chưa có provider thật; chưa có API quản lý trạng thái, draft recovery hoặc phân trang |
| PostgreSQL | Supabase đã nối TLS xác minh; migration đã chạy; pending/confirmed, incident/report/history/confirmation | Không thay thế cho Storage; chưa nghiệm thu toàn luồng ảnh thật trên thiết bị |
| Confirm | Transaction, khóa report/incident, idempotency snapshot, conflict khi đổi lựa chọn, rollback | Cần giữ nguyên và regression-test khi ghép provider thật; không dựng lại |
| AI Vision | `VisionAnalyzer`, mock fixture ba loại, lỗi mock | Không gọi OpenAI; ảnh không quyết định output |
| Matching | Interface, mock chọn incident cùng loại có location | Không tính khoảng cách từ GPS; score 0.92 và khoảng cách 12 m cố định; chưa so features |
| Routing | Rule ba loại → ba tổ thí điểm, đã có logic thật | Chưa phải tích hợp đơn vị xử lý thực tế; điều này phù hợp MVP gốc |
| Lưu ảnh | Local hoặc Supabase Storage private; UUID/bucket/key, URL proxy ổn định | Local legacy còn phụ thuộc host/thư mục cũ; chưa bulk-migrate dữ liệu cũ |
| Bootstrap | Chọn persistence/storage/vision/matching riêng qua `bootstrap/configured.ts`; factory registry, timeout và validate output | AI/matching thật chưa được bàn giao; chọn provider chưa đăng ký sẽ lỗi, không fallback |
| APK | Native EAS build thành công, đã cài và người dùng xác nhận kết nối API được | Chưa có xác nhận camera/upload/create/merge trên APK; chưa nghiệm thu iPhone/hai điện thoại |
| Kiểm thử | Typecheck/lint/modules; API mock và Storage, provider fixtures; PostgreSQL test riêng + Storage test thật | Chưa chứng minh độ đúng Vision/matching thật hoặc nghiệm thu camera/GPS/hai thiết bị; xem báo cáo mới |

Trong cấu hình PostgreSQL hiện tại, scenario mặc định là `pothole`, controls đổi scenario bị tắt. Vì vậy ảnh rác/ngập cũng có thể nhận kết quả ổ gà giả lập. Đây là giới hạn có chủ ý của mock, không phải AI đã nhận diện ảnh.

### Bốn màn hình đã có và cách tới chúng

| Màn hình | Route | Cách mở |
|---|---|---|
| Trang chủ | `/` | Mở app |
| Báo cáo | `/report` | Bấm **Báo cáo sự cố** |
| Kết quả | `/result` | Sau khi gửi ảnh/phân tích thành công |
| Chi tiết | `/detail?id=...` | Sau confirm hoặc **Xem hồ sơ** trên incident có sẵn |

Không có báo cáo/incident thì Trang chủ không có card chi tiết. Kết quả không phải một tab độc lập: màn hình này cần một pending report hợp lệ.

## 3. Phân loại ưu tiên

- **P0:** chặn việc chứng minh MVP gốc bằng ảnh thật, hoặc lỗi làm kẹt luồng chính.
- **P1:** làm sản phẩm dễ dùng, phục hồi tốt và hữu ích hơn; một phần cần nếu nâng demo thành công cụ vận hành.
- **P2 / sau MVP:** mở rộng sản phẩm hoặc vận hành Internet. FPT đang được người dùng để sau.

Các mục dưới đây giữ yêu cầu backlog; trạng thái đã triển khai được ghi riêng ngay đầu từng mục. Các đề xuất chưa được ghi nhận hoàn thành vẫn là hướng thiết kế, không phải contract/biến môi trường đã tồn tại. Storage/provider selectors đã có theo tài liệu bàn giao mới.

## 4. Backlog P0 có thể giao việc ngay

### P0-01 — Chốt baseline và quyết định tích hợp

**Owner:** Người 3 + Người 4; phối hợp Người 1/2 khi ảnh hưởng contract.

- Ghi nhận bản APK/source đang dùng và kiểm tra luồng mock hai ảnh trên APK trước khi thay provider.
- Giữ types/severity/features và interface hiện tại; không tự thêm loại sự cố ngoài ba loại.
- Chốt từ vựng features chung để Vision và matching dùng cùng nghĩa.
- Ảnh không phải sự cố trả lỗi có cấu trúc, không ép thành một trong ba loại. Có thể dùng `DomainError` mà không mở rộng enum incident.
- Chốt cách định danh object ảnh và quyền đọc Storage trước khi code adapter.
- Mọi thay đổi schema cần migration mới; không sửa migration đã áp dụng vì runner kiểm tra checksum.

**Nghiệm thu:** có fixture đầu vào/đầu ra dùng chung và quyết định Storage URL/object reference; caller không phải tự đoán contract.

### P0-02 — Vision adapter phân tích ảnh thật

**Owner:** Người 2 — `packages/ai-vision/`. **Phụ thuộc:** P0-01, credential OpenAI riêng cho backend.

- Implement `VisionAnalyzer` nhận bytes/MIME ảnh thật và gọi OpenAI từ backend.
- Trả `type`, `severity`, mô tả tiếng Việt và features đúng `AIAnalysisSchema`.
- Chuẩn hóa tag theo regex và từ vựng đã chốt; không lấy GPS do mô hình tự suy đoán.
- Model/key/timeout lấy từ cấu hình backend, không đưa vào APK hoặc fixture.
- Không thay mock bằng output cố định khác rồi gọi là AI thật; giữ mock riêng để test không phụ thuộc mạng.

**Nghiệm thu:** ít nhất hai ảnh thật cho mỗi loại trả output hợp schema và mô tả phù hợp nội dung. Đây là mẫu kiểm tra tối thiểu, chưa phải đánh giá độ chính xác quy mô lớn.

### P0-03 — Vision từ chối ảnh sai và chịu lỗi dịch vụ

**Cập nhật backend:** đã preserve DomainError/status/code, che exception thô, validate schema output và giới hạn timeout AI/matching trước upload. Có test fixture lỗi/schema/timeout; xử lý provider OpenAI thật vẫn chờ Người 2.

**Owner:** Người 2 + Người 3.

- Ảnh không liên quan, quá mờ/không đủ thông tin: trả lỗi rõ ràng để chụp lại.
- Xử lý key thiếu/sai, quota/rate limit, timeout, lỗi provider và JSON sai schema.
- Timeout/retry có giới hạn, tương thích timeout 30 giây của mobile; không retry vô hạn.
- Không tạo incident/report thành công giả khi AI thất bại; không để ảnh upload bị bỏ lại do nhánh lỗi.

**Nghiệm thu:** ảnh không phù hợp và lỗi provider không tạo dữ liệu nghiệp vụ sai; UI hiểu được lỗi. Test adapter dùng fake provider cho lỗi xác định và chạy mẫu ảnh thật riêng.

### P0-04 — GPS matching thật

**Owner:** Người 4 — `packages/matching/`.

- Tính Haversine bằng location báo cáo và location incident.
- Lọc cùng loại, có tọa độ và trong bán kính cấu hình; không coi mọi incident cùng loại là ứng viên.
- Thiếu GPS vẫn cho create nhưng candidates rỗng, giữ warning hiện có.
- Khoảng cách trả về phải được tính, có quy ước làm tròn và đơn vị mét.

**Nghiệm thu:** cùng loại nhưng rất xa không xuất hiện; hai ảnh gần nhau của cùng sự cố được đưa vào bước chấm điểm; không còn hằng 12 m.

### P0-05 — Chấm điểm features và xếp hạng

**Owner:** Người 4 + Người 2.

- So features đã chuẩn hóa, kết hợp độ gần GPS; có ngưỡng và giới hạn số ứng viên.
- Trả score trong 0..1 và reasons đúng với phép tính; score là điểm xếp hạng, không phải xác suất đã hiệu chuẩn.
- Không dùng severity hoặc việc cùng loại làm bằng chứng đủ để ghép hai sự cố.
- Thử cả hai ổ gà khác nhau nhưng gần nhau; điều chỉnh ngưỡng dựa trên dữ liệu gán nhãn.
- Chỉ đề xuất, không ghi liên kết/auto-merge; người dùng vẫn confirm.

**Nghiệm thu:** candidate order và reasons giải thích được; không còn hằng 0.92; có các ca near/far, different type, missing GPS, gần ngưỡng và features khác nhau.

### P0-06 — Supabase Storage adapter

**Đã hoàn thành code và kiểm thử tự động:** private bucket adapter, UUID, validation 8 MiB, timeout, lỗi có cấu trúc; test upload/read/delete thật trong bucket/prefix riêng. Không bật Storage trên backend đang dùng nếu chưa phối hợp. Xem [báo cáo](BACKEND_VERIFICATION.md).

**Owner:** Người 3 — `apps/api/src/storage/`, `supabase/`.

- Implement `ImageStorage.save/remove` thật; cấu hình bucket/quyền đọc và credential backend riêng.
- Giữ UUID object key, MIME và giới hạn ảnh; không dùng tên tệp client làm đường dẫn.
- Chỉ backend có credential ghi/xóa; không cấp service credential cho Mobile.
- Upload/delete lỗi phải trả lỗi phù hợp; rollback/xóa ảnh khi lưu pending report thất bại.
- Bucket test/object prefix test tách biệt; không reset bucket dùng chung để kiểm thử.

**Nghiệm thu:** ảnh được lưu trên Storage, điện thoại xem được và vẫn xem được khi không còn dựa vào `.runtime/uploads` trên laptop.

### P0-07 — Lưu tham chiếu ảnh bền vững và đọc URL đúng

**Đã hoàn thành phương án bucket/key + proxy:** không signed URL hết hạn; URL dựng theo backend hiện tại, giữ local legacy. Đã kiểm tra dựng lại backend/đổi base URL với PostgreSQL test + Storage thật. Legacy mất host/file cần khôi phục/chuyển dữ liệu riêng, không tự reset hoặc bulk-migrate.

**Owner:** Người 3. **Phụ thuộc:** P0-06 và quyết định quyền đọc.

- Đề xuất: lưu bucket/object key làm tham chiếu lâu dài; chọn rõ public demo URL hoặc private Storage với URL được cấp lại khi đọc/đường dẫn proxy backend.
- Không lưu signed URL sắp hết hạn như nguồn dữ liệu vĩnh viễn rồi trả lại mãi.
- Nếu cần thêm cột object reference, thêm migration mới và mapper trả `imageUrl` đúng contract mobile.
- Có phương án cho dữ liệu/ảnh local đã tạo trước khi chuyển Storage; không xóa/reset để né migration.
- Kiểm tra list/detail/candidate cover và tất cả minh chứng sau restart/đổi backend; chú ý URL local đã lưu chứa IP cũ.

**Nghiệm thu:** URL ảnh mới/cũ được xử lý có chủ ý, ảnh không mất chỉ vì restart backend; private URL hết hạn có thể được cấp lại.

### P0-08 — Lắp module thật vào backend

**Đã sẵn sàng phần Người 3:** provider selectors, `AdapterFactories`, config validation, timeout, runtime schema, health capabilities và no-fallback. **Chưa tích hợp AI/matching thật:** factory/module thuộc Người 2/4 chưa có; không đánh dấu toàn mục hoặc MVP hoàn tất. Xem [điểm bàn giao](BACKEND_STORAGE.md).

**Owner:** Người 3; Người 2/4 bàn giao adapter.

- Tạo/chỉnh bootstrap để inject Vision thật, matcher thật, Storage thật cùng PostgreSQL repository hiện tại.
- Chọn provider bằng cấu hình có validation; giữ đường mock tách biệt để dev/test.
- Không đổi `MOCK_MODE=false` trong `.env` trước khi server hỗ trợ bootstrap tương ứng.
- Cấu hình thiếu credential phải báo rõ lúc khởi động, không âm thầm fallback mock rồi mô tả là real.
- Health/log/UI phải phản ánh đúng thành phần thật/giả lập. APK hiện dùng cờ mock lúc build, nên cần phối hợp cấu hình/build khi chuyển thật; health capabilities động là hướng cải tiến nếu cần hỗ trợ mixed mode lâu dài.
- Giữ reset/scenario API không xuất hiện ở backend dùng dữ liệu thật.

**Nghiệm thu:** cùng một ảnh đi qua đúng các adapter được chọn; database vẫn giữ transaction/snapshot; không phải sửa nghiệp vụ Mobile để gọi implementation backend.

### P0-09 — Trang chủ và luồng điều hướng rõ ràng

**Owner:** Người 1 — `apps/mobile/`.

- Đưa CTA báo cáo và danh sách hồ sơ vào trọng tâm; thu gọn/chuyển cấu hình kết nối sang khu vực cài đặt.
- Hiển thị trạng thái kết nối ngắn gọn; banner mock rõ nhưng không che gần hết màn hình.
- Empty/loading/error states dễ hiểu; người dùng biết phải bấm đâu để báo cáo đầu tiên.
- Có thể giữ bốn màn hình nghiệp vụ; một khu vực/màn cài đặt chỉ là tiện ích, không cần làm thêm cả hệ thống navigation phức tạp.

**Nghiệm thu:** người mới mở app tìm được nút báo cáo, gửi ảnh và xem hồ sơ mà không hiểu code hoặc địa chỉ máy chủ khi cấu hình đã lưu.

### P0-10 — Phục hồi lỗi confirm đúng bản chất

**Owner:** Người 1 + Người 3.

**Điểm cần sửa quan sát từ code:** `ResultScreen` đặt `lastRequest` trước khi gọi confirm; khi lỗi thì tất cả lựa chọn create/merge bị khóa và chỉ còn retry cùng lựa chọn. Điều này đúng với timeout chưa biết server đã commit hay chưa, nhưng có thể làm người dùng kẹt khi server đã từ chối merge vì đích không tồn tại/khác loại.

- API client cần giữ HTTP status/domain error code thay vì chỉ biến thành `Error(message)`.
- Lỗi xác định còn pending: cho tải lại candidate/chọn phương án hợp lệ.
- Timeout/mất phản hồi sau gửi: giữ nguyên request và retry idempotent; không tự đổi lựa chọn khi kết quả chưa rõ.
- Nếu report thực sự đã confirm theo lựa chọn khác, hiển thị conflict rõ ràng và có đường đối soát/xem hồ sơ phù hợp.

**Nghiệm thu:** đích merge sai/mất không làm người dùng bỏ luôn report; retry mạng vẫn không tạo incident/report kép.

### P0-11 — Hiển thị và tải minh chứng để xác nhận

**Owner:** Người 1.

- Tải từng candidate độc lập; một candidate detail 404/lỗi không làm mất toàn bộ ứng viên vì `Promise.all` bị reject.
- Giữ nút merge chỉ bật khi đã có đủ minh chứng của candidate đó.
- Hiển thị rõ ảnh vừa gửi và ảnh cũ, loại, mô tả, khoảng cách/lý do; không diễn giải score thành độ tin cậy tuyệt đối.
- Chi tiết cần hiển thị location/thiếu GPS và thông tin nhận diện hồ sơ; giữ ảnh, team, count và lịch sử đã có.
- Bổ sung thông báo dễ hiểu cho lỗi mạng và nhập nhầm HTTP/HTTPS, không để người dùng chỉ thấy exception Java/TLS.

**Nghiệm thu:** người dùng thực sự so sánh được minh chứng trước khi quyết định; lỗi một ảnh/candidate có thể tải lại và không khóa các hồ sơ hợp lệ khác.

### P0-12 — Kiểm thử tích hợp thật và nghiệm thu thiết bị

**Owner:** Người 4 điều phối, cả nhóm thực hiện.

- Trước: lưu kết quả baseline mock trên APK để phân biệt lỗi UI/API với lỗi thuật toán sau thay module.
- Sau: Vision + matching + PostgreSQL + Storage chạy xuyên suốt bằng ảnh và GPS thật.
- Giữ regression cho pending, create/merge, retry snapshot, conflict, invalid merge và concurrency.
- Test tự động DB/Storage dùng môi trường/dữ liệu test riêng; không reset database/bucket đang demo.
- Android thật: camera, chọn ảnh, cấp/từ chối quyền, GPS tắt/yếu/timeout, upload, ảnh detail, back navigation, restart app.
- Theo ưu tiên nhóm, iPhone và demo hai điện thoại cùng backend vẫn cần nghiệm thu; APK Android không thay cho bằng chứng iPhone.
- Restart backend và mở lại hồ sơ xác nhận dữ liệu/ảnh vẫn truy cập được.
- Kiểm tra routing đúng ba tổ thí điểm sau khi Vision thật phân loại được cả ba loại.

**Nghiệm thu cuối:** ảnh 1 tạo incident A; ảnh 2 cùng sự cố được gợi ý A; người dùng xác nhận; DB đúng 1 incident/2 reports, UI có 2 ảnh, team và history; retry không nhân đôi; mở lại app/backend vẫn xem được. Hai sự cố khác loại hoặc ở xa không bị gợi ý sai theo rule đã chốt.

## 5. P1 — hoàn thiện sử dụng và quản lý

| ID | Việc | Owner / lưu ý |
|---|---|---|
| P1-01 | Tìm kiếm/lọc theo type, severity, status; phân trang danh sách | Người 1 + 3; cần contract/query params và test; matching không nên tải vô hạn toàn bộ DB khi dữ liệu lớn |
| P1-02 | Workflow `open → in_progress → resolved` | Người 3 + 1; hiện chỉ có field/nhãn, không có API đổi status. Nếu demo yêu cầu quản lý xử lý thì nâng mục này thành P0 |
| P1-03 | Lịch sử đổi status/người thực hiện | Cần mở rộng contract và migration mới: history hiện chỉ có `created|report_merged`, PK theo report không phù hợp nhiều sự kiện tùy ý |
| P1-04 | Khôi phục pending report khi app bị đóng | Người 1 + 3; hiện result chỉ ở React state, thiếu API khôi phục/đối soát report cho client |
| P1-05 | Hủy/expire pending report và dọn orphan image | Người 3; có thời hạn, audit và quy tắc rõ, không dùng reset database |
| P1-06 | Chống analyze/upload lặp khi retry mạng | Người 3 + 1; confirm đã idempotent nhưng analyze chưa có idempotency key |
| P1-07 | Xem ảnh lớn/zoom, tóm tắt kết quả, cải thiện chữ lớn và accessibility | Người 1; không thay nghiệp vụ merge |
| P1-08 | Hiển thị địa chỉ dễ đọc/mở vị trí trong app bản đồ có sẵn | Người 1 + 3; reverse geocoding là phần bổ sung, không phải yêu cầu để tính Haversine |
| P1-09 | Log có request ID, đo latency/chi phí AI, timeout/connection config, readiness DB | Người 3; không log key, URI DB, ảnh hoặc dữ liệu nhạy cảm |
| P1-10 | Contract/fixture/schema docs và task board theo trạng thái mới | Người 3 + 4; bỏ nhầm lẫn giữa baseline mock, database thật và real MVP |
| P1-11 | Đóng gói lại APK sau thay đổi Mobile/native/build-time flags; quản lý version/signing | Người 1 + 3; giữ keystore và không ghi secret vào Git |
| P1-12 | Review và tách thay đổi đang chưa commit thành các phần nhỏ | Theo ownership; chỉ commit/push/merge khi được yêu cầu, không tự thực hiện trong audit |

Trạng thái xử lý là điểm cần phân biệt: MVP gốc yêu cầu xem trạng thái; UI hiện có nhãn, nhưng tất cả incident mới được tạo `open`. Một công cụ vận hành cần thêm hành động chuyển trạng thái, phân quyền và lịch sử; dashboard quản trị lớn không tự trở thành bắt buộc.

## 6. Trước khi mở Internet / sau MVP

Các mục này không chặn việc phát triển/demo local đang chạy, nhưng cần được xử lý trước khi mở dịch vụ cho người dùng không tin cậy:

- Auth và phân quyền API/ảnh; runtime DB role tối thiểu. Không coi việc bật RLS là đủ khi backend dùng credential có quyền cao.
- Hạn mức/rate limit upload và AI, chống abuse, quyền truy cập report/incident, chính sách lưu/xóa ảnh và metadata.
- HTTPS/tên miền, secret trên server, giới hạn request, logs/monitoring, health/readiness, backup và diễn tập restore DB/ảnh.
- FPT VM/process manager hoặc container, cấu hình persistent storage, rollout/rollback; chỉ triển khai khi người dùng tiếp tục yêu cầu.
- Không chuyển DB về memory hoặc bật reset/scenario trong môi trường dữ liệu thật.

Mở rộng sản phẩm tùy nhu cầu: đăng nhập/profile, báo cáo của tôi, thông báo đẩy, full map, dashboard phân quyền nhiều cấp, phân công/trao đổi thực tế với cơ quan xử lý, loại sự cố ngoài ba loại, embedding/nhận dạng ảnh nâng cao, realtime và offline queue. Những phần này cần đặc tả riêng, không thuộc bốn màn hình MVP ban đầu.

## 7. Thứ tự thực hiện đề nghị

1. **P0-01:** kiểm tra luồng mock trên APK và chốt các quyết định/fixture chung.
2. **Người 3 đã hoàn thiện code/test P0-06/07:** phối hợp thời điểm bật Storage trên backend tích hợp; tiếp tục giữ AI/matching mock khi chưa nhận module thật.
3. **Người 2 làm P0-02/03:** Vision thật, sau khi có cấu hình OpenAI backend riêng.
4. **Người 4 làm P0-04/05:** matching thật theo fixtures/features đã thống nhất; phối hợp Vision sau đó.
5. **Người 1 làm P0-09/10/11:** UX bốn màn hình và phục hồi lỗi, dùng API hiện có.
6. **Người 3 ghép P0-08**, sau đó **P0-12** trên thiết bị thật, sửa lỗi và build APK mới khi cần.
7. Chọn các mục P1 theo mục tiêu demo; FPT và phạm vi Internet để chặng sau theo quyết định hiện tại.

Đây là phân công cho đội theo ownership, không có tác vụ agent song song hoặc thay implementation AI/matching/Mobile trong đợt audit này.

## 8. Đầu vào cần chuẩn bị

- Người 2: credential OpenAI backend, model/cấu hình/hạn mức thử nghiệm; ảnh thật đã gán nhãn cho ba loại và ảnh không phù hợp.
- Người 3: quyền quản lý bucket Storage, credential server phù hợp, quyết định quyền đọc/URL; môi trường test tách biệt. Credential PostgreSQL hiện có không tự cung cấp API Storage.
- Người 4: cặp ảnh/vị trí cùng sự cố và khác sự cố, gồm near/far/khác loại; ngưỡng là cấu hình được thử nghiệm chứ không giả định đã tối ưu.
- Người 1/4: điện thoại thật, ít nhất hai thiết bị cho demo chung, mẫu thử quyền mạng/camera/GPS.
- Không gửi credential qua chat hoặc commit `.env`; chỉ lưu/configure riêng trên máy/server phù hợp.

## 9. Bằng chứng và giới hạn của audit

Đã đọc source bốn màn hình, API/orchestration, PostgreSQL repository/migration, bootstrap, mock AI/matching/routing, contracts và tài liệu yêu cầu. Kết quả kiểm thử tự động/persistence trước đó ở [DATABASE_VERIFICATION.md](DATABASE_VERIFICATION.md); bản build ở [ANDROID_APK.md](ANDROID_APK.md).

Không chạy lại test hoặc gọi OpenAI/Storage trong audit chỉ tài liệu này; không tạo/xóa dữ liệu Supabase, không reset backend, không triển khai FPT, không commit/push/merge. Người dùng đã xác nhận app Android kết nối backend; chưa có bằng chứng nghiệm thu toàn bộ pipeline nghiệp vụ trên APK.
