# Kiểm chứng Backend/Database/Storage — 14/11/2026

Phạm vi Người 3, nhánh `feature/backend`, HEAD `411279b` của nền `chore/mock-foundation`. Trước khi sửa đã kiểm tra status/branch/history và giữ nguyên toàn bộ thay đổi có sẵn, gồm thay đổi Mobile từ các chặng trước. Chặng này không sửa source Mobile, AI hoặc matching; không commit/push/merge, không triển khai FPT. Xem [cấu hình và bàn giao](BACKEND_STORAGE.md).

## Đã triển khai

- Adapter Supabase Storage private, UUID object key, MIME/chữ ký/giới hạn 8 MiB, timeout và bounded download. Không dùng tên client làm đường dẫn, không upsert đè dữ liệu, không ký URL hết hạn lưu vĩnh viễn.
- Tham chiếu bucket/key trong các cột text hiện có; map sang URL proxy backend tại HTTP boundary. Không thêm migration vì schema hiện tại đã đủ, không sửa migration đã áp dụng.
- Giữ `/uploads` và URL local legacy nguyên trạng. Không xóa/reset hoặc tự bulk-migrate ảnh/dữ liệu cũ.
- Sửa cleanup analyze: chỉ xóa upload mới khi chắc chắn chưa có report tham chiếu. Sau commit hoặc lỗi transport chưa rõ kết quả phải giữ ảnh; cleanup lỗi không che lỗi gốc.
- Config chọn persistence/storage/AI/matching độc lập, registry factory cho module Người 2/4, schema validation và timeout. Thiếu credential/factory sẽ lỗi, không fallback mock.
- Health thêm capabilities tùy chọn; giữ field cũ và mode mock khi còn phần giả lập/memory/local. Không đưa key/URL kết nối vào health/log.
- `backend:check` kiểm tra startup chỉ đọc, không mở listener. Giữ transaction/lock/idempotency PostgreSQL và reset-disabled.

## Kết quả đã chạy

Toolchain Node **24.21.0**, npm **11.19.0** portable, npm cache và TEMP trên D. Không cài dependency mới cho Storage; dùng native fetch và một root lockfile đang có.

| Lệnh | Kết quả | Môi trường/phạm vi |
|---|---|---|
| `npm run typecheck` | PASS | Toàn workspace và tests/scripts |
| `npm run lint` | PASS | Script repo hiện chạy Expo lint Mobile, không sửa source Mobile |
| `npm run test:modules` | PASS | Schema/fixtures và AI/matching/routing hiện có |
| `npm run test:integration` | PASS **18/18**, 0 skip | HTTP server port ngẫu nhiên, memory repository, fake Storage/provider |
| `npm run test:storage` | PASS **6/6**, 0 skip | Fake HTTP Storage, không cần mạng/credential |
| `npm run test:database` | PASS **13/13**, 0 skip | PostgreSQL **17.11** loopback:55439, database mới riêng |
| `npm run test:storage:live` | PASS **5/5**, 0 skip | Supabase bucket test thật + database PostgreSQL local mới khác |
| `npm run backend:check` với process override `STORAGE_PROVIDER=supabase` | PASS | Chỉ đọc bucket metadata và bảng Supabase app, không mở server/ghi nghiệp vụ |

Test tsx chạy trong sandbox Windows ban đầu bị `uv_os_get_passwd` trước khi test bắt đầu; chạy lại bằng cùng Node/npm dưới tài khoản Windows đã qua. Không thay code để né lỗi sandbox. Một lỗi typecheck ở fixture cố ý sai type và lỗi narrowing Storage trong lúc phát triển đã sửa; kết quả bảng là lần chạy sau sửa.

Test database cuối dùng `civicmerge_test_1794599012682`; test Storage+database dùng `civicmerge_test_1794599019550`, đều trong cluster test riêng `.runtime/database-test/cluster-admin`, không phải database Supabase của app. Mỗi bộ có guard tên URL/current_database, schema mới và advisory lock; không truncate/reset dữ liệu. Test nghiệp vụ được giữ lại để kiểm tra, ảnh test được dọn theo object/prefix của lần chạy. Cluster test được dừng sau kiểm chứng, dữ liệu vẫn trên D.

## Những hành vi đã chứng minh

**Database thật, AI/matching fixture:** 12 confirm create cùng report qua hai pool chỉ tạo một incident/history/confirmation; 12 confirm merge cùng report chỉ tăng một; 24 reports merge đồng thời không mất count. Snapshot create/merge cũ giữ nguyên sau report mới. Đổi action/target trả conflict; merge không tồn tại/sai loại rollback và giữ pending. Trigger lỗi ghi snapshot rollback toàn transaction. Trigger từ chối INSERT pending được phân loại chắc chắn thất bại, không tạo report. Pool mới đọc lại dữ liệu; reset adapter trả 403 và controls không tồn tại.

**Storage thật + PostgreSQL test:** cả bucket app và bucket test tồn tại/private (kiểm tra chỉ đọc). Upload PNG vào prefix test UUID, adapter mới đọc bytes giống hệt, không phụ thuộc signed URL. Xóa đúng object đó và kiểm tra 404. Luồng HTTP hai ảnh tạo một incident, hai reports/history; 8 confirm create đồng thời cùng report và 8 confirm merge đồng thời cùng report trả cùng kết quả. Dừng HTTP server test rồi dựng instance backend/repository/storage mới với PUBLIC_BASE_URL khác: detail trả URL backend mới, tải được cả hai ảnh từ Storage thật, retry create vẫn trả snapshot ban đầu. Đây là dựng lại instance backend trong test process, không phải restart backend mà điện thoại đang dùng.

Cùng luồng live còn dùng trigger PostgreSQL test từ chối INSERT pending: API trả `DATABASE_WRITE_REJECTED` 503, số report vẫn hai và upload mới đã được compensation xóa. Cleanup cuối chỉ xóa object do lần test tạo; không xóa cả bucket hoặc object của app. Không ghi fixture vào database Supabase của ứng dụng.

**Fake provider/error cases:** MIME sai, ảnh quá 8 MiB, path/bucket sai, cấu hình sai/public bucket, upload/read/delete lỗi hoặc timeout; response ảnh hỏng/quá lớn; attempt cleanup scope khác bị chặn. HTTP giữ lỗi DomainError/status, che exception thô, từ chối schema AI/matching sai, timeout trước upload; GPS thiếu vẫn được báo cáo và không gọi matcher. Factory nhận key/model/timeout backend riêng và output được dùng; đây là injected fixture, không phải gọi OpenAI thật.

**Bảo vệ minh chứng:** INSERT chắc chắn thất bại dọn đúng ảnh; cleanup lỗi vẫn trả lỗi database gốc. Mô phỏng INSERT đã commit nhưng mất kết nối và lỗi response sau khi report đã lưu đều giữ ảnh. Mock cũ tiếp tục hoạt động, legacy URL local giữ nguyên và file vẫn được phục vụ. Memory+Supabase cũng không được bật reset.

## Chưa chạy và giới hạn

- Chưa gọi OpenAI thật hoặc thuật toán matching thật; cần factory/module Người 2/4 bàn giao. Chọn `openai`/`real` hiện bị từ chối nếu chưa đăng ký factory. Routing rule ba loại vẫn hoạt động.
- Chưa nghiệm thu camera/GPS/upload/create/merge trên APK, iPhone hoặc hai điện thoại. Người dùng đã xác nhận cài/kết nối APK ở chặng trước; không suy ra toàn luồng đã qua. Không build lại APK vì chặng này không sửa Mobile.
- Chưa restart/chuyển selector backend cổng 3000 đang phục vụ điện thoại. `.env` thật giữ nguyên selector; có credential Storage không có nghĩa backend hiện tại tự dùng Storage. Process override trong `backend:check` chỉ có hiệu lực ở terminal kiểm tra.
- Chưa chạy regression SQL concurrency trên Supabase database app; thay vào đó chạy PostgreSQL test thật riêng. Không kiểm tra role runtime tối thiểu production/backup/khôi phục thảm họa.
- Legacy local images vẫn phụ thuộc file/host cũ; chưa bulk-migrate chúng. Proxy ảnh chưa có auth/authorization, chỉ dành cho môi trường tin cậy. Chưa triển khai Internet/FPT.
- Validation ảnh kiểm tra MIME/chữ ký/kích thước, chưa giải mã toàn ảnh hoặc quét nội dung. Timeout wrapper không tự hủy provider nếu interface không có cancellation; factory thật phải tự hủy upstream.
- Analyze chưa idempotent. Lỗi upload/ghi chưa rõ kết quả có thể để lại orphan; không xóa ảnh mù để né vấn đề này và chưa có tác vụ dọn orphan tự động.

## Bàn giao tiếp

- **Người 2:** `VisionAnalyzer` thật, factory nhận config backend, cancellation/timeout, output đúng schema, DomainError an toàn cho ảnh không phù hợp/provider error.
- **Người 4:** `DuplicateMatcher` thật và fixtures GPS/features; phối hợp nghiệm thu hai thiết bị, không đổi luật confirm.
- **Người 1:** giữ status/domain code trong HTTP client, phục hồi lựa chọn confirm sau lỗi chắc chắn thất bại, UX candidates/so sánh ảnh và nghiệm thu Android/iPhone. Health capabilities đã có optional schema để dùng khi cần.
- **Người 3 sau nhận module:** import/register hai factory trong composition, chọn provider thật bằng env, phối hợp timeout mobile và kiểm thử tích hợp lại. Bật Storage trên backend tích hợp vào thời điểm đã phối hợp, theo [hướng dẫn](BACKEND_STORAGE.md).
