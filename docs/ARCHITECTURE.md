# Kiến trúc bộ khung mock

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

Scenario/reset là API development riêng và chỉ được đăng ký khi `mockMode=true`. Server mặc định chỉ cho chạy mock; real bootstrap chưa được triển khai. Scenario là trạng thái backend chung, cần phối hợp khi demo; không gửi scenario như field nghiệp vụ của analyze.

Mỗi backend local có bộ nhớ và thư mục ảnh riêng. Dùng chung một backend khi demo hai điện thoại. Ảnh cũ không bị xóa khi reset dữ liệu nghiệp vụ; restart backend làm mất reports/incidents. Đường dẫn ảnh tạo bằng UUID, không dùng tên upload do client cung cấp.

Thay module thật tại bootstrap, giữ interfaces. `supabase/README.md` ghi phần việc còn lại của Người 3.
