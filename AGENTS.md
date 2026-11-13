# CivicMerge — Hướng dẫn làm việc trong repo

## Phạm vi và tài liệu

- Đọc `docs/CivicMerge_Mock_Foundation_Plan.md` và `docs/CivicMerge_Team_Development_Agreement.md` trước thay đổi kiến trúc.
- Ưu tiên iOS/iPhone thật; backend riêng khi phát triển, một backend chung khi tích hợp/demo.
- Bảo vệ luồng: hai ảnh → người dùng xác nhận → một incident, hai reports.
- Workflow cá nhân chỉ bật khi người dùng gọi `/startplan` hoặc `$startplan`; không tự áp dụng cho cả nhóm.

## Ownership và contract

- Người 1: `apps/mobile/`; Người 2: `packages/ai-vision/`.
- Người 3: `apps/api/`, `supabase/`, contracts, cấu hình workspace và lockfile.
- Người 4: `packages/matching/` và điều phối kiểm thử tích hợp.
- Schema trong `packages/contracts/` là nguồn dữ liệu chung; phối hợp và cập nhật caller/fixtures khi đổi contract.
- Backend inject module qua interface; Mobile chỉ gọi HTTP API, không import implementation backend hoặc secret.
- AI/matching mock phải được ghi rõ, xác định và reset được; không mô tả mock là AI thật.

## Nghiệp vụ và bảo mật

- Analyze chỉ tạo pending report. Matching chỉ đề xuất; người dùng xác nhận create/merge.
- Merge chỉ vào incident tồn tại và cùng loại; confirm cùng lựa chọn phải idempotent, đổi lựa chọn sau confirm trả conflict.
- Thiếu GPS vẫn được báo cáo nhưng candidates rỗng, có cảnh báo.
- Validate input/runtime schema, loại và kích thước ảnh; không dùng tên tệp client làm đường dẫn lưu.
- Key OpenAI và Supabase service-role chỉ ở backend; không commit `.env` hoặc dữ liệu upload runtime.
- Không reset dữ liệu hoặc thay backend tích hợp khi người khác đang dùng mà chưa phối hợp.

## Kiểm chứng và bàn giao

- Dùng npm workspaces với một lockfile; lấy command thực tế từ `package.json` và README.
- Commands hiện có: `npm run typecheck`, `npm run lint`, `npm run test:integration`, `npm run test:modules`, `npm run mobile:export`. PowerShell chặn npm.ps1 thì dùng `npm.cmd`.
- Sau thay đổi, chạy typecheck và các test phù hợp; thay đổi create/merge phải kiểm tra số incident/report và retry.
- Ghi rõ kết quả tự động, bước kiểm tra thiết bị còn thiếu và giới hạn lưu bộ nhớ.
- Không đánh dấu nghiệm thu iPhone hoặc tích hợp hai điện thoại nếu chưa chạy thực tế.
- PR nhỏ; không tự commit, push, merge vào main hoặc triển khai công khai khi chưa được yêu cầu. Với task dựng nền hiện tại, người dùng đã yêu cầu commit riêng mỗi mốc checklist hoàn tất; chưa yêu cầu push/merge.
