# Kiến trúc backend và nền tích hợp

```text
Mobile (Expo Router, 4 screens in src/app)
  -> services/api.ts (HTTP + response schema validation)
  -> Express createApp(dependencies)
       -> VisionAnalyzer -> DuplicateMatcher
       -> ImageStorage -> IncidentRepository.createPending
       -> confirm -> IncidentRouter -> IncidentRepository.confirm
  -> incidents list/detail -> Mobile
```

`packages/contracts` chứa schema Zod, types và interfaces. `bootstrap/mock.ts` lắp AI mock, matching mock, routing rule, repository bộ nhớ và storage local. Mobile không biết implementation nội bộ.

`analyze` không tạo incident. `confirm` là boundary cần atomicity: kiểm tra lựa chọn cũ/đích merge, gắn report, cập nhật incident/history và lưu kết quả idempotent. Bản bộ nhớ không có await giữa validation và writes; Supabase adapter phải dùng transaction cùng ràng buộc phù hợp, không suy ra tính an toàn DB từ bản mock.

Retry cùng lựa chọn trả snapshot kết quả ban đầu, dù incident đã nhận thêm reports sau đó. Muốn số minh chứng mới nhất, đọc API detail.

Scenario/reset là API development riêng, chỉ có khi `mockMode=true`, có `mockControl` và tất cả provider là memory/local/mock/mock. Server dùng `bootstrap/configured.ts`, chọn persistence/storage/vision/matching độc lập; cấu hình không hợp lệ hoặc thiếu factory thật làm startup thất bại. PostgreSQL hoặc Supabase Storage không có `/api/mock/*`, kể cả AI/matching vẫn mock. Không gửi scenario như field nghiệp vụ của analyze.

Mỗi backend local có bộ nhớ và thư mục ảnh riêng. Dùng chung một backend khi demo hai điện thoại. Ảnh cũ không bị xóa khi reset dữ liệu nghiệp vụ; restart backend làm mất reports/incidents. Đường dẫn ảnh tạo bằng UUID, không dùng tên upload do client cung cấp.

`repositories/postgres.ts` implement cùng interface qua `pg`, không đổi contract. Schema backend riêng `civicmerge` có incidents/reports/history/confirmations và ledger migration. Confirm dùng một transaction `READ COMMITTED`, khóa report rồi incident đích, lưu snapshot response cùng history trước commit. Hai report cùng merge một incident tuần tự tăng count qua khóa hàng; retry không tính lại snapshot. Lỗi validation/SQL rollback toàn bộ. Đọc detail dùng `REPEATABLE READ READ ONLY` để count/reports/history nhất quán. `reset()` của adapter luôn từ chối, độc lập cấu hình HTTP.

`STORAGE_PROVIDER=supabase` inject adapter REST bucket private. `image_url`/`cover_image_url` lưu marker `https://civicmerge-storage.invalid/<bucket>/<prefix>/<uuid>.<ext>`, chứa bucket/key bền vững thay vì signed URL hoặc host local. HTTP boundary map marker sang `${PUBLIC_BASE_URL}/api/images/...`; proxy tải bytes có authentication backend và trả ảnh đã validate. Repository không đổi transaction/snapshot, không cần sửa migration cũ. `/uploads` vẫn phục vụ file local legacy; URL legacy giữ nguyên, cần giữ host/thư mục cũ hoặc chuyển dữ liệu có kiểm soát.

Analyze validate output AI/matching trước upload; tạo pending report sau upload. Chỉ xóa object mới khi chắc chắn chưa có report tham chiếu. Lỗi INSERT transport/cancellation chưa rõ kết quả giữ object; lỗi sau khi đã lưu report không xóa ảnh. SQLSTATE lỗi INSERT xác định được chuyển thành `PendingReportWriteRejected`; cleanup thất bại không che lỗi gốc. Không có job tự động quét/xóa ảnh/dữ liệu thật.

Registry `AdapterFactories` là điểm Người 3 lắp factory `VisionAnalyzer` của Người 2 và `DuplicateMatcher` của Người 4. Backend nhận key/model qua env và truyền riêng cho factory, có timeout chờ và runtime schema validation; factory tự chịu trách nhiệm hủy request upstream. Module thật chưa được bàn giao nên AI/matching hiện vẫn mock. Health giữ status/mode và thêm capabilities tùy chọn. `mode=real` chỉ khi PostgreSQL + Storage + cả hai module đều được chọn thật; health là liveness/cấu hình, không kiểm tra dịch vụ liên tục.

Chưa auth hoặc triển khai FPT; proxy ảnh là endpoint demo tin cậy, bucket private không thay thế quyền người dùng. Xem [bàn giao Storage](BACKEND_STORAGE.md), [database/TLS/migration](../supabase/README.md), [kết quả kiểm chứng mới](BACKEND_VERIFICATION.md); báo cáo database cũ là lịch sử chặng trước.
