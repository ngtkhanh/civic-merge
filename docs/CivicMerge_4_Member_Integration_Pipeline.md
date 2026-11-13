# CIVICMERGE — KẾ HOẠCH PIPELINE & TÍCH HỢP CHO ĐỘI 4 NGƯỜI

> **Dự án:** CivicMerge — Smart Urban Incident Management  
> **Thông điệp:** One Issue, One Record  
> **Thời lượng hackathon:** 5 giờ (300 phút)  
> **Nguyên tắc triển khai:** Contract-First Development + Modular Pipeline + Continuous Integration  
> **Phạm vi MVP:** 3 loại sự cố (ổ gà, rác thải, ngập nước); chụp ảnh/GPS; AI Vision; đề xuất báo cáo trùng; người dùng xác nhận hợp nhất; định tuyến theo quy tắc; lưu hồ sơ và lịch sử.

---

## 1. Mục tiêu chung

Xây dựng một ứng dụng di động chạy trên điện thoại thật, thực hiện được quy trình:

**Chụp ảnh → Lấy GPS → AI phân tích → Tìm hồ sơ nghi trùng → Người dùng xác nhận tạo mới/hợp nhất → Định tuyến → Lưu và theo dõi hồ sơ.**

**Kịch bản demo trọng tâm:** Hai người chụp hai ảnh khác nhau của cùng một ổ gà. Hệ thống đề xuất chúng thuộc cùng một sự cố; khi người dùng xác nhận, hai lượt phản ánh được gắn vào **một** hồ sơ sự cố duy nhất, có hai ảnh minh chứng.

**Điều kiện thành công:** AI phân tích ảnh thật; chức năng phát hiện trùng hoạt động; dữ liệu lưu bền vững; đóng rồi mở lại ứng dụng vẫn xem được hồ sơ.

## 2. Phân công 4 thành viên

| Người | Vai trò | Phạm vi sở hữu | Kết quả bàn giao |
|---|---|---|---|
| **1** | Mobile App / UI-UX | `apps/mobile/` | 4 màn hình, camera, GPS, hiển thị kết quả và xác nhận |
| **2** | AI Vision | `packages/ai-vision/` | `analyzeIncidentImage()` trả JSON chuẩn |
| **3** | Backend / Database / Storage | `apps/api/`, `supabase/` | API, Supabase, lưu ảnh, create/merge, lịch sử |
| **4** | Duplicate Engine / Routing / Integration | `packages/matching/`, kiểm thử tích hợp | Phát hiện nghi trùng, định tuyến, demo end-to-end |

### Người 1 — Mobile App

- Khởi tạo ứng dụng React Native + Expo + TypeScript; thiết lập điều hướng.
- Xây dựng 4 màn hình: Trang chủ, Báo cáo, Kết quả AI, Chi tiết sự cố.
- Tích hợp chụp/chọn ảnh, xin quyền camera và GPS, có xử lý khi người dùng từ chối quyền.
- Gọi API phân tích; hiển thị loại sự cố, mô tả, severity, ứng viên nghi trùng và lý do.
- Cho phép xác nhận **Tạo hồ sơ mới** hoặc **Hợp nhất vào hồ sơ có sẵn**.
- Hiển thị số lượng minh chứng, trạng thái, đơn vị xử lý giả định và lịch sử.
- Dùng mock API từ đầu để không phụ thuộc vào Backend.

**Hoàn thành khi:** Đi hết toàn bộ luồng trên điện thoại thật, không cần sửa code UI khi chuyển từ mock sang API thật.

### Người 2 — AI Vision

- Tạo module tích hợp OpenAI Vision **chỉ gọi từ backend** (không để API key trên mobile).
- Nhận ảnh và trả kết quả chuẩn hóa: `type`, `severity`, `description`, `features`.
- Giới hạn nhãn: `pothole`, `trash`, `flood`.
- Viết prompt ngắn, yêu cầu output có cấu trúc; kiểm tra dữ liệu đầu ra trước khi đưa sang module khác.
- Kiểm thử tối thiểu 2 ảnh mẫu cho mỗi loại; xử lý ảnh không phù hợp, lỗi timeout hoặc response không hợp lệ.
- Phối hợp Người 4 kiểm tra các đặc điểm hình ảnh dùng cho duplicate matching.

**Hoàn thành khi:** Backend có thể gọi `analyzeIncidentImage()` và nhận JSON đúng schema ở các trường hợp thành công; lỗi được trả có cấu trúc.

### Người 3 — Backend / Database

- Khởi tạo Node.js + Express + TypeScript; cấu hình biến môi trường và Supabase.
- Thiết kế `incidents` (hồ sơ sự cố) và `reports` (từng lượt báo cáo/minh chứng).
- Thiết lập Supabase Storage; backend nhận ảnh, tải lên Storage và lưu tham chiếu ảnh.
- Viết `POST /api/reports/analyze`, `POST /api/reports/confirm`, `GET /api/incidents`, `GET /api/incidents/:id`.
- Gọi module AI của Người 2 và matching/routing của Người 4 qua interface đã chốt.
- Tạo luồng `pending → confirmed`; xử lý xác nhận idempotent và transaction để tránh tạo trùng do bấm nhiều lần.
- Đảm bảo hai `reports` có thể trỏ tới cùng một `incident_id`.

**Hoàn thành khi:** Có thể lưu ảnh và hồ sơ, tạo mới/hợp nhất an toàn, truy vấn lại dữ liệu sau khi khởi động lại app.

### Người 4 — Matching / Routing / Integration

- Viết Haversine để tính khoảng cách GPS giữa báo cáo mới và hồ sơ hiện có.
- Chọn danh sách ứng viên gần vị trí, cùng loại; cộng điểm cho các đặc điểm hình ảnh tương đồng.
- Trả về `score`, `distanceMeters`, `reasons`; **chỉ đề xuất**, không tự hợp nhất.
- Viết bảng quy tắc đơn giản: ổ gà → tổ đường bộ; rác thải → tổ vệ sinh; ngập nước → tổ thoát nước.
- Phối hợp Người 3 đưa thuật toán vào API; kiểm tra transaction merge và các trường hợp sai khớp.
- Điều phối tích hợp liên tục, theo dõi lỗi, kiểm thử trên điện thoại và chuẩn bị demo.

**Hoàn thành khi:** Hai ảnh cùng ổ gà được đề xuất hợp nhất; người dùng xác nhận và hai báo cáo xuất hiện trong một hồ sơ; các báo cáo khác loại không bị tự hợp nhất.

---

## 3. Kiến trúc pipeline tổng thể

```text
MOBILE APP (Người 1)
  Camera / Gallery / GPS / UI / Xác nhận
                |
                | HTTP / JSON (ảnh upload bằng multipart)
                v
EXPRESS API (Người 3)
  Input validation / Orchestration / Error handling
        |                       |
        v                       v
AI VISION (Người 2)     MATCHING + ROUTING (Người 4)
  Phân loại, mô tả       GPS + cùng loại + features
  mức độ, features      và quy tắc tổ xử lý
        |                       |
        +-----------+-----------+
                    |
                    v
SUPABASE (Người 3)
  PostgreSQL: incidents, reports
  Storage: ảnh minh chứng
                    |
                    v
             MOBILE APP
```

### Nguyên tắc độc lập module

| Người | Chỉ phụ thuộc vào contract nào? | Không cần biết |
|---|---|---|
| 1 | Request/response của REST API | Prompt, SQL, thuật toán matching |
| 2 | Đầu vào ảnh, đầu ra `AIAnalysis` | UI và cấu trúc database |
| 3 | Interface của AI Vision, Matching, Routing | Cách triển khai thuật toán nội bộ |
| 4 | `AIAnalysis`, location, danh sách candidate incidents | Màn hình mobile và prompt Vision |

> **Quy tắc:** Khi một module đã tuân thủ interface thì có thể thay thế bản mock bằng bản thật mà không sửa các module khác.

---

## 4. Shared Contract — Chốt trong 20 phút đầu

Tạo file **`packages/contracts/src/index.ts`**, cho cả nhóm import chung. Không tự đổi tên field hoặc enum trong từng module.

```ts
export type IncidentType = "pothole" | "trash" | "flood";
export type Severity = "low" | "medium" | "high";

export interface Location {
  latitude: number;
  longitude: number;
}

export interface AIAnalysis {
  type: IncidentType;
  severity: Severity;
  description: string;
  features: string[];
}

export interface MatchCandidate {
  incidentId: string;
  score: number;           // 0..1, điểm xếp hạng, KHÔNG phải xác suất đã hiệu chuẩn
  distanceMeters: number;
  reasons: string[];
}

export interface AnalyzeResponse {
  reportId: string;       // Bản nháp báo cáo đang chờ xác nhận
  analysis: AIAnalysis;
  candidates: MatchCandidate[];
}

export interface ConfirmRequest {
  reportId: string;
  action: "create" | "merge";
  targetIncidentId?: string; // Bắt buộc khi action="merge"
}

export interface ConfirmResponse {
  incidentId: string;
  action: "created" | "merged";
  reportCount: number;
  assignedTeam: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
```

**Quy tắc:**
1. Mọi request/response phải khớp kiểu dữ liệu và schema dùng chung.
2. API phải validation ở runtime (ví dụ Zod); TypeScript chỉ kiểm tra khi build, không kiểm tra dữ liệu gửi qua mạng.
3. `severity` chỉ nhận `low|medium|high`, không trả biến thể `High`, `severe`, `Cao`.
4. Người 3 quản lý version contract; thay đổi breaking change phải thông báo cho cả nhóm.
5. Mock responses cần khớp chính xác với contract để UI và matching có thể triển khai sớm.

---

## 5. Hai pipeline nghiệp vụ

### Pipeline A — Phân tích ảnh & đề xuất trùng

```text
(1) User chụp ảnh + GPS
        |
(2) POST /api/reports/analyze
        |
(3) Backend xác thực input, lưu ảnh tạm/Storage
        |
(4) AI Vision -> AIAnalysis
        |
(5) Matching Engine tìm ứng viên incidents tương tự
        |
(6) Backend tạo report ở trạng thái "pending"
        |
(7) AnalyzeResponse { reportId, analysis, candidates }
        |
(8) Mobile hiển thị, chờ người dùng xác nhận
```

- Không tạo hoặc hợp nhất `incident` chính thức trước khi người dùng xác nhận.
- Nếu không có GPS, cần thông báo rõ chức năng tìm trùng theo vị trí bị hạn chế; không tự suy đoán tọa độ.
- Nếu AI không phân loại được, báo lỗi/cho chụp lại; không tự gán ngẫu nhiên một trong ba loại.

### Pipeline B — Xác nhận, định tuyến & lưu

```text
(1) User chọn CREATE hoặc MERGE
        |
(2) POST /api/reports/confirm
        |
(3) Backend kiểm tra reportId/status/targetIncidentId
        |
        +---- CREATE ----> Routing Engine -> tạo incident
        |
        +---- MERGE -----> Kiểm tra incident đích -> gắn report
        |
(4) Transaction: cập nhật report, incident, số lượng minh chứng
        |
(5) ConfirmResponse -> Mobile hiển thị trang chi tiết
```

**Ràng buộc quan trọng:**
- `MERGE` bắt buộc truyền `targetIncidentId` tồn tại và hợp lệ.
- Một `reportId` chỉ được xác nhận một lần; retry không tạo hồ sơ thứ hai.
- Database lưu rõ `reports.incident_id`, cho phép nhiều reports cùng thuộc một incident.
- Việc hợp nhất là quyết định có xác nhận của người dùng, không phải tự động.
- Routing MVP sử dụng **đơn vị giả định** theo khu vực thí điểm, không tự động gửi tới cơ quan nhà nước.

---

## 6. API tối thiểu

| Method | Endpoint | Input | Output |
|---|---|---|---|
| POST | `/api/reports/analyze` | `multipart/form-data`: ảnh, latitude, longitude | `AnalyzeResponse` |
| POST | `/api/reports/confirm` | `ConfirmRequest` | `ConfirmResponse` |
| GET | `/api/incidents` | filter/pagination tùy chọn | Danh sách incident |
| GET | `/api/incidents/:id` | ID trên URL | Incident, reports, ảnh, trạng thái |

**Quy ước lỗi:** HTTP status hợp lý + `ApiError` có `error.code` và `error.message`. Ví dụ `VALIDATION_ERROR`, `AI_UNAVAILABLE`, `REPORT_ALREADY_CONFIRMED`, `INCIDENT_NOT_FOUND`.

**Bảo mật MVP:** OpenAI key và Supabase service-role key chỉ ở backend; không commit `.env` vào Git; validate loại/tải lượng tệp ảnh và các input; giữ quyền truy cập Storage phù hợp với chế độ demo.

---

## 7. Cấu trúc Monorepo

```text
civicmerge/
├── apps/
│   ├── mobile/                      # Người 1
│   │   └── src/
│   │       ├── screens/
│   │       ├── components/
│   │       └── services/api.ts
│   └── api/                         # Người 3
│       └── src/
│           ├── routes/
│           ├── controllers/
│           ├── repositories/
│           └── app.ts
├── packages/
│   ├── contracts/                   # Cả nhóm chốt, Người 3 quản lý
│   │   └── src/index.ts
│   ├── ai-vision/                   # Người 2
│   │   └── src/analyze.ts
│   └── matching/                    # Người 4
│       ├── src/duplicate.ts
│       └── src/routing.ts
├── supabase/
│   └── migrations/                  # Người 3
├── mocks/
│   ├── ai-response.json
│   └── incidents.json
├── tests/
│   └── integration/
├── .env.example
└── package.json
```

**Lưu ý vận hành:** Đảm bảo workspace/package import hoạt động với Expo và Node trước khi triển khai; tránh phụ thuộc phức tạp phát sinh ngay trong 5 giờ.

---

## 8. Git workflow và kiểm soát tích hợp

```text
feature/mobile ------\
feature/ai-vision -----\
feature/backend --------> Pull Request -> Typecheck/Test -> main
feature/matching ------/
```

- Mỗi người làm trên branch riêng, ưu tiên chỉ sửa khu vực mình sở hữu.
- Không push thẳng lên `main`; PR nhỏ được tích hợp sớm và thường xuyên.
- PR tối thiểu phải pass `typecheck`, test thuộc module và build/smoke test cơ bản nếu khả thi.
- Các thay đổi `contracts`, API hoặc database schema phải được Người 3 duyệt và thông báo cho các bên liên quan.
- Trong cuộc thi, **merge khi chức năng nhỏ đã chạy**, không gom toàn bộ vào cuối giờ.
- Người 4 điều phối tích hợp; Người 3 giữ trách nhiệm backend/API và hỗ trợ xử lý xung đột API.

### Điểm cần thử sớm trên điện thoại

Điện thoại thật không thể gọi `localhost` của laptop như một server ở cùng thiết bị. Cần thử API bằng địa chỉ LAN hoặc backend đã deploy, đồng thời cấu hình network và CORS/certificate phù hợp.

---

## 9. Timeline tích hợp — 300 phút

| Mốc | Người 1 — Mobile | Người 2 — AI | Người 3 — Backend | Người 4 — Matching/Integration | Gate |
|---|---|---|---|---|---|
| **0–20'** | Thống nhất màn hình + API | Chốt AI JSON | Repo, contract, API design | Chốt scoring/interface | Cả nhóm thống nhất contract |
| **20–60'** | Expo, camera, UI dùng mock | Tạo Vision wrapper | Express, Supabase, mock endpoint | Haversine, fixture mẫu | Mobile gọi mock API |
| **60–120'** | GPS, màn hình AI Result | Vision ảnh thật, test 3 loại | Upload/Storage, kết nối AI | Matching lọc GPS + loại | Ảnh thật -> JSON hợp lệ |
| **120–170'** | UI danh sách nghi trùng | Sửa prompt/output | Tạo pending report, API candidate | Scoring + routing | API trả candidate đúng |
| **170–210'** | Xác nhận, chi tiết | Hỗ trợ test | API confirm, transaction | Tích hợp create/merge | Hai reports -> một incident |
| **210–260'** | Test thiết bị thật | Test đầu vào khó | Persistence & lỗi API | End-to-end + regression | Luồng demo chạy xuyên suốt |
| **260–300'** | Đóng băng UI, tập demo | Trực xử lý AI | Trực xử lý API/DB | Điều phối demo, phương án dự phòng | Bản build ổn định |

### Quy tắc quyết định phạm vi

- **P0 — Bắt buộc:** Camera/ảnh, GPS, AI Vision, lưu report, tìm trùng, xác nhận merge, routing theo rule, xem lại hồ sơ.
- **P1 — Nếu còn thời gian:** cải thiện UI, lịch sử phong phú, thông báo rõ hơn.
- **P2 — Không làm trong MVP:** quản trị nhiều cấp, bản đồ thời gian thực phức tạp, tích hợp chính quyền thật, nhiều loại sự cố, đăng nhập đầy đủ nếu không thiết yếu.

Nếu đang trễ tiến độ: giảm UI phụ trước, giữ **luồng hai ảnh -> một hồ sơ** bằng mọi giá.

---

## 10. Integration Test Checklist

- [ ] **AI → Backend:** Ảnh ổ gà trả đúng `AIAnalysis` schema.
- [ ] **Backend → Matching:** Hai ảnh cùng ổ gà ở vị trí gần nhau xuất hiện trong candidate list.
- [ ] **Matching → UI:** Mobile hiển thị hồ sơ nghi trùng, điểm/lý do (nếu có) và nút xác nhận.
- [ ] **Create:** Ảnh sự cố mới tạo được một incident mới.
- [ ] **Merge:** Hai reports thuộc cùng một incident, không tạo incident thứ hai.
- [ ] **Routing:** Incident mới được gán đúng tổ xử lý giả định theo loại.
- [ ] **Persistence:** Đóng/mở lại app vẫn thấy hồ sơ cùng hai ảnh.
- [ ] **Negative:** Hai loại sự cố khác nhau ở gần nhau không tự hợp nhất.
- [ ] **Idempotency:** Xác nhận lặp lại không tạo thêm incident/report liên kết sai.
- [ ] **AI failure:** AI timeout/ảnh không phù hợp hiển thị thông báo phù hợp và không lưu kết quả sai.
- [ ] **GPS denial:** Từ chối quyền vị trí không làm app crash.
- [ ] **Mobile networking:** Điện thoại thật gọi được backend qua mạng đã chọn.

### Tiêu chí nghiệm thu cuối

1. Một ảnh ổ gà đầu tiên được AI phân loại và lưu thành **incident A**.
2. Ảnh thứ hai của cùng ổ gà được đề xuất ghép vào **incident A**.
3. Người dùng chọn **Hợp nhất**.
4. Trong database có **1 incident, 2 reports** gắn cùng `incident_id`.
5. UI hiển thị cả hai ảnh và tổ xử lý giả định.
6. Mở lại app, kết quả vẫn tồn tại.

---

## 11. Bộ tài liệu quản lý tối thiểu

| File | Mục đích | Người quản lý |
|---|---|---|
| `ARCHITECTURE.md` | Sơ đồ pipeline, module, luồng dữ liệu | Người 4 |
| `API_CONTRACT.md` | Endpoint, request/response, error codes | Người 3 |
| `packages/contracts/src/index.ts` | TypeScript interfaces dùng chung | Cả nhóm, Người 3 kiểm soát thay đổi |
| `TASK_BOARD.md` | Task, owner, phụ thuộc, thời hạn, trạng thái | Người 4 |
| `INTEGRATION_TESTS.md` | Kịch bản kiểm thử khi ghép module | Người 3 và 4 |

## 12. Rủi ro và phương án dự phòng

| Rủi ro | Dấu hiệu | Xử lý |
|---|---|---|
| Contract thay đổi tùy tiện | JSON không tương thích | Chốt schema sớm; kiểm tra runtime; sửa tại contract dùng chung |
| AI trả output không ổn định | Parse lỗi/nhãn sai | Schema validation, retry có giới hạn, fallback thông báo lỗi |
| Hai người sửa cùng file | Git conflict | Tách module theo ownership, PR nhỏ |
| Mobile không truy cập API | Network error trên điện thoại | Test LAN/deploy sớm; không dùng `localhost` trên mobile |
| Matching nhầm các ổ gà gần nhau | Candidate không chính xác | Kết hợp loại + GPS + đặc điểm; cho người dùng xem ảnh và xác nhận |
| Tạo hồ sơ trùng do bấm nhiều lần | Nhiều incident sau retry | Transaction + idempotent confirm |
| Merge muộn, thiếu thời gian | Chỉ các module độc lập hoạt động | Tích hợp tại các mốc 60/120/170/210 phút; đóng băng từ phút 260 |

> **Kết luận:** Cách giúp CivicMerge ghép 4 phần trơn tru là **chốt hợp đồng dữ liệu trước, phát triển mỗi module bằng mock, tích hợp liên tục và kiểm thử bằng một kịch bản end-to-end cố định**. Mục tiêu quan trọng nhất của demo vẫn là **One Issue, One Record**.
