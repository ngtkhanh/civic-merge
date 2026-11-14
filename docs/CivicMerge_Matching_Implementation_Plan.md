# CivicMerge — Kế hoạch triển khai Matching / Routing / Integration

Ngày lập: 14/11/2026. Branch: `feature/matching`. Chủ sở hữu: Người 4.

Trạng thái cập nhật 14/11/2026: đã triển khai matcher GPS/features và tests trên `feature/matching`; xem [bàn giao Matching](CivicMerge_Matching_Handoff.md) để biết kiểm chứng và phần tích hợp còn mở. Các mốc bên dưới là kế hoạch gốc, được điều chỉnh theo quyết định nhóm tại mục cập nhật sau đây.

### Cập nhật sau phản hồi và xác nhận người dùng

- M1=A/B1=A: Người 1 tự sửa Mobile, Người 3 tự nối API/bootstrap/config. Người 4 không sửa các implementation này trên nhánh matching.
- Dùng `MATCHING_PROVIDER=real` và `AdapterFactories.realMatcher` từ configured bootstrap của Backend; bỏ đề xuất selector `MATCHING_MODE` và không yêu cầu thêm option vào `createMockApp`. HTTP tests nhánh này inject trực tiếp qua `createApp`.
- Người dùng đã chốt R1=A/R2=có chặn: matcher loại resolved; Backend chặn merge mới bằng `INCIDENT_RESOLVED` 409, giữ pending; retry thành công trả snapshot cũ trước khi xét status. Guard Backend cần được Người 3 triển khai/kiểm chứng riêng.
- Khi chạy configured bootstrap của Backend với matcher thật, dùng `MOCK_SCENARIO` lúc khởi tạo để chọn AI fixture. Không dựa vào controls scenario/reset của tổ hợp mock hoàn toàn.
- Configured bootstrap/health capabilities mà Backend báo cáo chưa có trong source nhánh này; hướng dẫn registry chỉ áp dụng khi ghép nhánh Backend. Phản hồi Mobile/iPhone là của Người 1, chưa phải nghiệm thu matcher mới trên thiết bị.
- Giữ mock/routing trong `src/index.ts` để giảm thay đổi; chỉ tách geography/scoring/duplicate cho implementation thật.

## 1. Kết quả cần đạt

1. Ảnh đầu tiên được phân tích và tạo report pending; người dùng xác nhận để tạo incident A.
2. Ảnh thứ hai của cùng sự cố, có GPS gần A, được đề xuất ghép vào A với khoảng cách thực và điểm xếp hạng có giải thích.
3. Chỉ sau khi người dùng xác nhận merge, report thứ hai mới được gắn vào A.
4. Backend có **1 incident, 2 reports, 2 URL ảnh khác nhau**; retry không làm tăng các số lượng này.
5. Khác loại hoặc ngoài bán kính không xuất hiện trong candidates. Thiếu GPS vẫn báo cáo được, candidates rỗng và có `GPS_UNAVAILABLE`.

Điểm xếp hạng không phải xác suất hai ảnh thuộc cùng sự cố. Features là tags từ Vision, chưa phải phép so sánh trực tiếp pixel hoặc embedding ảnh.

Tham chiếu: [pipeline đội 4 người](CivicMerge_4_Member_Integration_Pipeline.md), [thỏa thuận phát triển](CivicMerge_Team_Development_Agreement.md), [nền mock](CivicMerge_Mock_Foundation_Plan.md), [API contract](API_CONTRACT.md).

## 2. Hiện trạng đã đối chiếu với source

| Thành phần | Hiện trạng | Hệ quả cho kế hoạch |
|---|---|---|
| Git tại thời điểm lập kế hoạch | `feature/matching`, cùng commit `0ce33ea` với các ref local `main` và `origin/main` | Có nền để phát triển; kiểm tra lại ref trước khi tích hợp, không suy trạng thái remote mới nhất từ ref local |
| `packages/matching/src/index.ts` | `mockMatcher` lọc cùng loại/có vị trí; luôn trả `score=0.92`, `distanceMeters=12` | Bổ sung matcher thật dưới export riêng, giữ mock để hồi quy |
| `ruleRouter` | Đã ánh xạ đủ ba loại sang tổ xử lý thí điểm | Giữ hành vi hiện có, bổ sung kiểm chứng đủ ba nhãn |
| `DuplicateMatcher` | Nhận `analysis`, `location`, `IncidentSummary[]` | Đủ dữ liệu cho MVP; không cần đổi contract |
| `IncidentSummary` | Có `type`, `location`, `features`, `status` | Matcher không cần truy vấn detail từng incident |
| API analyze | Validate GPS/AI, gọi matcher nếu có GPS, validate output, lưu ảnh và tạo pending | Giữ orchestration; matcher không tạo report/incident |
| API confirm | Repository kiểm tra đích merge, loại sự cố, idempotency | Không chuyển trách nhiệm confirm vào matcher |
| Bootstrap/server | Chỉ lắp mock; `server.ts` từ chối chạy khi `MOCK_MODE` khác `true` | Cần bước phối hợp Người 3 để chạy app với matcher thật; không chỉ đổi env thành real |
| Kiểm thử | HTTP nền mock đã có; `test:modules` mới kiểm tra matcher với incidents rỗng | Cần thêm kiểm thử thuật toán và HTTP với matcher thật được inject |
| Repository bộ nhớ | Summary giữ vị trí/features từ report tạo incident, chưa tổng hợp sau merge | MVP so với summary này; không giả định có features của mọi report |
| Mobile | Nhận đầy đủ score/khoảng cách/reasons; hiện thêm chữ “giả lập” theo mock mode toàn ứng dụng | Phối hợp Người 1 để chú thích đúng môi trường khi AI mock đi cùng matcher thật |

Một số tài liệu nền vẫn mô tả chưa tạo branch/chưa tích hợp main. Khi bắt đầu triển khai, dùng Git để xác nhận nền code, dùng báo cáo kiểm chứng và thao tác thực tế để xác nhận nghiệm thu; không tự đánh dấu hoàn tất theo tên branch.

## 3. Vị trí của module trong pipeline

```text
Mobile: ảnh + GPS
  -> POST /api/reports/analyze
  -> API validate input
  -> VisionAnalyzer -> AIAnalysis đã validate
  -> repository.list() -> IncidentSummary[]
  -> DuplicateMatcher.findCandidates(...)
       cùng loại -> có GPS -> trong bán kính -> chấm điểm -> sắp xếp/top K
  -> API validate candidates, lưu ảnh, tạo pending report
  -> Mobile hiển thị analysis + candidates + ảnh detail
  -> Người dùng chọn create hoặc merge
  -> POST /api/reports/confirm
  -> IncidentRouter + repository.confirm() atomic/idempotent
  -> Mobile đọc lại detail: reports, ảnh, đơn vị xử lý, history
```

Thiếu GPS: API bỏ qua matcher và trả `candidates=[]` cùng cảnh báo hiện có. Chữ ký matcher tiếp tục yêu cầu `Location` hợp lệ; không mở rộng thành nullable chỉ để xử lý lại nhánh API đã có.

Matcher là module tính toán: không gọi HTTP/OpenAI/Supabase, không ghi dữ liệu, không chọn thay người dùng, không đọc secret và không import implementation của API. Snapshot candidates tại analyze không thay thế kiểm tra dữ liệu hiện hành tại confirm.

## 4. Thiết kế thuật toán MVP

Các giá trị dưới đây là cấu hình khởi đầu để triển khai và kiểm chứng, chưa phải ngưỡng đã được hiệu chỉnh bằng dữ liệu hiện trường.

### 4.1. Interface và cấu hình

Giữ nguyên interface dùng chung:

```ts
interface DuplicateMatcher {
  findCandidates(input: {
    analysis: AIAnalysis;
    location: Location;
    incidents: IncidentSummary[];
  }): Promise<MatchCandidate[]>;
}
```

Thêm factory trong package matching:

```ts
createGpsFeatureMatcher(options?: {
  radiusMeters?: number;  // mặc định 100
  maxCandidates?: number; // mặc định 3
}): DuplicateMatcher
```

- Bán kính phải hữu hạn và lớn hơn 0; top K phải là số nguyên dương. Cấu hình sai phải báo lỗi khi tạo matcher.
- Dùng schema từ contracts để kiểm tra input/output tại boundary module; không viết lại schema riêng hoặc tự sửa tag sai thành tag hợp lệ.
- Input sai schema là lỗi dữ liệu/module, không âm thầm trả danh sách rỗng để che lỗi. API hiện validate dữ liệu trước khi ghi ảnh/report.
- Không thêm dependency để tính khoảng cách hoặc Jaccard.

### 4.2. Tính khoảng cách và chọn ứng viên

1. Chỉ xét incident có `incident.type === analysis.type`, `incident.location !== null` và `incident.status !== 'resolved'`.
2. Tính Haversine bằng độ chuyển sang radian, bán kính Trái Đất `R = 6_371_000 m`; chặn giá trị trung gian `a` vào `[0, 1]` để ổn định sai số số thực.
3. Giữ incident có khoảng cách **không vượt quá** `radiusMeters`.
4. Dùng khoảng cách chưa làm tròn để lọc và xếp hạng. Chỉ làm tròn khi tạo output/chuỗi hiển thị.

Không dùng severity, mô tả tự do, reportCount hoặc thời điểm tạo làm bằng chứng trùng trong MVP. Theo quyết định đã chốt, loại resolved; open/in_progress vẫn có thể được đề xuất.

### 4.3. Chấm điểm

Features hợp lệ theo quy ước tag `key:value` trong contracts. So sánh chính xác sau khi loại tag trùng trong mỗi mảng; không tự suy luận từ đồng nghĩa hoặc dịch tag.

```text
distanceScore = 1 / (1 + distanceMeters / radiusMeters)
featureScore  = |unique(newFeatures) ∩ unique(incidentFeatures)|
                / |unique(newFeatures) ∪ unique(incidentFeatures)|
score         = 0.7 * distanceScore + 0.3 * featureScore
```

Nếu một trong hai bên không có features, `featureScore=0`; hai mảng rỗng không được coi là khớp hoàn toàn. Giữ nguyên trọng số để không nâng mức hỗ trợ của bằng chứng khi thiếu features.

MVP dùng loại + bán kính làm điều kiện lấy ứng viên, chưa thêm ngưỡng score tối thiểu. Score dùng để xếp hạng tối đa ba hồ sơ gần cùng loại; một candidate không đồng nghĩa khẳng định trùng. Nếu thử nghiệm cho thấy quá nhiều đề xuất yếu, hiệu chỉnh bán kính/ngưỡng bằng bộ mẫu có nhãn và bổ sung ca hồi quy.

Ví dụ với bán kính 100 m:

| Khoảng cách | Feature Jaccard | Score xấp xỉ | Ý nghĩa |
|---|---|---|---|
| 10 m | 1 | 0.9364 | Gần và cùng tags |
| 10 m | 0 | 0.6364 | Gần nhưng chưa có tags chung |
| 60 m | 1 | 0.7375 | Xa hơn nhưng tags tương đồng |
| 101 m | 1 | Không trả | Features không được vượt qua điều kiện bán kính |

Sắp xếp theo score giảm dần, khoảng cách tăng dần, rồi `incidentId` theo thứ tự chuỗi cố định. Cắt top K sau khi sắp xếp. Không phụ thuộc thứ tự repository trả về; không thay đổi mảng/objects đầu vào.

Output: `distanceMeters` làm tròn đến 0.1 m, `score` đến bốn chữ số thập phân. So sánh/lọc vẫn dùng giá trị chưa làm tròn; score luôn hữu hạn trong `[0,1]`.

### 4.4. Giải thích kết quả và routing

`reasons` phải phản ánh dữ liệu thực, theo thứ tự ổn định, ví dụ:

- `Cùng loại sự cố: pothole`.
- `Cách khoảng 10 m, trong bán kính 100 m`.
- `Đặc điểm chung: shape:irregular, surface:asphalt` hoặc `Chưa có đặc điểm chung` / `Chưa đủ features để so sánh`.

Sắp xếp tags trong reason để cùng input cho cùng kết quả. Không ghi “92% chắc chắn” hoặc “cùng ổ gà” chỉ từ điểm xếp hạng.

Giữ `ruleRouter`: `pothole` → `Tổ đường bộ (thí điểm)`; `trash` → `Tổ vệ sinh (thí điểm)`; `flood` → `Tổ thoát nước (thí điểm)`. Đây là đơn vị giả định phục vụ MVP. Merge giữ đơn vị đang được gán cho incident đích theo repository hiện tại.

## 5. File dự kiến và trách nhiệm

Các file dưới đây mô tả phạm vi kế hoạch; trạng thái implementation thực tế được ghi trong tài liệu bàn giao. Các thay đổi Mobile/API do chủ sở hữu thực hiện theo M1=A/B1=A.

| File/khu vực | Thay đổi dự kiến | Phụ trách |
|---|---|---|
| `packages/matching/src/geography.ts` | Haversine, tính khoảng cách bằng mét | Người 4 |
| `packages/matching/src/scoring.ts` | Feature sets, Jaccard, điểm khoảng cách/tổng | Người 4 |
| `packages/matching/src/duplicate.ts` | Factory, validate, lọc, rank/top K, reasons | Người 4 |
| `packages/matching/src/mock.ts` | Tách mock hiện có, giữ nguyên hành vi | Người 4 |
| `packages/matching/src/routing.ts` | Tách bảng routing hiện có, giữ nhãn | Người 4 |
| `packages/matching/src/index.ts` | Export `createGpsFeatureMatcher`, `mockMatcher`, `ruleRouter` | Người 4 |
| `packages/matching/tests/*.test.ts`, `tests/fixtures/matching.ts` | Unit tests và fixtures incident có UUID/GPS/features/schema hợp lệ | Người 4 |
| `packages/matching/package.json`, `tsconfig.json` | Thêm script `test`, đưa cả tests vào typecheck package | Người 4 |
| `tests/integration/matching.test.ts` | HTTP tests inject matcher thật | Người 4, phối hợp Người 3 khi cần sửa harness API |
| `apps/api/src/bootstrap/configured.ts`, `server.ts` trên branch Backend | Đăng ký `AdapterFactories.realMatcher`; chọn bằng `MATCHING_PROVIDER=real`, giữ selector hiện có | Người 3 |
| Bootstrap thật của API khi có | Inject factory thật cùng Vision/repository/storage thật | Người 3 |
| Chú thích kết quả trên Mobile | Phản ánh đúng môi trường hỗn hợp; hiển thị điểm là điểm xếp hạng | Người 1 phối hợp Người 4 |
| `docs/INTEGRATION_TESTS.md`, `TASK_BOARD.md`, `ARCHITECTURE.md`, README | Bổ sung cách chạy matcher thật và ghi kết quả theo phạm vi đã kiểm chứng | Người 4, phối hợp chủ sở hữu nội dung |

Fixtures dùng chung đặt dưới `tests/fixtures/` để được `tsconfig.tools.json` hiện tại kiểm tra. Không đổi fixtures AI nền chỉ để làm đẹp điểm matching; bộ mẫu mới phải có cả mẫu đúng và mẫu khó.

## 6. Cách tích hợp mà giữ được nền mock

1. Người 4 hoàn thiện module và fixtures độc lập, giữ nguyên các export mock/routing mà caller đang dùng.
2. Test HTTP mới inject `createGpsFeatureMatcher()` trực tiếp vào `createApp` với memory/local và fixture Vision riêng; không cần sửa `createMockApp`.
3. Người 3 dùng configured bootstrap, `MATCHING_PROVIDER=mock|real` và registry `AdapterFactories.realMatcher`. Factory được đăng ký tại server/bootstrap sau khi nhận bàn giao; matcher không tự đọc env. Không tạo selector song song hoặc đổi launcher đang ép mock.
4. Khi chỉ matching là thật, giữ `MOCK_MODE=true`, health `mode=mock` và ghi rõ **AI mock + matching GPS/features thật + dữ liệu bộ nhớ** trong hướng dẫn/log khởi động. `.env.example` ở root là file mẫu backend hiện có; cấu hình chạy được đọc từ `apps/api/.env`.
5. Người 1 xử lý chú thích “giả lập” hiện gắn với khoảng cách theo mode toàn app: mô tả môi trường hỗn hợp ở thông báo chung, khoảng cách và reasons thể hiện giá trị đã tính. Không tắt mock mode Mobile khi vẫn cần scenario controls của AI mock.
6. Khi Người 2/3 có adapters thật, bootstrap thật dùng cùng `createGpsFeatureMatcher()` qua `createApp`. Không đổi business request/response hoặc đưa selector provider vào API analyze. Theo configured bootstrap của Backend, controls scenario/reset chỉ có khi memory/local/mock/mock; dùng `MOCK_SCENARIO` khi khởi tạo vòng test matcher thật.

Phần module/test fixtures có thể làm ngay, không cần đợi Vision hoặc Supabase. Phần chỉnh API/cấu hình dùng chung được phối hợp với Người 3; không tự sửa contract/lockfile để giải quyết vấn đề nằm ở bootstrap.

## 7. Thứ tự triển khai gắn với timeline pipeline

Đây là ngân sách dự kiến cho phần việc Người 4 khi các thành viên cùng triển khai. Không coi thời gian chờ thiết bị, Vision hoặc Supabase là đã nghiệm thu. Nền code đã có nên không dựng lại workspace/Mobile/API từ đầu.

| Mốc trong pipeline | Việc thực hiện | Điều kiện qua mốc |
|---|---|---|
| **0–20 phút: chốt interface/scoring** | Kiểm tra nền; xác nhận tag với Người 2; ghi cấu hình bán kính/top K; thống nhất injection với Người 3 và nhãn môi trường với Người 1 | Có fixture contract hợp lệ; rõ nơi lắp matcher; không có breaking change |
| **20–60 phút: Haversine/fixtures** | Tách file theo module, giữ export cũ; triển khai khoảng cách; tạo fixtures gần/xa/khác loại/thiếu vị trí | Unit test cùng tọa độ, khoảng cách biết trước, đối xứng, qua kinh tuyến 180°, gần cực, sai số và input không hợp lệ đạt |
| **60–120 phút: matching GPS + loại + features** | Viết lọc, Jaccard, tổng điểm, reasons, rank/top K, validation và tính xác định | Tất cả unit tests matcher đạt; không dùng constants mock cho kết quả thật |
| **120–170 phút: scoring/routing và nối API** | Kiểm chứng thứ tự rank bằng bộ mẫu; test đủ ba routing; Người 3 hỗ trợ option injection/chọn matcher; giữ mặc định mock | Cùng app trả khoảng cách/điểm thay đổi theo input; mock hồi quy vẫn chạy; môi trường được mô tả đúng |
| **170–210 phút: create/merge qua HTTP** | Chạy HTTP suite với matcher thật, AI mock và repository riêng; kiểm tra pending, create, merge, retry/conflict và số bản ghi | Một incident, hai reports/ảnh; không ghi incident lúc analyze; retry không tăng dữ liệu |
| **210–260 phút: tích hợp thật và hồi quy** | Thay AI/repository/storage khi các thành viên bàn giao; kiểm tra ảnh thật, GPS gần/xa, hai client, lỗi và đọc lại sau restart backend khi có Supabase | Ghi riêng PASS/FAIL/CHƯA CHẠY cho từng adapter và môi trường; xử lý lỗi ảnh hưởng luồng demo |
| **260–300 phút: ổn định/bàn giao demo** | Chốt cấu hình từ bộ mẫu; ngừng chỉnh thuật toán nếu không có lỗi; ghi bước chạy, giới hạn, ca còn thiếu và cấu hình dự phòng | Người khác chạy lại được; chưa có thiết bị thì vẫn ghi chưa nghiệm thu hai điện thoại |

Chia thay đổi thành ba phần để review: (1) khoảng cách + fixtures/tests; (2) matcher/scoring/routing; (3) wiring đã phối hợp + HTTP tests + hướng dẫn/demo. Commit/push/PR/merge thực hiện theo yêu cầu Git của người dùng, không phát sinh chỉ vì đã hoàn thành một mốc kế hoạch.

## 8. Ma trận kiểm thử cần bổ sung

### Thuật toán và module

| Nhóm | Ca bắt buộc | Kết quả kiểm tra |
|---|---|---|
| Haversine | Cùng điểm; 1° kinh độ tại xích đạo; đổi A/B; gần cực; hai phía ±180°; hai điểm đối diện | Khoảng cách đúng trong sai số định trước, hữu hạn, không âm; không nhầm độ/radian |
| Boundary bán kính | Điểm ngay trong, tại và ngay ngoài 100 m | Lọc bằng khoảng cách gốc, có tolerance số thực nhỏ được định nghĩa trong test, không nới bán kính theo giá trị làm tròn hiển thị |
| Candidate | Incidents rỗng; cùng loại gần; cùng loại xa; khác loại ở cùng điểm; incident không có GPS | Chỉ trả ID của incident đầu vào thỏa điều kiện |
| Features | Trùng hết/một phần/không trùng; tags lặp; một hoặc hai mảng rỗng | Jaccard đúng; tags lặp không tăng điểm; features thiếu không thành khớp hoàn toàn |
| Rank/top K | Nhiều hơn ba incident; đảo thứ tự input; bằng điểm và khoảng cách | Kết quả xác định, tie-break bằng ID, đúng top K |
| Reasons/schema | Khoảng cách và tag thực, input không hợp lệ, cấu hình không hợp lệ | Giải thích đúng dữ liệu; output qua `MatchCandidateSchema`; không che lỗi bằng candidates rỗng |
| Tính thuần | Deep-freeze input, gọi lặp lại, chạy hai matcher khác cấu hình | Không sửa input; kết quả lặp lại giống nhau; không dùng state chung |
| Routing | `pothole`, `trash`, `flood` | Đủ ba nhãn tổ xử lý thí điểm như hiện có |

### HTTP với matcher thật được inject

1. Analyze ảnh A: candidates rỗng, report pending, danh sách incident vẫn rỗng.
2. Confirm create: một incident, một report confirmed, ảnh truy cập được, đúng tổ xử lý.
3. Analyze ảnh B với GPS gần A và features phù hợp: candidate trỏ tới A, khoảng cách gần giá trị độc lập kỳ vọng; tính lại score từ công thức để đối chiếu. Trước confirm, A vẫn chỉ có một report.
4. Confirm merge: một incident, hai reports confirmed cùng incident ID, hai URL ảnh khác nhau và history đúng.
5. Retry create/merge cùng lựa chọn, kể cả yêu cầu song song: không thêm report liên kết/incident/history; giữ snapshot response ban đầu.
6. Đổi action hoặc đổi incident đích sau confirm: HTTP 409, dữ liệu giữ nguyên.
7. Khác loại ở cùng GPS, cùng loại ngoài bán kính, target mất/không tồn tại: candidates đúng; confirm đích không hợp lệ thất bại và report còn pending.
8. Thiếu GPS: spy xác nhận matcher không được gọi, response có cảnh báo và vẫn create được. Tọa độ sai trả 400.
9. Matcher trả output sai schema hoặc ném lỗi: API trả lỗi, không tạo pending report/incident và không lưu ảnh mới.
10. Giữ toàn bộ suite nền mock đang có. Reset/replay chỉ thao tác backend/test repository riêng.

Test HTTP với AI mock chỉ chứng minh wiring và nghiệp vụ dùng thuật toán thật. Độ hữu ích của features từ ảnh thật phải được kiểm tra lại với Vision thật.

### Thiết bị và dữ liệu thật

- iPhone thật trước: gửi ảnh/GPS, xem đúng khoảng cách/reasons, xem ảnh candidate, chủ động create dù có đề xuất, chủ động merge, từ chối GPS vẫn báo cáo được.
- Hai điện thoại cùng URL backend: máy 1 create A, máy 2 analyze và merge vào A; cả hai refresh thấy hai minh chứng.
- Khi có Supabase: khởi động lại backend, đọc lại đúng một incident/hai reports/hai ảnh; kiểm tra concurrent confirms/merges với transaction thật do Người 3 thực hiện.
- Mẫu khó: hai ổ gà riêng gần nhau có tags chung; cùng ổ gà nhưng góc chụp/tags khác nhau; GPS lệch. Ghi nhận thứ hạng/ứng viên sai và lý do, không gọi điểm là độ chính xác đã đo.

## 9. Lệnh kiểm chứng và bằng chứng bàn giao

Các lệnh đã tồn tại, chạy từ root; trên PowerShell có thể dùng `npm.cmd`:

```powershell
npm.cmd run typecheck
npm.cmd run test:modules
npm.cmd run test:integration
npm.cmd run lint
```

Lệnh đã thêm tại package matching để chạy test riêng:

```powershell
npm.cmd run test --workspace=@civicmerge/matching
```

Script: `tsx --test tests/*.test.ts`, dùng toolchain đã có ở root. Root `test:integration` hiện tự nhận `tests/integration/*.test.ts`; không cần đổi root scripts chỉ để thêm suite mới. `test:modules` vẫn là smoke check nền, không thay thế tests thuật toán.

Chạy `npm.cmd run mobile:export` khi chạm Mobile/shared imports hoặc trong lượt kiểm chứng tích hợp cần kiểm tra bundle. Export không thay nghiệm thu thiết bị. Khi chỉ sửa module, ưu tiên unit tests + typecheck + HTTP hồi quy trước.

Bàn giao ghi rõ commit/code được kiểm tra, lệnh và kết quả, cấu hình bán kính/top K/trọng số, adapters thật/mock, địa chỉ backend kiểm thử, thiết bị đã dùng và các mục chưa chạy. Không dùng kết quả PASS của nền mock ngày trước để nghiệm thu matcher mới.

## 10. Phối hợp, rủi ro và điều kiện hoàn tất

| Đầu mối | Nội dung cần thống nhất | Việc Người 4 vẫn làm độc lập |
|---|---|---|
| Người 2 — Vision | Tag lowercase `key:value`, bộ tags dùng nhất quán giữa hai ảnh, mẫu ảnh cùng/khác sự cố | Khoảng cách, scoring và fixture tests không cần API key |
| Người 3 — Backend | Injection/configuration; summary có GPS/features đúng; merge kiểm tra lại hiện trạng; transaction/persistence | Matcher không cần biết DB/schema SQL; giữ interface hiện tại |
| Người 1 — Mobile | Điểm là xếp hạng; hiển thị reasons/ảnh trước confirm; nhãn môi trường hỗn hợp và GPS warning | Không yêu cầu import package matching vào Mobile |
| Cả nhóm | Thời điểm chạy backend tích hợp, dữ liệu/demo dùng chung, thiết bị và phiên bản adapters | Backend local và tests của Người 4 có dữ liệu riêng |

Rủi ro đã biết:

- GPS không có trường accuracy trong contract; bán kính 100 m chỉ là giả định ban đầu. GPS có sai số lớn có thể bỏ sót hoặc gợi ý nhiều hồ sơ; không suy tọa độ khi thiếu GPS.
- Tags chung như `surface:asphalt` có thể làm hai ổ gà khác nhau gần nhau có điểm cao. Luôn cho xem ảnh và yêu cầu người dùng xác nhận; hiệu chỉnh từ bộ mẫu thật thay vì tăng trọng số tùy ý.
- Summary hiện đại diện report đầu tiên. Việc tổng hợp nhiều report/features hoặc thay đổi vị trí incident là hạng mục phối hợp sau, không âm thầm thực hiện trong matcher.
- Quét danh sách có chi phí tuyến tính theo số incident, sau đó sắp xếp candidates. Phù hợp dữ liệu MVP; truy vấn địa lý/index/pagination thuộc bước mở rộng do Người 3 phối hợp, không kéo vào triển khai đầu tiên.
- Không có candidate không cấm người dùng gửi báo cáo mới. Có candidate không chứng minh sự cố giống nhau. Bộ nhớ local không chứng minh persistence hoặc concurrency của Supabase.

Checklist hoàn tất phần việc, chỉ đánh dấu khi có bằng chứng:

- [x] Factory thật tuân thủ `DuplicateMatcher`, export mock/routing cũ vẫn dùng được.
- [x] Khoảng cách, features, lọc/rank/top K/reasons và cấu hình được kiểm thử.
- [x] HTTP suite dùng matcher thật đạt luồng một incident/hai reports/hai ảnh và retry/conflict (memory/local/fixture Vision).
- [ ] Wiring/configuration API được phối hợp; người khác có hướng dẫn tự chạy.
- [x] Kết quả typecheck/tests phù hợp được ghi nhận cho code mới trong tài liệu bàn giao.
- [ ] Kiểm chứng với Vision thật được ghi riêng; nếu chưa có thì ghi chưa hoàn tất mục này.
- [ ] Nghiệm thu iPhone và hai điện thoại được ghi riêng theo thiết bị thực tế.
- [ ] Persistence/concurrency với Supabase được nghiệm thu cùng Người 3; nếu chưa có thì giữ mục tích hợp này mở.

Module matching có thể bàn giao trước khi đủ thiết bị hoặc adapters thật. MVP tích hợp chỉ hoàn tất sau khi kiểm chứng lại luồng ảnh thật, xác nhận create/merge và lưu bền vững với đúng các thành phần thật.
