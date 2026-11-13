# PostgreSQL/Supabase — Người 3

Nhánh `feature/backend` phát triển từ `411279b` của `chore/mock-foundation`. PostgreSQL repository và migration được giữ; đã bổ sung Supabase Storage private và composition backend. Contract nghiệp vụ giữ nguyên, health thêm capabilities tùy chọn; không sửa source Mobile/AI/matching trong chặng Storage. **AI/matching vẫn mock**, chưa auth hoặc triển khai FPT. Không gọi đây là MVP real hoàn chỉnh. Hướng dẫn đầy đủ: [Backend/Storage](../docs/BACKEND_STORAGE.md), [kiểm chứng mới](../docs/BACKEND_VERIFICATION.md).

## Cấu hình riêng

Dùng Node **24.21.0**, npm **11.19.0** theo `.node-version` và `packageManager`; chạy lệnh từ root. PowerShell có thể dùng `npm.cmd`.

Giữ cấu hình trong `apps/api/.env` (gitignored), lấy mẫu từ `.env.example`; không ghi đè file `.env` sẵn có. Không gửi connection URL/password vào source, chat hoặc log.

```dotenv
MOCK_MODE=true
PERSISTENCE_MODE=postgres
MOCK_SCENARIO=pothole
DATABASE_URL=postgresql://<backend-role>:<encoded-password>@<host>:5432/postgres
DATABASE_SSL=verify
# Nếu server cần CA riêng, tải CA từ dashboard và đặt đường dẫn local:
# DATABASE_SSL_CA_FILE=<local-path-to-ca.pem>
# Optional: credential owner chỉ dành cho migration:
# MIGRATION_DATABASE_URL=postgresql://<migration-owner>:<encoded-password>@<host>:5432/postgres
```

- `DATABASE_URL`: PostgreSQL connection string từ Supabase **Connect**, dùng direct connection hoặc session pooler cho backend Node chạy lâu dài; mật khẩu phải URL-encode. Đây là credential database, không phải Supabase API key. Riêng database không cần Storage/OpenAI key; chọn Storage thật cần `SUPABASE_URL`, `SUPABASE_SECRET_KEY=sb_secret_...`, `SUPABASE_STORAGE_BUCKET` private.
- `MIGRATION_DATABASE_URL`: nếu có, `db:migrate` dùng URL owner này; server chỉ dùng `DATABASE_URL`. Nếu không có, migration dùng `DATABASE_URL` và cần quyền tạo schema/table/function.
- `DATABASE_SSL=verify` mặc định, xác minh chứng chỉ. Chỉ đặt `disable` cho PostgreSQL test cục bộ. Không thêm tham số `ssl*` vào URL vì driver có thể ghi đè cấu hình TLS. Nếu Supabase cung cấp chứng chỉ CA riêng, dùng `DATABASE_SSL_CA_FILE`; không tắt xác minh để kết nối cloud.
- Giữ `PUBLIC_BASE_URL` là địa chỉ API điện thoại truy cập được. `STORAGE_PROVIDER=local` vẫn phụ thuộc `UPLOAD_DIR`/host cũ; `supabase` lưu bucket/key và trả URL proxy theo backend hiện tại. Giữ thư mục local khi còn record legacy; không tự thay backend tích hợp khi nhóm đang dùng.
- `PERSISTENCE_MODE=memory` (mặc định) giữ hành vi mock cũ, không cần database. `MOCK_SCENARIO` chỉ chọn fixture cố định trong chế độ postgres, không phân tích ảnh thật.
- Khi chạy Mobile qua Metro với PostgreSQL, giữ `EXPO_PUBLIC_MOCK_MODE=true` để hiển thị AI giả lập nhưng đặt `EXPO_PUBLIC_MOCK_CONTROLS=false` để không gọi reset/scenario. Profile APK `preview` đã đặt hai giá trị này. Địa chỉ API có thể nhập/lưu trực tiếp trên Trang chủ; xem [hướng dẫn APK](../docs/ANDROID_APK.md).

Tài liệu nguồn: [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), [node-postgres transactions](https://node-postgres.com/features/transactions).

## Chạy migration

Chọn database phát triển riêng hoặc phối hợp với nhóm trước khi thay schema tích hợp. Không dùng database chung để chạy test.

```sh
npm ci
npm run db:migrate
npm run dev:api
```

`db:migrate` đọc `apps/api/.env`, dùng transaction cùng advisory lock để áp dụng migration theo thứ tự. `civicmerge.schema_migrations` lưu SHA-256 từng file: chạy lại không thay dữ liệu; file đã áp dụng bị sửa sẽ bị từ chối. Mọi migration pending và ledger commit cùng nhau; lỗi thì rollback. Không chạy `supabase db reset`, không có seed/reset dữ liệu thật. Migration không tự chạy khi server khởi động. Không dùng đồng thời runner này và CLI migration runner khác cho cùng các file.

File đầu: `migrations/202611130001_incident_repository.sql`. Schema riêng `civicmerge` gồm `incidents`, `reports`, `history`, `confirmations`; UUID/FK/check constraints và unique key theo report bảo vệ liên kết, trạng thái và snapshot. Các bảng bật RLS, không có policy dành cho client; schema/function/table không cấp quyền cho `PUBLIC`. **Không thêm `civicmerge` vào Supabase exposed schemas**, không để Mobile truy vấn trực tiếp. Backend gọi SQL có tham số qua `pg`; không dùng nhiều HTTP request Supabase để giả lập transaction.

Khuyến nghị dùng role runtime riêng có quyền tối thiểu sau khi owner chạy migration. Tạo role login/password riêng qua công cụ quản trị, không lưu password vào script. Ví dụ dưới đây giả định đã tạo `civicmerge_backend`; chạy bằng owner và chỉ một lần:

```sql
GRANT USAGE ON SCHEMA civicmerge TO civicmerge_backend;
GRANT SELECT, INSERT, UPDATE ON civicmerge.incidents, civicmerge.reports TO civicmerge_backend;
GRANT SELECT, INSERT ON civicmerge.history, civicmerge.confirmations TO civicmerge_backend;
GRANT EXECUTE ON FUNCTION civicmerge.valid_features(text[]) TO civicmerge_backend;
CREATE POLICY backend_incidents ON civicmerge.incidents TO civicmerge_backend USING (true) WITH CHECK (true);
CREATE POLICY backend_reports ON civicmerge.reports TO civicmerge_backend USING (true) WITH CHECK (true);
CREATE POLICY backend_history ON civicmerge.history TO civicmerge_backend USING (true) WITH CHECK (true);
CREATE POLICY backend_confirmations ON civicmerge.confirmations TO civicmerge_backend USING (true) WITH CHECK (true);
```

Role runtime không cần quyền DDL, DELETE, TRUNCATE hay sửa snapshot/history. Owner migration không dùng làm credential client. Dù dùng owner trong môi trường dev riêng, `repository.reset()` luôn trả `RESET_DISABLED` (403); PostgreSQL không đăng ký bất kỳ `/api/mock/*` controls nào. `/health` vẫn trả `mode: "mock"` vì AI/matching còn mock, capabilities ghi rõ provider được chọn; startup log không chứa connection URL/key.

## Confirm và đọc dữ liệu

`createPostgresRepository(pool)` giữ đúng `IncidentRepository`. Analyze chỉ insert pending report. Confirm dùng một client cho toàn bộ transaction `READ COMMITTED`:

1. `SELECT report FOR UPDATE`, đọc xác nhận cũ sau khi lấy được khóa.
2. Nếu cùng lựa chọn, trả JSON snapshot cũ. Đổi action hoặc incident đích trả 409, kể cả khi đích mới không tồn tại.
3. Create tạo incident; merge khóa incident đích, kiểm tra tồn tại/cùng loại rồi tăng count. Thứ tự khóa luôn report → incident; các report khác nhau cùng merge một incident sẽ tuần tự cập nhật count.
4. Gắn report và chuyển confirmed, thêm history, lưu request action/target cùng response snapshot, rồi commit. Lỗi ở bất kỳ bước nào rollback, report vẫn pending và count/history không tăng.

Merge giữ team/description/severity/cover của incident như mock hiện tại. Retry không tính lại count/team theo trạng thái mới. `get()` dùng transaction read-only `REPEATABLE READ` để count/reports/history cùng một snapshot khi confirm đang chạy. `list()` lấy summary mới nhất. Dữ liệu nghiệp vụ ở PostgreSQL không nằm trong bộ nhớ backend.

## Kiểm thử database riêng

```sh
npm run typecheck
npm run test:modules
npm run test:integration
npm run test:database
```

`test:database` **không đọc** `apps/api/.env`, không dùng `DATABASE_URL` làm fallback. Cấu hình ba biến trong terminal test riêng:

```powershell
# Database mới, trống, chỉ dành cho một lần test; không dùng database tích hợp.
$env:TEST_DATABASE_URL = 'postgresql://<test-owner>:<encoded-password>@<test-host>:5432/civicmerge_test_<unique-suffix>'
$env:CIVICMERGE_DB_TEST = 'isolated'
$env:DATABASE_SSL = 'verify'
# Chỉ PostgreSQL local không TLS: $env:DATABASE_SSL = 'disable'
npm.cmd run test:database
```

Owner test cần quyền tạo schema/table/function/trigger. Cả tên database trong URL lẫn `current_database()` phải có dạng `civicmerge_test_[a-z0-9_]+`; các Supabase project chỉ cho DB tên `postgres` không đáp ứng guard này — dùng PostgreSQL local hoặc instance test riêng cho phép tạo DB đúng tên. Nếu thiếu URL, test database được **skip với lý do rõ ràng**, không được tính là đã nghiệm thu DB. Test từ chối DB đã có bất kỳ object trong schema `civicmerge`, và giữ advisory lock riêng để tránh hai runner cùng dùng một DB.

Test áp dụng migration thật, không dùng repository bộ nhớ hay giả lập SQL. Có lỗi cố ý tại insert snapshot để chứng minh rollback sau các writes; trigger test được gỡ sau ca này. **Không xóa/reset dữ liệu test**: giữ database để kiểm tra, tạo DB mới có suffix khác cho lần chạy sau. Người quản trị tự quản lý vòng đời database test đã xác nhận là disposable; không có API xóa dữ liệu.

Các ca gồm 12 confirm create cùng report, 12 confirm merge cùng report qua hai pools, 24 reports merge đồng thời, cạnh tranh hai lựa chọn, snapshot sau merge thêm, pending sau đích sai/mất, lỗi ghi snapshot, kết nối mới đọc lại dữ liệu và HTTP bootstrap không có reset. Xem `tests/database/postgres.test.ts` và [kết quả chặng database](../docs/DATABASE_VERIFICATION.md).

Storage thật có test opt-in `npm run test:storage:live`, bucket test/prefix riêng; PostgreSQL+Storage pipeline cần database test mới đúng guard. Không dùng DATABASE_URL thật làm fallback; chỉ dọn object test của lần chạy. Xem [hướng dẫn](../docs/BACKEND_STORAGE.md). AI/matching vẫn mock; cần bàn giao module thật và nghiệm thu Android/iPhone/hai điện thoại riêng. Chưa auth hoặc FPT.
