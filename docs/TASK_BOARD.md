# Task board — Nền mock

| Hạng mục | Chủ sở hữu | Trạng thái |
|---|---|---|
| AGENTS, workspace, contracts/interfaces | Nền chung / Người 3 quản lý | Đã triển khai |
| API mock có trạng thái, upload, create/merge, retry | Nền chung | Đã triển khai, có kiểm thử HTTP |
| Bốn màn hình Mobile và API client | Nền chung / Người 1 tiếp quản | Đã nghiệm thu luồng mock trên iPhone thật + giả lập theo xác nhận người dùng ngày 14/11/2026 |
| AI mock, matching mock, routing rule, fixtures | Nền chung / Người 2 và 4 tiếp quản | Đã triển khai |
| Typecheck, test modules, integration, iOS bundle | Nền chung | Đã chạy; xem kết quả bàn giao/state |
| Cài client iOS SDK 58 và chạy trên iPhone | Người dùng + Người 1 | Đã chạy thành công, người dùng xác nhận ngày 14/11/2026 |
| Nghiệm thu iPhone thật + giả lập cùng backend | Người dùng | Đã đạt: 1 incident, 2 reports, 2 ảnh; backend trên laptop người dùng |
| Nghiệm thu hai điện thoại cùng backend | Cả nhóm, Người 4 điều phối | Chờ thiết bị |
| Commit từng mốc đã xong | Agent theo yêu cầu người dùng | Đã chia commit: AGENTS, workspace/contracts, backend, Mobile, tests, tài liệu/state |
| Integrate branch nền vào main, ghi commit nền | Cả nhóm | Chờ nghiệm thu/review, chưa push/merge |
| Tạo bốn branch riêng | Cả nhóm | Sau khi nền được nghiệm thu/tích hợp |
| Vision thật | Người 2 | Sau khi nhận nền |
| Supabase DB/Storage, transaction, persistence | Người 3 | Sau khi nhận nền |
| [GPS/scoring thật và tích hợp](CivicMerge_Matching_Implementation_Plan.md) | Người 4 | Đã có matcher và tests PASS; [bàn giao](CivicMerge_Matching_Handoff.md) để Người 3 nối provider/guard resolved; chờ Vision thật và nghiệm thu thiết bị |

Branch nền: `chore/mock-foundation`. Không hiểu trạng thái “đã triển khai” là đã nghiệm thu iPhone hoặc sẵn sàng production.
