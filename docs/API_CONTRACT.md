# API contract v0.1

Source of truth: `packages/contracts/src/index.ts`. Tọa độ dùng độ thập phân; thời gian dùng ISO 8601 UTC. Nhãn loại `pothole|trash|flood`; severity `low|medium|high`; features là lowercase tags như `surface:asphalt`.

| Method | Endpoint | Request | Response |
|---|---|---|---|
| GET | `/health` | — | `{status: 'ok', mode: 'mock' \| 'real'}` |
| POST | `/api/reports/analyze` | Multipart `image`, optional cặp `latitude`, `longitude` | HTTP 201, `AnalyzeResponse` |
| POST | `/api/reports/confirm` | `ConfirmRequest` | HTTP 200, `ConfirmResponse` |
| GET | `/api/incidents` | Chưa hỗ trợ filter/pagination | `{incidents: IncidentSummary[]}` |
| GET | `/api/incidents/:id` | Incident ID | `IncidentDetail` hoặc 404 |

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

## Lỗi

Luôn là `{error: {code: string, message: string}}`. Các lỗi chính: `VALIDATION_ERROR` (400, ảnh quá lớn 413), `INVALID_IMAGE` (415), `AI_UNAVAILABLE` (503), `REPORT_NOT_FOUND` / `INCIDENT_NOT_FOUND` (404), `REPORT_ALREADY_CONFIRMED` / `INCIDENT_TYPE_MISMATCH` / `MOCK_RESET` (409), `INTERNAL_ERROR` (500).

## Điều khiển mock

Chỉ có ở backend mock, dành cho môi trường tin cậy:

- `GET /api/mock/state`: đọc scenario.
- `POST /api/mock/scenario`: JSON `{scenario: 'pothole'|'trash'|'flood'|'ai-error'}`.
- `POST /api/mock/reset`: xóa dữ liệu nghiệp vụ đang chạy, scenario về `pothole`.

Response của controls là `{scenario: ...}`. Không đưa controls này vào backend thật hoặc expose công khai mà chưa thiết kế quyền truy cập.
