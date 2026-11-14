# API contract v0.1

Source of truth: `packages/contracts/src/index.ts`. Tọa độ dùng độ thập phân; thời gian dùng ISO 8601 UTC. Nhãn loại `pothole|trash|flood`; severity `low|medium|high`; features là lowercase tags như `surface:asphalt`.

| Method | Endpoint | Request | Response |
|---|---|---|---|
| GET | `/health` | — | `{status: 'ok', mode: 'mock' \| 'real'}` |
| POST | `/api/reports/analyze` | Multipart `image`, optional cặp `latitude`, `longitude` | HTTP 201, `AnalyzeResponse` |
| POST | `/api/reports/confirm` | `ConfirmRequest` | HTTP 200, `ConfirmResponse` |
| GET | `/api/incidents` | Chưa hỗ trợ filter/pagination | `{incidents: IncidentSummary[]}` |
| GET | `/api/incidents/:id` | Incident ID | `IncidentDetail` hoặc 404 |
| GET | `/api/images/:bucket/:prefix/:name` | Key UUID do backend phát hành | Bytes JPEG/PNG/WebP, chỉ khi cấu hình Storage Supabase |

Health có `capabilities` tùy chọn: `{persistence: 'memory'|'postgres', storage: 'local'|'supabase', vision: 'mock'|'openai', matching: 'mock'|'real'}`. Shared `HealthSchema` tiếp tục nhận response cũ không có field này. `mode=mock` khi một phần vẫn mock/memory/local; capabilities không chứa secret. Đây là liveness/cấu hình, không phải kiểm tra readiness liên tục.

## Analyze

Ảnh tối đa 8 MB; JPEG, PNG hoặc WebP, MIME khớp chữ ký tệp. Tọa độ multipart truyền dạng chuỗi số; có cả hai hoặc bỏ cả hai. Thiếu GPS trả cảnh báo và candidates rỗng.

```json
{
  "reportId": "550e8400-e29b-41d4-a716-446655440000",
  "analysis": {"type":"pothole","severity":"high","description":"Mô tả sự cố","features":["surface:asphalt"]},
  "candidates": [],
  "warnings": []
}
```

Candidate có `incidentId`, `score` (0..1, điểm xếp hạng), `distanceMeters` và `reasons`. Mobile dùng API detail để xem ảnh trước khi chọn merge. Khi thiếu GPS, warnings có `{code: 'GPS_UNAVAILABLE', message: string}`.

## Confirm

```json
{"reportId":"550e8400-e29b-41d4-a716-446655440000","action":"create"}
```

Hoặc `action: "merge"` và thêm `targetIncidentId` hợp lệ. Không gửi target cho create. Cùng report/chọn lựa trả snapshot cũ; chọn lựa khác sau khi đã confirm trả 409. Merge khác loại trả 409, merge không tồn tại trả 404 và report vẫn pending.

Merge mới vào incident `resolved` trả `INCIDENT_RESOLVED` (409), report giữ pending, count/history/confirmation không tăng và không reopen. Backend kiểm tra status dưới cùng incident lock trong transaction. Retry của confirm đã thành công vẫn trả snapshot cũ trước khi kiểm tra status mới; đổi lựa chọn vẫn `REPORT_ALREADY_CONFIRMED`. Merge vào `in_progress` giữ nguyên status. Không có API đổi status mới trong chặng này.

## Lỗi

Luôn là `{error: {code: string, message: string}}`. Các lỗi chính: `VALIDATION_ERROR` (400, ảnh quá lớn 413), `INVALID_IMAGE` (415), `AI_UNAVAILABLE` (503), `REPORT_NOT_FOUND` / `INCIDENT_NOT_FOUND` (404), `REPORT_ALREADY_CONFIRMED` / `INCIDENT_TYPE_MISMATCH` / `INCIDENT_RESOLVED` / `MOCK_RESET` (409), `INTERNAL_ERROR` (500).

Adapter OpenAI giữ `INVALID_IMAGE` 422 cho ảnh không phù hợp, `AI_INVALID_RESPONSE` 502 cho output/schema/tags sai, `AI_UNAVAILABLE` 503 cho lỗi dịch vụ/mạng (gồm timeout do adapter bắt được). Wrapper backend trả `AI_TIMEOUT` 504 nếu hết thời gian trước provider; không chuyển timeout thành lỗi confirm chắc chắn thất bại. Matching thô lỗi trả `MATCHING_UNAVAILABLE` 503, output sai trả `PROVIDER_INVALID_RESPONSE` 502. Không trả key/model hoặc response thô upstream trong lỗi.

Backend giữ status/code của `DomainError` an toàn do adapter cung cấp (ví dụ `IMAGE_UNSUITABLE` 422). Exception thô của provider/driver bị che nội dung: `AI_UNAVAILABLE`, `MATCHING_UNAVAILABLE`, `DATABASE_UNAVAILABLE` (503). AI/matching timeout: `AI_TIMEOUT`/`MATCHING_TIMEOUT` (504); output sai schema: `PROVIDER_INVALID_RESPONSE` (502).

Storage: `STORAGE_UNAVAILABLE`/`STORAGE_CONFIG_ERROR` (503), `STORAGE_TIMEOUT` (504), `STORAGE_INVALID_RESPONSE` (502), `IMAGE_NOT_FOUND` (404). INSERT report chắc chắn bị từ chối: `DATABASE_WRITE_REJECTED` (503); có thể retry analyze thủ công. Lỗi database không rõ kết quả ghi: không tự động gửi analyze lại vì analyze chưa idempotent. Confirm bị timeout/lỗi chưa rõ kết quả thì retry **cùng lựa chọn**; không đổi create/merge chỉ vì chưa nhận response.

Ảnh Storage được trả bằng URL proxy backend ổn định trong `imageUrl`/`coverImageUrl`, không signed URL hết hạn hoặc marker nội bộ `.invalid`. Đổi PUBLIC_BASE_URL sẽ dựng lại URL ảnh Storage ở lần list/detail tiếp theo; URL local legacy giữ nguyên. Proxy không expose upload/delete/reset; hiện dành cho môi trường demo tin cậy chưa có auth.

## Điều khiển mock

Chỉ có ở backend memory/local/mock/mock, dành cho môi trường tin cậy. PostgreSQL hoặc Supabase Storage không đăng ký các controls này, kể cả AI/matching còn mock:

- `GET /api/mock/state`: đọc scenario.
- `POST /api/mock/scenario`: JSON `{scenario: 'pothole'|'trash'|'flood'|'ai-error'}`.
- `POST /api/mock/reset`: xóa dữ liệu nghiệp vụ đang chạy, scenario về `pothole`.

Response của controls là `{scenario: ...}`. Không đưa controls này vào backend thật hoặc expose công khai mà chưa thiết kế quyền truy cập.

Chặng database không đổi request/response hoặc enum: `/health` vẫn `mode: "mock"` vì AI/matching chưa thật. PostgreSQL adapter luôn từ chối `reset()` với `RESET_DISABLED` (403) ngay cả khi được gọi trực tiếp; qua HTTP các đường dẫn `/api/mock/*` không tồn tại (404).
