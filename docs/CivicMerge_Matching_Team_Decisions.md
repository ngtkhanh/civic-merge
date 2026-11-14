# CivicMerge — Thông tin cần chốt để triển khai Matching

Ngày soạn: 14/11/2026. Người gửi: phụ trách Matching / Integration (`feature/matching`).

Gửi các thành viên phụ trách Mobile, AI Vision và Backend. Mọi người trả lời phần tương ứng với công việc đang đảm nhận; các đề xuất trong file chưa được coi là quyết định đã thống nhất.

## Quyết định người dùng đã xác nhận — 14/11/2026

- **M1=A:** Người 1 tự sửa Mobile trên `feature/mobile`.
- **B1=A:** Người 3 tự sửa wiring/bootstrap/server/config Backend; Người 4 bàn giao matcher và tests. Dùng `MATCHING_PROVIDER=real` cùng `AdapterFactories.realMatcher` theo Backend, không thêm `MATCHING_MODE`.
- **R1=A, R2=có chặn:** người dùng đã đồng ý loại incident `resolved` khỏi candidates và chặn merge mới vào resolved bằng `INCIDENT_RESOLVED` HTTP 409. Report giữ pending; không tự reopen. Retry một confirm đã thành công trả snapshot cũ trước khi xét status mới.
- Người 4 triển khai lọc status trong matcher; Người 3 triển khai guard atomic ở memory/PostgreSQL và Người 1 xử lý rejection trên Mobile. Việc xác nhận policy chưa đồng nghĩa guard Backend hoặc nhánh các thành viên đã được tích hợp.
- Quy ước features giữ theo nội dung phản hồi Vision; allowlist/chuẩn hóa và bộ ảnh thật vẫn là các mục cần hoàn thiện ở phía Vision. Matcher so khớp tags chính xác và tự loại tag trùng.

Các phần phản hồi bên dưới được giữ để truy vết. Khi có nội dung còn ghi “chờ chốt” về R1/R2, quyết định trong mục này được ưu tiên.

Mục tiêu: thay matching mock bằng GPS + loại sự cố + features, giữ luồng **hai ảnh → người dùng xác nhận → một incident, hai reports, hai ảnh**. Kế hoạch chi tiết: [Matching Implementation Plan](CivicMerge_Matching_Implementation_Plan.md).

## 1. Nội dung giữ theo pipeline hiện tại

- Giữ shared contracts và các endpoint nghiệp vụ hiện có; nếu phát sinh thay đổi thì phối hợp người quản lý contracts.
- Analyze chỉ tạo pending report. Matching chỉ đề xuất; người dùng quyết định create/merge.
- Thiếu GPS: candidates rỗng, có cảnh báo, vẫn tạo báo cáo được.
- Confirm cùng lựa chọn phải idempotent; đổi lựa chọn sau confirm trả conflict.
- Giữ adapter mock để chạy hồi quy. Có thể kiểm tra matcher thật với AI mock trước khi ghép adapters thật.
- Cấu hình matching đề xuất ban đầu: bán kính 100 m, tối đa ba ứng viên, trọng số khoảng cách/features 70/30. Người làm matching sẽ kiểm chứng và hiệu chỉnh bằng bộ mẫu; không yêu cầu cả nhóm chọn công thức.

## 2. Trả lời câu hỏi về features của người làm OpenAI Vision

**Cấu trúc `nhóm:giá_trị` đang dùng phù hợp với scoring dự kiến. Giữ nguyên sáu tags mock hiện có.** Matching dự kiến dùng Jaccard trên tập tags, tức so sánh chính xác chuỗi sau khi loại tag trùng; chưa suy luận từ đồng nghĩa.

Đề xuất chốt bộ từ vựng MVP như sau:

| Nhóm | Giá trị đề xuất | Quy tắc |
|---|---|---|
| `surface` | `asphalt`, `concrete`, `water` | Tối đa một tag mô tả bề mặt chính nhìn thấy tại sự cố |
| `shape` | `irregular`, `round`, `scattered`, `piled`, `spread` | Tối đa một tag chính; ổ gà thường dùng irregular/round, rác scattered/piled, ngập spread |
| `material` | `plastic`, `paper`, `glass`, `metal`, `organic` | Có thể nhiều tags nếu từng vật liệu nhìn thấy rõ; chủ yếu dùng cho rác |

Quy tắc chuẩn hóa đề xuất:

1. Tag dùng lowercase ASCII, không dấu, không khoảng trắng; đúng regex hiện có trong contracts: `^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$`.
2. Dùng đúng bộ từ vựng đã thống nhất. Ví dụ trả `surface:asphalt`, không tạo thêm `surface:road` hoặc `surface:bitumen` cho cùng ý nghĩa.
3. Chỉ trả đặc điểm quan sát được; không chắc thì bỏ tag. Cho phép `features: []`, không dùng `unknown`/`other` làm bằng chứng chung.
4. Loại tag trùng và sắp xếp tags theo thứ tự chuỗi để output dễ đối chiếu; matcher vẫn tự loại trùng để bảo vệ scoring.
5. Chưa thêm nhóm màu sắc, kích thước, độ sâu, mức độ hoặc vị trí vào MVP: ánh sáng/góc chụp làm một số nhóm thiếu ổn định; severity đã có field riêng, khoảng cách dùng GPS.
6. Bộ giá trị trên là quy ước output của adapter, chưa phải enum đã được bổ sung vào shared schema. Không tự sửa schema chung để khóa danh sách khi chưa phối hợp.

Matcher không tự coi tag khác nhau là đồng nghĩa. Nếu bộ ảnh thật cho thấy cần thêm giá trị, hai bên bổ sung vào quy ước và fixtures cùng lúc. Không biến tag sai chính tả thành một tag hợp lệ bằng suy đoán.

Tags như `surface:asphalt` và `shape:irregular` có thể xuất hiện ở nhiều ổ gà khác nhau. Chúng chỉ hỗ trợ xếp hạng trong phạm vi GPS/cùng loại, không chứng minh hai ảnh là cùng sự cố.

**Phản hồi người làm AI Vision (người 4, dựa trên phần đã triển khai):**

- **Bộ tags/quy tắc:** Cấu trúc `nhóm:giá_trị` dùng được với adapter. Prompt hiện tại đã yêu cầu tag lowercase ASCII dạng `group:value`, nhưng mới đưa ví dụ `surface:asphalt`, `shape:irregular`, `water:standing`, `material:plastic`; ví dụ `water:standing` chưa khớp bộ từ vựng MVP. Đề xuất đổi ví dụ đó thành `surface:water` (nước là bề mặt chính nhìn thấy), đồng thời hướng dẫn model chỉ dùng các giá trị trong bảng MVP. Không cần đổi sáu tags mock hiện có; chúng đã phù hợp với bộ từ vựng đề xuất.
- **Chuẩn hóa/kiểm tra:** Adapter gửi prompt và xác thực kết quả bằng `AIAnalysisSchema`. Schema hiện kiểm tra định dạng lowercase ASCII `nhóm:giá_trị`, nhưng chưa kiểm tra allowlist, chưa loại tag trùng hoặc sắp xếp tags; `features: []` được chấp nhận. Vì vậy, hiện chưa bảo đảm quy tắc chuẩn hóa và từ vựng MVP ở đầu ra. Người làm Vision có thể cập nhật prompt và chuẩn hóa/kiểm tra allowlist trong adapter; việc khóa enum trong shared schema cần phối hợp người quản lý contracts, chưa nên tự đổi schema.
- **Mẫu bàn giao:** Repo hiện có fixtures mock cho ổ gà, rác và ngập; đó không phải analysis/ảnh thật và chưa đủ để xác nhận cặp cùng sự cố với cặp khác sự cố ở gần nhau. Chưa có ảnh tham chiếu thật trong phần Vision đã triển khai nên chưa thể chốt ngày bàn giao; cần bộ ảnh được phép sử dụng từ nhóm trước, sau đó chạy adapter và gửi kèm analysis, ghi rõ đâu là mẫu thật và đâu là fixtures mock.

## 3. Mobile — cần chốt phạm vi phối hợp

Matching giữ nguyên response: `incidentId`, `score`, `distanceMeters`, `reasons`. Mobile tiếp tục dùng HTTP; không import implementation matching.

Những điểm cần phối hợp:

- Hiển thị score là **điểm xếp hạng**, không phải phần trăm chắc chắn trùng.
- Hiển thị reasons và ảnh của hồ sơ ứng viên trước khi người dùng xác nhận; vẫn cho chọn tạo mới.
- Khi AI còn mock nhưng matching là thật, không gắn chữ “giả lập” trực tiếp vào khoảng cách GPS đã tính. Thông báo môi trường có thể ghi: “Môi trường demo: phân tích ảnh giả lập; khoảng cách tính theo GPS.”
- Giữ cảnh báo thiếu GPS và xử lý lỗi/retry hiện có.

**Cần trả lời M1:** ai thực hiện phần chỉnh Mobile tối thiểu?

- **A:** người phụ trách Mobile thực hiện theo checklist trên.
- **B:** người phụ trách Matching chuẩn bị patch tối thiểu trong Mobile, chủ sở hữu Mobile review trước khi tích hợp.

Nhờ bổ sung mốc có thể cùng kiểm tra trên iPhone; nếu chưa có thiết bị thì ghi rõ, không làm chậm unit/HTTP tests.

**Phản hồi người làm Mobile (người 1, dựa trên nhánh `feature/mobile`):**

- **Trả lời M1:** Chọn **A** — người phụ trách Mobile trực tiếp thực hiện và quản lý các chỉnh sửa trong `apps/mobile/` trên nhánh `feature/mobile` (hiện nhánh `feature/mobile` đã nâng cấp UI 4 màn hình nên tự cập nhật sẽ tránh xung đột Git).
- **Thực hiện theo checklist mục 3:** Đã cập nhật trên `feature/mobile` đúng 4 điểm:
  1. Hiển thị `score` dưới dạng `Điểm xếp hạng: <score>` (hai chữ số thập phân), không hiển thị dưới dạng phần trăm xác suất trùng.
  2. Hiển thị đầy đủ `reasons` và toàn bộ ảnh minh chứng của hồ sơ ứng viên để đối chiếu trước khi xác nhận; giữ nút chọn tạo hồ sơ mới.
  3. Không gắn chữ `(giả lập)` vào khoảng cách GPS (`distanceMeters`); thông báo môi trường hiển thị đúng câu: *"Môi trường demo: phân tích ảnh giả lập; khoảng cách tính theo GPS."*
  4. Giữ nguyên cảnh báo thiếu GPS (`warnings`), khóa chống bấm đúp (`lock`) và nút thử lại (`retry`) khi lỗi mạng/xác nhận.
- **Mốc kiểm tra trên iPhone:** Đã thiết lập xong **iPhone thật chạy Expo Go (SDK 58.0.0)** kết nối qua LAN và kiểm tra thành công luồng chụp/chọn ảnh (chuẩn hóa JPEG), lấy GPS, tạo mới và hợp nhất hồ sơ. Sẵn sàng phối hợp kiểm tra ngay trên iPhone khi nhánh `feature/matching` ghép thử.

## 4. Backend — cần chốt cách lắp và kiểm thử

Đề xuất kỹ thuật:

- Package matching export thêm `createGpsFeatureMatcher()`, giữ `mockMatcher` và `ruleRouter` hiện có.
- `createMockApp` nhận thêm dependency matcher tùy chọn; mặc định vẫn dùng mock để giữ nguyên demo/hồi quy.
- Server local chọn matcher bằng cấu hình development `MATCHING_MODE=mock|gps-features`; đây là đề xuất mới, chưa có trong server hiện tại.
- Khi Vision/repository/storage còn mock, giữ mode tổng thể là mock. Khi có bootstrap thật, inject cùng matcher qua `createApp`.
- `repository.list()` tiếp tục cung cấp summary có `type`, `location`, `features`; MVP so với summary đại diện incident, chưa tổng hợp features từ toàn bộ reports.
- Matcher không thay kiểm tra đích/loại/trạng thái ở confirm. Transaction và idempotency vẫn thuộc repository.

**Cần trả lời B1:** ai thực hiện wiring/configuration API?

- **A:** người phụ trách Backend sửa bootstrap/server/cấu hình; Matching cung cấp factory và HTTP test cases.
- **B:** người phụ trách Matching chuẩn bị patch tối thiểu các file trên; chủ sở hữu Backend review trước khi tích hợp.

**Cần trả lời B2:** có điểm nào khác với dữ liệu summary hoặc bootstrap đang triển khai trên branch Backend không? Nhờ nêu interface/data bị ảnh hưởng và mốc có thể ghép thử. Nếu chưa sẵn sàng, vẫn chạy HTTP tests riêng với repository bộ nhớ.

### Phản hồi Người 3 — B1: chọn A

**Mình phụ trách wiring/bootstrap/server/cấu hình backend.** Người 4 bàn giao factory matcher, cấu hình mặc định và HTTP/unit test cases. Giữ exports `mockMatcher` và `ruleRouter` để caller và regression cũ tiếp tục chạy.

### Phản hồi Người 3 — B2: interface tương thích; bootstrap/config đã có điểm khác

**1. Giữ nguyên interface và HTTP contract**

`DuplicateMatcher` hiện tại:

`findCandidates({ analysis, location, incidents }): Promise<MatchCandidate[]>`

- `analysis` là `AIAnalysis`; `location` của input matcher là GPS hợp lệ, không nullable. Khi report thiếu GPS, backend **không gọi matcher**, trả candidates rỗng và cảnh báo `GPS_UNAVAILABLE` nhưng vẫn cho tạo pending report.
- `incidents` là `IncidentSummary[]`, có `id/type/location/features/status` cùng các field summary đang có. `location` của từng incident có thể null; matcher cần loại những incident không thể tính khoảng cách.
- Output tiếp tục là `incidentId, score, distanceMeters, reasons`. Dùng `MatchCandidateSchema` hiện có; score trong 0..1 là điểm xếp hạng, không phải xác suất chắc chắn trùng. Backend validate output trước khi lưu ảnh/report.
- Summary đại diện incident được lấy từ report tạo đầu tiên. Merge hiện **không tổng hợp lại features/location/description/severity/cover** từ các report bổ sung; chỉ tăng count, cập nhật thời gian, gắn report/history/snapshot và giữ team của incident. Matching MVP so theo summary đại diện như đề xuất; nếu sau này cần features tổng hợp thì phải chốt riêng.
- Backend truyền summary có URL ảnh HTTP dùng được sau khi map tham chiếu Storage. Matcher không cần biết marker nội bộ `.invalid`, không truy cập trực tiếp bucket/database hoặc đọc toàn bộ ảnh/reports.

**2. Dùng cấu hình đang có, không thêm selector song song**

Backend đã có `apps/api/src/bootstrap/configured.ts` và registry `AdapterFactories.realMatcher?: () => DuplicateMatcher`. Server chính dùng bootstrap này; `createMockApp` được giữ cho caller/test mock cũ.

| Thành phần | Biến đang có | Giá trị |
|---|---|---|
| Matching | `MATCHING_PROVIDER` | `mock` hoặc `real` |
| Vision | `AI_PROVIDER` | `mock` hoặc `openai` |
| Repository | `PERSISTENCE_MODE` | `memory` hoặc `postgres` |
| Storage | `STORAGE_PROVIDER` | `local` hoặc `supabase` |

**Đề nghị dùng `MATCHING_PROVIDER=real` cho factory GPS/features, không thêm `MATCHING_MODE=mock|gps-features` song song.** `gps-features` có thể là tên thuật toán trong tài liệu; tên provider trong schema health hiện là `real`. Nếu cần đổi tên chung phải phối hợp contracts/caller trước.

Factory `createGpsFeatureMatcher()` phù hợp để bàn giao. Mẫu wiring **dự kiến sau khi nhận factory**, chưa phải code đã được tích hợp:

`createConfiguredBackend(env, { root, factories: { realMatcher: () => createGpsFeatureMatcher() } })`

Hiện `server.ts` chưa đăng ký factory thật; chọn `real` ngay sẽ báo lỗi startup, không fallback về mock. Người 4 gửi đường dẫn/export, chữ ký/options và defaults của factory để mình import và nối đúng một lần.

`createMockApp` hiện chưa có optional matcher như đề xuất. Để test HTTP riêng, có thể inject trực tiếp matcher vào `createApp` hoặc dùng `createConfiguredBackend` với memory/local + mock Vision và factory thật. Nếu test harness thật sự cần mở rộng `createMockApp`, mình sẽ thêm optional dependency theo B1=A, giữ mặc định mock và test cũ; chưa coi phần đó đã triển khai.

**3. Mixed mode, controls và launcher**

- AI mock + matcher thật vẫn `mode=mock`; health đã có `capabilities.vision=mock`, `capabilities.matching=real` để Mobile phân biệt thành phần. Giữ response health cũ tương thích. Việc sửa nhãn khoảng cách/score trên Mobile cần Người 1 trả lời M1.
- Với configured bootstrap, scenario/reset controls chỉ có ở tổ hợp **memory/local/mock/mock**. Chọn matcher thật thì không dựa vào API controls để đổi fixture; dùng `MOCK_SCENARIO` khi khởi tạo môi trường test riêng.
- **`CivicMerge.cmd` hiện cố ý ép AI/matching mock để hồi quy/demo lưu trữ.** Không dùng launcher đó làm bằng chứng đã chạy matcher thật; khi ghép matcher, mình chuẩn bị cách chạy configured server riêng với selector thật, không âm thầm đổi demo đang sử dụng.
- Có thể ghép thử ở port riêng, ví dụ 3012 nếu còn trống, với `PERSISTENCE_MODE=memory`, `STORAGE_PROVIDER=local`, `AI_PROVIDER=mock`, `MATCHING_PROVIDER=real`, `MOCK_MODE=true`; không cần OpenAI/Supabase credential cho vòng này. Sau đó mới kiểm tra PostgreSQL + Storage với dữ liệu test riêng.

**4. Phạm vi kiểm thử và mốc ghép thử**

- Backend interface/registry/schema và PostgreSQL/Storage đã sẵn sàng để ghép thử ngay khi nhận commit + factory + cases của Người 4; không cần chờ Vision thật. Chưa có giờ ghép cụ thể được cả nhóm xác nhận nên mình không tự ghi một lịch hẹn.
- Vòng đầu: matcher thật + fixture AI + memory/local, HTTP server cổng riêng. Kiểm tra gần/xa, khác loại, location null/thiếu GPS, features rỗng/trùng, top-k/thứ tự/reasons và output schema. Người 4 kiểm chứng công thức/ngưỡng bằng mẫu.
- Vòng sau: PostgreSQL test riêng và bucket/object prefix test riêng. Hồi quy create/merge, confirm đồng thời, snapshot retry cũ, đổi lựa chọn 409, đích mất/sai loại vẫn pending. Không dùng database/bucket app để reset hoặc seed fixtures.
- Hiện đã có test API/transaction/Storage và kiểm tra Chrome Android gọi health PostgreSQL/Storage. **Chưa có matcher GPS/features thật trong nhánh này, chưa nghiệm thu iPhone hoặc hai điện thoại.**

## 5. Cả nhóm — chốt cách xử lý incident resolved

Đây là quyết định nghiệp vụ còn mở. Kế hoạch matching hiện tại giữ hành vi cũ, chưa loại theo status; repository bộ nhớ hiện cũng chưa chặn merge vào resolved.

**Cần trả lời R1:** incident đã resolved có xuất hiện trong danh sách nghi trùng không?

- **A — Đề xuất:** loại khỏi candidates; sự cố xuất hiện lại có thể tạo incident mới.
- **B:** vẫn đề xuất và cho người dùng cân nhắc bổ sung minh chứng vào incident cũ.

**Backend cần chốt tiếp R2:** nếu chọn R1=A, confirm có chặn merge mới vào incident resolved không? Đề xuất có, kể cả incident vừa resolved sau lúc analyze; Backend thống nhất mã lỗi/response và kiểm tra atomically. Retry một confirm đã thành công vẫn phải trả kết quả cũ, kể cả incident được resolved về sau.

Nếu chọn R1=B, cần nêu rõ merge có giữ status resolved hay mở lại hồ sơ. Không tự thêm hành vi mở lại trong matcher. Mobile hiển thị lỗi/trạng thái tương ứng với quyết định được chốt; Vision không phải thay đổi vì quy tắc này.

### Phản hồi Người 3 — ý kiến R1 và đề xuất R2

**R1: mình đề xuất A — loại incident resolved khỏi candidates.** Sự cố xuất hiện lại có thể tạo incident mới, tránh tiếp tục tăng minh chứng của một hồ sơ đã kết thúc. Đây là ý kiến Người 3; cần nhóm/người chốt nghiệp vụ xác nhận, không tự nhận là quyết định đã thống nhất.

**R2: nếu nhóm chốt R1=A, mình đề xuất có chặn merge mới vào resolved ngay trong transaction.** Backend chịu trách nhiệm triển khai ở cả repository PostgreSQL và memory để giữ parity. Trình tự dự kiến:

1. Khóa report; kiểm tra confirmation đã lưu trước.
2. Nếu đã thành công cùng lựa chọn, trả nguyên `ConfirmResponse` snapshot cũ, **kể cả incident nay đã resolved**. Nếu đổi lựa chọn, vẫn trả `REPORT_ALREADY_CONFIRMED` 409.
3. Với report còn pending và yêu cầu merge mới: khóa incident đích, kiểm tra tồn tại/cùng loại rồi đọc status dưới cùng khóa. Nếu status là resolved, từ chối trước khi tăng count/gắn report/thêm history hoặc confirmation.
4. Rollback, giữ report pending, không xóa ảnh. Người dùng có thể chọn tạo mới hoặc đích hợp lệ khác. Nếu merge hợp lệ, giữ nguyên status đang có (open/in_progress), không tự reopen incident.

Mã lỗi **đề xuất mới, chưa có trong code hiện tại**:

`HTTP 409 — {"error":{"code":"INCIDENT_RESOLVED","message":"Hồ sơ đích đã được xử lý. Hãy tạo hồ sơ mới."}}`

Mobile cần xử lý mã này là một rejection chắc chắn để mở lại lựa chọn. Helper client hiện chưa có `INCIDENT_RESOLVED` trong whitelist; cần phối hợp bổ sung khi nhóm chốt policy. Không coi mọi lỗi 409 là có thể đổi lựa chọn, vì `REPORT_ALREADY_CONFIRMED` có nghĩa khác.

Race giữa resolve và confirm phải tuân theo thứ tự khóa/commit của incident: resolve đã commit trước lúc confirm kiểm tra thì merge bị chặn; confirm commit trước thì merge có thể thành công rồi incident được resolved sau đó. Retry confirm đã thành công vẫn trả snapshot ban đầu, không thêm count/history.

Cases cần bổ sung khi triển khai policy: đã resolved trước analyze; resolved sau analyze nhưng trước confirm; concurrent resolve/confirm; retry cùng lựa chọn sau resolved; đổi lựa chọn vẫn conflict; rollback giữ pending/count/history/snapshot; memory/PostgreSQL cùng hành vi.

**Hiện trạng phải phân biệt:** cả hai repository hiện chưa có guard resolved; merge vào resolved hiện không bị chặn và status được giữ nguyên. Chưa có workflow/API cập nhật status trong chặng MVP này. Chặn merge/filter candidates là thay đổi cần thực hiện sau khi nhóm chốt, không phải đã hoàn thành chỉ vì ghi phản hồi này. Schema đã có status resolved nên guard không tự đòi một migration mới; nếu phát sinh đổi schema thật thì thêm migration mới, không sửa migration đã áp dụng.

Nếu nhóm chọn R1=B thì cần chốt lại rõ việc giữ status resolved hoặc reopen. Mình không đề xuất tự reopen trong matcher/confirm khi chưa có quyết định nghiệp vụ và history tương ứng.

## 6. Lịch tích hợp và mẫu trả lời

Mỗi người phát triển/test trên backend riêng. Khi demo hai điện thoại, dùng cùng một backend và cùng nguồn dữ liệu. Nhờ Backend xác nhận người vận hành và thời điểm ghép thử; thống nhất trước khi đổi phiên bản/reset dữ liệu chung. Không gửi secrets hoặc nội dung `.env` trong phản hồi.

Mỗi thành viên có thể copy phần tương ứng:

```text
Mobile:
- M1: Chọn A — Người phụ trách Mobile (`feature/mobile`) trực tiếp cập nhật trong `apps/mobile/` để tránh xung đột với phần nâng cấp giao diện 4 màn hình đang triển khai.
- Chỗ cần đổi khác checklist (nếu có): Không có thay đổi lệch checklist; đã áp dụng đầy đủ: hiển thị `Điểm xếp hạng: <score>` (không dùng %), bỏ chữ `(giả lập)` cạnh `distanceMeters`, hiển thị thông báo *"Môi trường demo: phân tích ảnh giả lập; khoảng cách tính theo GPS."*, giữ nguyên cảnh báo thiếu GPS và cơ chế retry/idempotency. Về quyết định nghiệp vụ R1 (mục 5): Mobile đồng ý phương án **A** (loại incident đã `resolved` khỏi danh sách `candidates`).
- Mốc có thể kiểm tra iPhone: Đã có sẵn iPhone thật cài Expo Go (SDK 58.0.0) và đã test thông luồng LAN + upload ảnh + create/merge. Có thể ghép kiểm tra ngay khi Matching/Backend sẵn sàng.

AI Vision:
- Đồng ý bộ tags/quy tắc: Đồng ý cấu trúc `nhóm:giá_trị` và sáu tags mock hiện có. Trong adapter, prompt hiện còn ví dụ `water:standing`, chưa đúng từ vựng MVP; cần đổi thành `surface:water` và hướng dẫn model chỉ dùng các giá trị trong bảng.
- Chuẩn hóa, kiểm tra tags và features rỗng hiện có: Adapter đã validate kết quả bằng `AIAnalysisSchema`, kiểm tra định dạng lowercase ASCII và chấp nhận `features: []`; chưa kiểm tra allowlist, loại tag trùng hoặc sắp xếp tags. Tôi sẽ chuẩn hóa/deduplicate/sort và validate allowlist trong adapter, không tự sửa shared schema.
- Mẫu ảnh/analysis thực tế và mốc bàn giao: Chưa có ảnh sự cố thật hoặc kết quả Vision thật. PNG trong `mocks/images/` là ảnh tổng hợp để test upload/UI, không dùng làm bộ đánh giá. Cần nhóm cung cấp sáu ảnh JPEG được phép sử dụng (hai ảnh mỗi loại); sau đó tôi chạy kiểm tra Vision thật và gửi analysis. Chưa chốt ngày bàn giao.
Backend — Người 3 đã trả lời:
- B1: A. Người 3 làm wiring/bootstrap/server/config; Người 4 bàn giao factory và cases.
- B2: Interface summary/candidates tương thích. Dùng MATCHING_PROVIDER=mock|real và AdapterFactories.realMatcher đang có; không thêm MATCHING_MODE song song. createMockApp optional matcher chưa triển khai; có thể test bằng createApp/configured bootstrap. Summary giữ features/location đại diện, chưa tổng hợp reports.
- Ý kiến R1: đề xuất A, chờ nhóm chốt; không tự coi là quyết định chung.
- Đề xuất R2: nếu chốt A, chặn merge mới vào resolved dưới khóa transaction; lỗi mới dự kiến INCIDENT_RESOLVED 409, report vẫn pending, không reopen. Retry confirm thành công trả snapshot cũ trước khi xét status mới. Guard này chưa triển khai.
- Mốc ghép thử: sau khi nhận commit/export factory, có thể ghép mock Vision + matcher thật trước, chưa cần Vision thật. Giờ cụ thể phối hợp với Người 4, chưa hẹn thay nhóm.
- Người chạy backend chung: Người 3 nhận vận hành trên laptop của mình khi nhóm thống nhất phiên demo; Người 4 điều phối integration. Thống nhất URL và thời điểm đổi phiên bản trước, không reset dữ liệu thật hoặc gửi secrets.

Người chốt nghiệp vụ/nhóm:
- Quyết định R1: A/B
- Quyết định R2 nếu áp dụng: ...
```

Đã nhận phản hồi cả ba vai trò và người dùng đã chốt R1/R2 như mục quyết định đầu file. Matching triển khai module và tests; Mobile/Backend thực hiện các thay đổi thuộc ownership của mình theo M1=A/B1=A. Chưa đánh dấu nghiệm thu tích hợp chỉ từ nội dung trao đổi này.

