# Backend — bản chuẩn bị tích hợp ngày 14/11/2026

## Nhánh và nguồn bàn giao

Nhánh dành cho PR: **`feature/backend-mvp-integration`**, chuẩn bị từ `origin/main` tại `98975df`. Giữ nguyên `feature/backend` đã push và lịch sử `feature/demo-readiness`; không force-push, không merge vào main. Main được nhóm cập nhật trong lúc làm việc, đã có AI/Matching và sửa resolved Mobile; bản chuẩn bị giữ các thay đổi đó cùng backend/DB/Storage/readiness đã kiểm chứng.

- AI: nguồn `9a6d7f69f97ab3e77af408633da3e673c205aa4c`, `createOpenAIVision({ apiKey, model, timeoutMs? })` của Người 2. Không sửa thuật toán/prompt của owner.
- Matching: nguồn `de31d6d`, đã có trên main, `createGpsFeatureMatcher({ radiusMeters: 100, maxCandidates: 3 })` của Người 4. Chỉ cập nhật hai kỳ vọng test lỗi HTTP cho backend contract hiện có, không sửa thuật toán.
- Mobile: UI từ `a5258a7` và sửa resolved `5929b7b` của Người 1 trên main; giữ giao diện, đánh dấu/khóa candidate đã xử lý và phân biệt already-confirmed, nối lại URL backend, retry an toàn theo HTTP status/code, tải candidate độc lập, nhãn/controls theo health.

## Backend đã nối

`server.ts` và `backend:check` đọc **`apps/api/.env` lúc khởi động**. Process environment ưu tiên; không ghi đè file cấu hình. Các biến độc lập:

| Biến | Giá trị |
|---|---|
| `AI_PROVIDER` | `mock` hoặc `openai`; mặc định mock |
| `OPENAI_API_KEY` | Key chỉ ở backend; bắt buộc khi chọn openai |
| `OPENAI_MODEL` | Model được cấu hình riêng với Người 2; bắt buộc, không tự chọn/fallback |
| `AI_TIMEOUT_MS` | Mặc định 18000; truyền cho adapter để abort fetch, wrapper giữ giới hạn chờ |
| `MATCHING_PROVIDER` | `mock` hoặc `real`; mặc định mock |
| `PERSISTENCE_MODE` | `memory` hoặc `postgres` |
| `STORAGE_PROVIDER` | `local` hoặc `supabase` |

Không đưa secret vào Mobile hoặc `EXPO_PUBLIC_*`. Thiếu key/model khi chọn openai phải báo lỗi startup, không chạy mock thay thế. Chọn mock không cần key. Giá trị timeout riêng đã có trong `.env` không bị thay đổi. `DomainError` giữ nguyên HTTP status/code; lỗi không xác định không in response upstream/key/model. Không đổi HTTP contract analyze/confirm; không sửa migration đã áp dụng.

Health capabilities mô tả cấu hình đã chọn. `mode=real` chỉ khi cả bốn provider đều thật; không dùng health làm bằng chứng nghiệm thu OpenAI live. `CivicMerge.cmd` vẫn cố ý ép AI/matching mock cho demo lưu trữ, dù `.env` đã chọn provider khác.

## Kiểm thử tại máy Người 3

Dùng Node **24.21.0**, npm **11.19.0**, một lockfile. Cache/TEMP/artifact trên D.

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:modules` | PASS |
| `npm run test:integration` | **36/36 PASS**, 0 skip |
| `npm run test --workspace=@civicmerge/ai-vision` | **7 PASS, 1 SKIP** live Vision |
| `npm run test --workspace=@civicmerge/matching` | **7/7 PASS** |
| `npm run test:database` | **17/17 PASS**, 0 skip |
| `npm run test:storage` | **6/6 PASS**, mạng Storage giả lập |
| `npm run test:demo` | **6/6 PASS**, không restart demo đang dùng |
| `npm run test:mobile` | **3/3 PASS** |
| `npm run mobile:export:android` | PASS; không tạo APK mới |

Integration dùng adapter OpenAI thật với phản hồi mạng giả lập và matcher GPS/features thật: ảnh → pending → create → ảnh khác → candidate → confirm đồng thời → một incident/hai reports/hai ảnh, retry snapshot cũ, đổi lựa chọn 409, thiếu GPS, lỗi dịch vụ/output/tags/ảnh không phù hợp, timeout abort và không ghi ảnh/report khi AI thất bại. Startup check dùng process overrides/key test và không gọi OpenAI.

PostgreSQL 17.11 test ở loopback 55439, database mới **`civicmerge_test_1794639520483`**, được giữ lại trên D; cluster test đã dừng. Không reset/truncate database cũ/app. Test gồm khóa/rollback/idempotency, nhiều report merge đồng thời, resolved sau analyze và cả hai thứ tự resolve/confirm. Một ca dùng cả hai factory bàn giao + PostgreSQL thật + mạng OpenAI/Storage giả lập. Đây không phải kiểm thử cả bốn dịch vụ live.

Lượt đầu test bàn giao Matching kỳ vọng 500 đã được sửa sang 503/502; lượt đầu ca mới DB dùng placeholder Storage sai prefix đã được sửa. Bảng trên là kết quả chạy lại sau sửa; không che các lần lỗi bằng cách bỏ test.

## Việc cần cấu hình riêng trước khi chạy AI thật

Kiểm tra chỉ có/không trên máy hiện tại: `OPENAI_API_KEY` **chưa có**, `OPENAI_MODEL` **chưa có**; cấu hình PostgreSQL/Supabase và bucket test đã có. Không đọc các giá trị secret ra terminal/chat và không ghi đè `.env`.

1. Mở `apps/api/.env` trong editor, giữ nguyên database/Storage/TLS. Người chạy backend tự điền `OPENAI_API_KEY`, `OPENAI_MODEL` đã thống nhất với Người 2; không commit file này. Chỉ chọn `AI_PROVIDER=openai` khi sẵn sàng.
2. Mở `.runtime/DevTerminal.cmd`, chọn cổng riêng còn trống và IP Wi-Fi đúng. Ví dụ chạy app bằng cấu hình hiện có, không thay backend 3000/3011:

```powershell
$env:PORT = '3012'
$env:HOST = '0.0.0.0'
$env:PUBLIC_BASE_URL = 'http://<LAN-IP>:3012'
$env:PERSISTENCE_MODE = 'postgres'
$env:STORAGE_PROVIDER = 'supabase'
$env:AI_PROVIDER = 'openai'
$env:MATCHING_PROVIDER = 'real'
$env:AI_TIMEOUT_MS = '18000'
$env:MOCK_MODE = 'false'
npm.cmd run backend:check
# Chỉ chạy tiếp nếu startup check thành công:
npm.cmd run dev:api
```

Backend mới đọc/ghi database app khi người dùng gửi báo cáo; đây không phải test tự động được phép nạp fixture/reset. Dừng đúng cửa sổ server này bằng Ctrl+C. Không dùng `CivicMerge.cmd` để chứng minh AI/matching thật vì launcher ép mock. Khôi phục demo mock bằng đóng terminal riêng rồi dùng launcher; không cần sửa/xóa dữ liệu thật.

3. Test Vision live cần **sáu ảnh JPEG được phép dùng**, hai ảnh cho mỗi loại pothole/trash/flood; thêm ảnh không phù hợp để thử HTTP 422. Ảnh tổng hợp trong repo chỉ kiểm thử kỹ thuật. Xem tên biến `CIVICMERGE_VISION_*` ở `packages/ai-vision/fixtures/README.md`. Unit live test không tự nạp `.env`; cấu hình process riêng, không dán key vào câu lệnh/chat/log. Không đặt sáu biến ảnh vào terminal hồi quy mặc định để tránh vô tình gọi API có phí.
4. Chưa chạy live Vision do thiếu key/model/ảnh; không chạy lại `test:storage:live` trong chặng này vì không đổi adapter ảnh. Storage live đã kiểm chứng ở chặng trước, không suy ra tổ hợp mới đã nghiệm thu. Chưa có đo thời gian end-to-end thật so với timeout 30 giây trên Mobile.
5. Chưa build/cài APK mới. Người 1 cần build với project/package/signing key hiện có; APK cũ không tự cập nhật giao diện/logic. Trên thiết bị: kiểm tra health, hai ảnh cùng sự cố → create/merge → một incident/hai reports/hai ảnh, retry, GPS/từ chối GPS, đổi URL LAN và nhãn mixed mode. Chưa đánh dấu iPhone/Android/hai điện thoại đạt nghiệm thu.

## Chuẩn bị PR

Code được lưu thành commit local; **chưa push hoặc merge**. Khi muốn đưa lên GitHub, chạy tại root sau khi kiểm tra đúng nhánh:

```powershell
git status
git branch --show-current
git push -u origin feature/backend-mvp-integration
```

Tạo PR **base: `main`, compare: `feature/backend-mvp-integration`**. Không chọn `feature/backend` cũ vì nhánh đó chỉ có chặng DB/Storage trước. Kiểm tra lại nếu main thay đổi sau `98975df`; kết quả kiểm tra merge chỉ áp dụng cho đúng main đã đối chiếu. Nhờ Người 1/2/4 review phần tương ứng; chưa tuyên bố MVP hoàn chỉnh khi thiếu nghiệm thu provider/thiết bị.
