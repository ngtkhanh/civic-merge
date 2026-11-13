# Backend/Database/Storage — bàn giao Người 3

Ngày cập nhật: 14/11/2026. Nhánh `feature/backend`, nền `411279b`. Code database hiện có được giữ; không sửa migration đã áp dụng, không reset dữ liệu, không đổi source Mobile/AI/matching trong chặng Storage. Không commit/push/merge hoặc triển khai FPT.

## Cấu hình và chạy an toàn

Dùng Node **24.21.0**, npm **11.19.0** theo repo, một root lockfile. Trên máy đã cấu hình, mở `.runtime/DevTerminal.cmd` để dùng toolchain portable và npm cache/TEMP trên D. Không cần cài lại Expo, Supabase CLI, Docker hoặc Android SDK.

Giữ `apps/api/.env` riêng trên máy; **không copy đè file đang có**. Bổ sung các dòng cần thiết, giữ nguyên `DATABASE_URL`, `DATABASE_SSL=verify` và CA đang dùng:

```dotenv
PERSISTENCE_MODE=postgres
STORAGE_PROVIDER=supabase
AI_PROVIDER=mock
MATCHING_PROVIDER=mock
MOCK_MODE=true
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_<backend-only-secret>
SUPABASE_STORAGE_BUCKET=civicmerge-evidence
SUPABASE_STORAGE_TEST_BUCKET=civicmerge-evidence-test
STORAGE_TIMEOUT_MS=10000
AI_TIMEOUT_MS=20000
MATCHING_TIMEOUT_MS=3000
PUBLIC_BASE_URL=http://<laptop-lan-ip>:3000
```

Các selector mặc định là `memory/local/mock/mock`, giữ cấu hình nền cũ hoạt động. Biến selector có giá trị lạ bị từ chối; chọn provider thật mà thiếu cấu hình/module không fallback. Biến process environment ưu tiên hơn `.env`.

Trong Supabase project: lấy Project URL ở **Connect**, tạo Secret key trong **Settings → API Keys**. Adapter này hỗ trợ secret key mới `sb_secret_...`; không dùng publishable/anon key, database password hoặc JWT legacy `service_role` thay thế. Key chỉ truyền trong header `apikey` của request backend qua HTTPS, không vào APK, source, log hoặc URL.

Tạo **hai bucket private** qua Dashboard → Storage, tên tương ứng hai biến bucket. Có thể giới hạn JPEG/PNG/WebP, tối đa 8 MiB ở bucket; backend vẫn tự validate byte/MIME/kích thước. Bucket test phải khác bucket app. Startup chỉ đọc metadata để kiểm tra bucket tồn tại/private; không tự tạo, sửa quyền hay empty bucket. Test live cũng kiểm tra cả hai bucket private nhưng chỉ upload/xóa trong bucket test.

Chạy kiểm tra chỉ đọc, không mở server và không sửa dữ liệu:

```powershell
npm.cmd run backend:check
```

Muốn kiểm tra Storage trước khi đổi cấu hình backend đang dùng, mở terminal riêng rồi dùng process override:

```powershell
$env:STORAGE_PROVIDER = 'supabase'
npm.cmd run backend:check
```

Chỉ chuyển `.env`/restart backend tích hợp khi đã phối hợp với người đang dùng. Đợt triển khai này **không thay selector trong `.env` và không restart backend cổng 3000**. Chạy một backend riêng khi cần thử tính năng:

```powershell
# Terminal riêng; chọn cổng chưa sử dụng. Dùng DB phát triển riêng nếu thử ghi.
$env:PORT = '3011'
$env:PUBLIC_BASE_URL = 'http://<laptop-lan-ip>:3011'
$env:STORAGE_PROVIDER = 'supabase'
npm.cmd run dev:api
```

Điện thoại cần cùng mạng khi dùng IP LAN. Nhập đúng `http://` với backend local không có TLS; dùng `PUBLIC_BASE_URL` trùng địa chỉ backend điện thoại truy cập được. Đóng terminal riêng để bỏ các process override. Không ghi Supabase secret vào lệnh PowerShell/history; nhập bằng editor trong `.env`.

Migration vẫn chạy bằng `npm run db:migrate`, hướng dẫn TLS/role ở [supabase/README](../supabase/README.md). Không có migration mới cho Storage: các cột text `image_url`/`cover_image_url` đang có chứa được tham chiếu mới; không sửa migration/checksum đã áp dụng.

## Ảnh bền vững và tính tương thích

`storage/supabase.ts` implement `ImageStorage.save/remove`, dùng REST chính thức, native fetch có timeout và download giới hạn 8 MiB. Tên object do backend tạo: `<prefix>/<UUID>.<jpg|png|webp>`. Prefix mặc định `evidence`, có thể đặt `SUPABASE_STORAGE_PREFIX` thành một segment an toàn. Không dùng filename client, không upsert đè ảnh cũ.

Giá trị lưu trong database là tham chiếu nội bộ:

```text
https://civicmerge-storage.invalid/<bucket>/<prefix>/<uuid>.png
```

Host `.invalid` là marker dữ liệu, không phải nơi để fetch. Bucket/key có thể tách từ tham chiếu này; nó không chứa secret, token, signed URL hay IP laptop. `createApp` chuyển marker sang URL hiện tại tại HTTP boundary:

```text
http://<backend>/api/images/<bucket>/<prefix>/<uuid>.png
```

GET ảnh chỉ đọc bucket được cấu hình và UUID/path hợp lệ; backend tải bytes từ Storage authenticated endpoint, validate ảnh rồi trả MIME đúng, `nosniff`, `Cache-Control: private, no-store`. Không trả URL hoặc credential Supabase cho client. Đổi prefix upload không làm mất khả năng đọc prefix cũ trong cùng bucket. Đổi bucket cần kế hoạch chuyển ảnh/allowlist riêng; không tự chuyển dữ liệu.

URL trong list/detail được dựng lại từ `PUBLIC_BASE_URL`, nên ảnh Storage không lệ thuộc IP đã dùng lúc upload. Contract nghiệp vụ không đổi. Confirm snapshot chỉ có incidentId/action/reportCount/assignedTeam, tiếp tục giữ nguyên byte nghĩa và không chứa URL ảnh hết hạn.

Ảnh cũ lưu bằng URL local vẫn được trả nguyên trạng; `/uploads` vẫn phục vụ `UPLOAD_DIR`. Không rewrite tùy tiện URL ngoài hoặc xóa ảnh local. Nếu IP/thư mục cũ không còn, cần khôi phục đường dẫn cũ hoặc một công cụ chuyển dữ liệu có kiểm soát; chặng này không tự bulk-migrate file. Giữ backup `UPLOAD_DIR` khi còn record legacy.

Bucket private không thay thế phân quyền người dùng: proxy hiện thuộc backend demo tin cậy và chưa có auth. Chưa triển khai Internet/FPT; cần bổ sung auth/authorization trước khi phục vụ bằng chứng nhạy cảm công khai.

## Thất bại và dọn ảnh

Analyze validate input, chạy/validate AI và matching trước upload. Thiếu GPS bỏ matching và trả `GPS_UNAVAILABLE`. Upload thành công mới tạo pending report, không tạo incident.

- Lỗi trước khi bắt đầu ghi report, hoặc PostgreSQL trả lỗi INSERT chắc chắn bị từ chối (`PendingReportWriteRejected`): thử xóa đúng object mới upload.
- Lỗi kết nối/cancellation không rõ INSERT đã commit chưa: giữ ảnh, trả lỗi; không đoán là rollback. Có thể còn orphan, an toàn hơn xóa nhầm ảnh của report đã lưu.
- Report đã lưu nhưng schema/response/socket về sau lỗi: giữ ảnh. Không xóa ảnh khi report đã được tham chiếu.
- Cleanup lỗi: giữ nguyên mã/status lỗi gốc và chỉ log thông báo chung, không log key/token/connection URL hoặc body upstream.
- Upload timeout có thể để lại object chưa có report vì provider có thể hoàn tất muộn. Không tự quét/xóa bucket; việc đối chiếu orphan cần tác vụ riêng có kiểm soát.

Analyze chưa idempotent. Sau lỗi không rõ kết quả không tự động upload lại vô hạn. Confirm có idempotency và retry cùng lựa chọn là cách phục hồi an toàn. Adapter PostgreSQL tiếp tục từ chối reset; controls mock chỉ được bật khi **tất cả** provider là `memory/local/mock/mock`. Legacy bootstrap mock/postgres giữ cho các test/caller cũ, server chạy `bootstrap/configured.ts`.

## Điểm lắp AI/matching cho Người 2 và 4

`createConfiguredBackend(env, {root, factories})` nhận registry có kiểu:

```ts
interface AdapterFactories {
  openai?: (config: { apiKey: string; model: string; timeoutMs: number }) => VisionAnalyzer;
  realMatcher?: () => DuplicateMatcher;
}
```

Người 2 bàn giao factory implement `VisionAnalyzer`; backend truyền key/model/timeout đọc từ cấu hình. Người 4 bàn giao factory implement `DuplicateMatcher`. Sau review, Người 3 import và đăng ký factory tại `server.ts` khi gọi `createConfiguredBackend`. Không import động đường dẫn tùy ý từ `.env`.

```dotenv
# Chỉ bật sau khi factory thật đã được bàn giao và đăng ký:
AI_PROVIDER=openai
OPENAI_API_KEY=<private-backend-key>
OPENAI_MODEL=<agreed-model>
MATCHING_PROVIDER=real
```

Hiện chưa có hai factory thật trong repo; chọn chúng sẽ báo lỗi startup, không giả lập thành công. Backend giới hạn thời gian chờ AI/matching và kiểm tra output theo contracts. Owner provider cần tự hủy request upstream theo `timeoutMs`; timeout ở wrapper không thể hủy implementation qua interface hiện chưa có AbortSignal. Backend không tự retry; cần phối hợp tổng thời gian AI + matching + upload + SQL với timeout 30 giây của mobile trước nghiệm thu thật.

`DomainError` do adapter tạo phải có message an toàn cho người dùng. Backend giữ status/code, ví dụ `IMAGE_UNSUITABLE` 422. Exception thô bị đổi thành mã lỗi dịch vụ chung, không lộ nội dung provider. AI/matching fixture dùng trong test registry không phải bằng chứng đã tích hợp OpenAI/thuật toán thật.

`GET /health` giữ `status`/`mode`, thêm `capabilities` tùy chọn trong shared schema. `mode=mock` khi bất kỳ phần nào vẫn mock/memory/local. PostgreSQL+Storage thật nhưng AI/matching mock vẫn báo mock, kèm khả năng từng phần. Đây là liveness/cấu hình, không phải endpoint kiểm tra liên tục toàn bộ dịch vụ.

## Kiểm thử riêng

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:modules
npm.cmd run test:integration
npm.cmd run test:storage
npm.cmd run test:database
npm.cmd run test:storage:live
```

`test:storage` dùng fake HTTP provider xác định, không cần credential. `test:integration` dùng server port ngẫu nhiên, directory test riêng và memory/fake provider. `test:database` dùng PostgreSQL thật riêng với guard ở [hướng dẫn database](../supabase/README.md), không đọc `.env` app.

`test:storage:live` là lệnh opt-in đọc credential riêng từ `.env` và process env; **không bao giờ fallback sang DATABASE_URL**. Luôn yêu cầu test bucket khác bucket app và tạo prefix `test-<UUID>`. Chỉ dọn các object đã tạo trong lần chạy, không empty/delete bucket. Metadata app bucket chỉ được đọc. Nếu thiếu key/bucket, test skip có lý do.

Để chạy cả PostgreSQL+Storage thật, cấp thêm trong terminal test:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://<test-role>:<password>@<test-host>:5432/civicmerge_test_<unique>'
$env:CIVICMERGE_DB_TEST = 'isolated'
$env:DATABASE_SSL = 'verify'
# Chỉ PostgreSQL loopback không TLS: $env:DATABASE_SSL = 'disable'
npm.cmd run test:storage:live
```

Database phải mới, chưa có schema `civicmerge`; runner xác minh tên database thật và lấy advisory lock riêng. Dùng database mới khác cho `test:database` vì bộ đó cũng yêu cầu schema trống. Không reset database để chạy lại. Dữ liệu nghiệp vụ test được giữ; ảnh test được dọn nên URL trong DB test sau cleanup có thể 404. Đây không phải dữ liệu app.

Trên Windows sandbox, tsx có thể lỗi `uv_os_get_passwd` trước khi chạy test; chạy lại bằng cùng toolchain trong terminal tài khoản Windows. Không sửa nghiệp vụ để né lỗi môi trường.

## Quay về local/mock

Trong backend phát triển riêng, chọn `PERSISTENCE_MODE=memory`, `STORAGE_PROVIDER=local`, `AI_PROVIDER=mock`, `MATCHING_PROVIDER=mock`, `MOCK_MODE=true`. Không cần xóa database hoặc bucket. Memory không hiển thị dữ liệu PostgreSQL và mất dữ liệu nghiệp vụ khi restart, ảnh local vẫn ở đĩa. Nếu chọn postgres + local, ảnh Storage cũ cần bật Supabase delivery để đọc; không đổi selector backend tích hợp mà chưa phối hợp.

## Tài liệu nguồn

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- [Tạo bucket private](https://supabase.com/docs/guides/storage/buckets/creating-buckets).
- [Storage upload](https://supabase.com/docs/reference/javascript/storage-from-upload), [download](https://supabase.com/docs/reference/javascript/storage-from-download), [remove](https://supabase.com/docs/reference/javascript/storage-from-remove).
- [Source StorageFileApi](https://github.com/supabase/storage-js/blob/master/src/packages/StorageFileApi.ts), [StorageBucketApi](https://github.com/supabase/storage-js/blob/master/src/packages/StorageBucketApi.ts): endpoint REST/object key được adapter dùng.
