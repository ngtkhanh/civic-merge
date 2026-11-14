# Kết quả chặng database — cập nhật 14/11/2026

> Báo cáo này giữ lịch sử chặng database trước Storage. Trạng thái và kết quả mới nhất ở [BACKEND_VERIFICATION.md](BACKEND_VERIFICATION.md); giới hạn “ảnh local/chưa Storage” bên dưới mô tả đúng thời điểm kiểm chứng cũ, không phải trạng thái code hiện tại.

Nhánh `feature/backend`, nền `411279b` (`chore/mock-foundation`); working tree ban đầu sạch. Phần database ban đầu giữ nguyên Mobile/AI/matching và contract; sau đó người dùng yêu cầu bổ sung APK Android, được ghi riêng tại `docs/ANDROID_APK.md`. Không merge/push hoặc commit các thay đổi đang có.

## Supabase và chạy ứng dụng — 14/11/2026

- Đã cấu hình credential riêng trong `apps/api/.env`, Git ignore; không ghi URL/password vào báo cáo hoặc log.
- Kết nối project Supabase qua TLS đã xác minh: `encrypted=true`, `authorized=true`. Lỗi thiếu CA ban đầu được giải quyết bằng CA công khai theo URL trong source chính thức Supabase Dashboard, giữ `rejectUnauthorized=true` và `DATABASE_SSL=verify`.
- `npm run db:migrate` đã áp dụng `202611130001_incident_repository.sql` thành công lên Supabase. Đọc metadata xác nhận 5 bảng (gồm ledger) đều bật RLS.
- Tại thời điểm kiểm tra, incidents/reports/history/confirmations đều có 0 dòng. Không chạy fixtures ghi dữ liệu hoặc reset project Supabase này.
- Backend local đã khởi động chế độ postgres; `/health` và `/api/incidents` trả 200 ở localhost và IP Wi-Fi. `/api/mock/reset` trả 404.
- Người dùng xác nhận mở `/health` trên Chrome Android cùng Wi-Fi và thấy `status=ok`. Chưa nghiệm thu luồng báo cáo trên APK.
- Chạy lại `typecheck`, `lint`, `test:modules`: PASS; `test:integration`: PASS 5/5 với repository/thư mục test riêng, không ghi Supabase.
- EAS build Android preview đã FINISHED; APK đã tải về D và kiểm tra cấu trúc ZIP, package `vn.civicmerge.demo`, manifest/DEX và sự hiện diện signing block. Chi tiết tại `docs/ANDROID_APK.md`.

Các test transaction/concurrency dưới đây chạy trên PostgreSQL test riêng trước đó; không được hiểu là đã chạy lại bộ test đó trên Supabase của ứng dụng.

## Đã chạy

Toolchain portable trong `.runtime` (gitignored): Node **24.21.0**, npm **11.19.0**. PostgreSQL **17.11**, cluster test mới tại loopback `127.0.0.1:55439`; database tên `civicmerge_test_<suffix>`, không phải Supabase/backend dùng chung. Binaries PostgreSQL chỉ dùng cho kiểm thử local, không thêm vào dependencies dự án.

- `npm run typecheck`: PASS toàn workspace.
- `npm run test:modules`: PASS fixtures/schema và adapter modules hiện có.
- `npm run test:integration`: PASS **5/5** test mock hiện có.
- `npm run test:database`: PASS **12/12**, **0 skip**, migration SQL và adapter chạy trên PostgreSQL thật.
- `npm run db:migrate`: PASS trên DB test đã có migration, báo up to date và giữ dữ liệu.
- Checkpoint và restart PostgreSQL test: PASS; giữ nguyên **4 incidents/31 reports/30 history/30 confirmations** cùng mọi JSON snapshot. Một report còn pending là từ ca cố ý gây lỗi create; ca cạnh tranh create/merge có thể làm tổng incident khác giữa các lần chạy.

Typecheck chạy trong sandbox. Hai lệnh test dùng tsx lúc đầu gặp `uv_os_get_passwd` của sandbox Windows như README đã ghi; chạy lại ngoài sandbox bằng cùng toolchain đã qua. Không sửa logic để né lỗi môi trường.

Cluster test đầu tiên được init trong sandbox và chạy bằng tài khoản Windows khác: bộ DB test qua nhưng kiểm tra migration sau đó gặp lỗi checkpoint/quyền tệp, PostgreSQL trả `57P03` khi recovery. Đã dừng cluster này, tạo cluster mới bằng cùng tài khoản chạy server, dùng DB mới và chạy lại **12/12** cùng command migration/checkpoint/restart thành công. Không dùng kết quả cluster lỗi để xác nhận persistence. Sau kiểm thử dừng server test, giữ dữ liệu trong `.runtime`.

Database tests chứng minh:

- Migration chạy lại không làm mất dữ liệu; RLS bật cho 5 bảng gồm ledger.
- 12 confirm create cùng report qua hai pool trả cùng snapshot, đúng **1 incident/1 report/1 history/1 confirmation**.
- 12 confirm merge cùng report chỉ thêm một report; đúng **1 incident/2 reports/2 history/2 confirmations**.
- 24 reports tiếp theo merge đồng thời: đúng **1 incident/26 reports/26 history/26 confirmations**, count trả về 3..26 không trùng/mất update. Detail đang đọc đồng thời luôn có count = reports = history.
- Create và merge cạnh tranh một report có một thành công và một 409; đổi action/target sau confirm trả 409.
- Đích không tồn tại trả 404; khác loại trả 409; report vẫn pending và chưa có history/snapshot, sau đó create được.
- Lỗi SQL cố ý tại insert confirmation rollback cả incident create hoặc count merge, report link/status và history; retry sau khi bỏ trigger chạy được.
- Kết nối/pool mới đọc lại dữ liệu và snapshot ban đầu; count snapshot không đổi sau report mới.
- HTTP vẫn mô tả `mode=mock`, analyze không GPS có cảnh báo/candidates rỗng; confirm/retry/conflict đúng mã; `/api/mock/*` không tồn tại; adapter reset trả 403 và dữ liệu không đổi.

Không reset database dùng chung; dữ liệu test được giữ trong cluster riêng để kiểm tra.

## Chưa chạy / giới hạn

- Đã kiểm tra kết nối/TLS/migration trên Supabase bằng credential phát triển được người dùng cấu hình. Chưa nghiệm thu runtime role tối thiểu riêng hoặc môi trường production; xem [hướng dẫn](../supabase/README.md).
- Chưa nghiệm thu restart backend thật với ảnh local trên thiết bị; đã kiểm tra pool/kết nối mới và restart PostgreSQL test giữ nguyên dữ liệu.
- Chưa nghiệm thu camera/GPS hoặc luồng hai ảnh trên APK, iPhone hay hai điện thoại. Export Android và build native EAS đã qua; chưa đồng nghĩa APK đã cài/chạy thành công trên thiết bị.
- AI/matching vẫn mock, ảnh vẫn local; không làm Supabase Storage, auth hoặc triển khai FPT. Chế độ memory vẫn mất dữ liệu khi restart; chế độ postgres giữ dữ liệu nghiệp vụ nhưng URL ảnh còn phụ thuộc host/thư mục upload local.
