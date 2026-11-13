# Current Task
Task: Dựng nền mock CivicMerge theo kế hoạch, tạo AGENTS.md trước implementation.
Status: NEEDS_INPUT
Phase: Code và kiểm chứng tự động hoàn tất; commit theo mốc, chờ nghiệm thu iPhone

## Checklist
- [x] Đọc workflow và phương án đã chốt; tạo AGENTS.md
- [x] Workspace, contracts và interfaces
- [x] Backend mock có trạng thái và fixtures
- [x] Mobile bốn màn hình, camera/GPS và API client — code đã có, chưa nghiệm thu thiết bị
- [x] Verification tự động và review
- [x] README, hướng dẫn iPhone và tài liệu bàn giao
- [x] Learning gate — created AI/human learning về boundary và kiểm chứng
- [x] Commit riêng từng mốc đã hoàn thành theo yêu cầu mới của người dùng — bao gồm commit tài liệu/state này
- [ ] Nghiệm thu iPhone và hai điện thoại cùng backend
- [ ] Tích hợp main và tạo bốn branch cá nhân — chưa được yêu cầu thực hiện Git actions này

## Decisions
- Q1 iPhone thật trước; Q2 local riêng, backend chung khi tích hợp.
- npm workspaces; Express; Expo; Zod; repository bộ nhớ và storage local.
- Người dùng đã yêu cầu commit riêng mỗi mốc checklist hoàn tất; chưa cho phép push/merge. Branch nền chore/mock-foundation.

## Verification
- Node v24.21.0 có sẵn. PowerShell chặn npm.ps1: dùng npm.cmd, không đổi execution policy.
- PASS: typecheck, lint, test:modules, 5 HTTP integration tests, iOS Metro export, server entrypoint và CLI reset.
- PASS: bản sao source sạch npm ci, typecheck, lint và tests; không gọi là clone từ remote.
- Chưa nghiệm thu trên thiết bị iPhone. Người dùng xác nhận chưa có Expo Go, cần hướng dẫn; đã viết docs/IPHONE_SETUP.md theo tài liệu SDK 58.
- npm audit còn 8 moderate (minimatch qua Expo/fingerprint và TypeScript ESLint); audit fix không giải quyết, không force downgrade Expo.

## Retry
Count: 0
Maximum: 3
Last error: Đã sửa ESM scripts và React Hooks lint; không còn kiểm tra tự động thất bại.
Evidence: docs/VERIFICATION_REPORT.md

## Blockers
Nghiệm thu iPhone/hai điện thoại cần người dùng cài client SDK 58 và thao tác thiết bị. Theo tài liệu Expo hiện tại, luồng Expo Go iOS yêu cầu Apple Developer/TestFlight; chưa xác định tài khoản của nhóm.

## Next step
Người dùng chuẩn bị client iPhone theo docs/IPHONE_SETUP.md, cấu hình hai file .env rồi chạy README và nghiệm thu thiết bị. Giữ task chưa DONE trước nghiệm thu iPhone/hai điện thoại; chưa push/merge main.
