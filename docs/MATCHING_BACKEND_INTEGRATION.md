# Matching handoff — phần Người 3

Cập nhật 14/11/2026 theo `CivicMerge_Matching_Handoff.md` do Người 4 gửi. Phạm vi: wiring API, policy resolved ở repository, hồi quy transaction và mã lỗi client. Không viết thay thuật toán Matching, không merge/push code các nhánh khác, không thay backend 3000/3011 đang chạy hoặc reset dữ liệu app.

## Source Matching đã nhận

Lượt đầu tài liệu bàn giao đi trước source nên test thật bị skip. Lượt cập nhật sau đã nhận commit `de31d6d`; `main` tại `d23420e` cũng đã chứa matcher. Source và tests của Người 4 được tiếp nhận nguyên bản, chỉ cập nhật hai kỳ vọng lỗi HTTP theo backend contract: matcher lỗi 503 `MATCHING_UNAVAILABLE`, output sai 502 `PROVIDER_INVALID_RESPONSE`.

Không cần đổi contract hoặc thêm selector. Factory vẫn nhận bán kính 100 m/top 3, thuật toán/routing thuộc Người 4. Backend không viết lại Haversine/scoring.

Unit matcher 7/7 và toàn bộ HTTP integration 36/36 đã qua. Ca configured factory thật không còn skip. OpenAI trong các ca tích hợp dùng adapter thật nhưng phản hồi mạng giả lập; không phải nghiệm thu Vision thật. Xem [báo cáo mới](BACKEND_MERGE_READINESS.md).

## Wiring đã chuẩn bị

`bootstrap/matching-factory.ts` đọc selector **đang có** `MATCHING_PROVIDER=mock|real`, không thêm `MATCHING_MODE`. Với `real`, loader đọc đúng workspace package `@civicmerge/matching`, kiểm tra named export `createGpsFeatureMatcher`, rồi đăng ký vào `AdapterFactories.realMatcher`:

```ts
realMatcher: () => createGpsFeatureMatcher({ radiusMeters: 100, maxCandidates: 3 })
```

`server.ts` và `backend:check` dùng loader. Module path không lấy từ env. Factory được chụp khi khởi động và phải trả `DuplicateMatcher` đồng bộ. Thiếu export/factory sai interface gây lỗi cấu hình, không fallback mock. `mock` không cần factory thật và các module mock hiện có được giữ nguyên. Registry vẫn nhận fixture factory trong test, không được coi fixture đó là thuật toán thật.

`CivicMerge.cmd` cố ý giữ AI/matching mock cho demo lưu trữ hiện tại. Khi đã nhận source Matching, mở terminal riêng bằng Node/npm đúng repo, chọn cổng trống và URL LAN thực tế:

```powershell
$env:PORT = '3012'
$env:HOST = '0.0.0.0'
$env:PUBLIC_BASE_URL = 'http://<LAN-IP>:3012'
$env:PERSISTENCE_MODE = 'memory'
$env:STORAGE_PROVIDER = 'local'
$env:AI_PROVIDER = 'mock'
$env:MATCHING_PROVIDER = 'real'
$env:MOCK_MODE = 'true'
$env:MOCK_SCENARIO = 'pothole'
npm.cmd run backend:check
npm.cmd run dev:api
```

Đây là server và dữ liệu memory/local riêng, không phải backend app cổng 3000/3011. Thiếu source thì `backend:check` phải báo thiếu export, chưa chạy lệnh server thật. Health vòng ghép đúng là `mode=mock`, capability `vision=mock`, `matching=real`; scenario/reset controls không có. Chọn scenario bằng env lúc khởi tạo. Không cần OpenAI/Supabase key cho vòng memory/local này.

## Guard resolved đã triển khai

Theo policy trong handoff, **merge mới vào resolved bị chặn** trong cả memory và PostgreSQL:

```json
{"error":{"code":"INCIDENT_RESOLVED","message":"Hồ sơ đích đã được xử lý. Hãy tạo hồ sơ mới."}}
```

Status HTTP 409. Report vẫn pending, chưa liên kết incident; không tăng reportCount/history/confirmation, không xóa ảnh và không reopen hồ sơ. Merge vào `in_progress` giữ status đó.

PostgreSQL tiếp tục khóa report → đọc confirmation cũ → khóa incident đích → kiểm tra tồn tại/type/status → writes → snapshot/commit. Retry cùng lựa chọn đã thành công trả snapshot cũ **trước guard status**, kể cả incident hiện resolved. Đổi lựa chọn vẫn `REPORT_ALREADY_CONFIRMED` 409. Status kiểm tra dưới incident row lock nên resolve xảy ra sau analyze vẫn được xử lý đúng theo thứ tự transaction.

Không thêm API đổi status hoặc workflow quản trị. Không cần migration mới vì cột/enum status đã có; migration cũ giữ nguyên checksum. Fixture status trong memory dùng backing map riêng của test; không có endpoint hoặc setter status công khai.

Client helper bổ sung `INCIDENT_RESOLVED` 409 vào nhóm rejection chắc chắn để mở lại lựa chọn; `REPORT_ALREADY_CONFIRMED`, timeout/5xx vẫn không cho đổi lựa chọn. Source đã ghép UI Người 1, nhãn AI/matching và controls dựa trên health capabilities. APK đang cài chưa tự nhận sửa này; chưa build/cài APK mới hoặc nghiệm thu mixed mode trên thiết bị.

## Kiểm thử đã chạy tại Người 3

| Kiểm tra | Kết quả |
|---|---|
| Typecheck toàn workspace | PASS |
| Lint, module fixtures | PASS |
| HTTP integration | 36/36 PASS, 0 skip |
| Matcher unit tests | 7/7 PASS |
| Client error/provider classification | 3/3 PASS |
| Export Android | PASS, chỉ export bundle; chưa build/cài APK mới |
| PostgreSQL transaction/concurrency/policy/configured workflow | 17/17 PASS, 0 skip, DB local mới riêng |

DB test mới `civicmerge_test_1794639520483`, PostgreSQL 17.11 tại loopback 55439. Guard URL/current_database/schema trống/advisory lock vẫn được giữ; không ghi fixture hoặc reset database/bucket app. Dữ liệu test được giữ trên D, server PostgreSQL test đã dừng sau kiểm chứng.

Các case mới chứng minh:

- Memory và HTTP: resolved sau analyze làm merge trả 409, pending còn nguyên, sau đó create được incident mới; snapshots trước đó giữ nguyên, không reopen.
- PostgreSQL: resolved từ chối merge mới, không tăng count/history/snapshot; retry create và merge đã thành công giữ snapshot; `in_progress` không bị đổi thành open.
- **Resolve thắng:** test giữ lock status update, quan sát confirm thực sự bị block bằng `pg_blocking_pids`, commit resolve rồi confirm đọc lại status và rollback với 409.
- **Confirm thắng:** trigger riêng ở DB test tạm giữ confirm bằng advisory lock khi đã giữ row lock; quan sát status update bị block; thả confirm commit trước, resolve chạy sau; merge thành công và retry vẫn trả snapshot cũ.
- Loader: mock không cần import factory thật, thiếu/sai export bị từ chối; defaults 100 m/top 3 được truyền đúng vào fixture factory.

## Chưa chạy / bước tiếp theo

- Đã chạy actual matcher qua configured HTTP cùng near/far/no-GPS, retry/conflict và hai ảnh. Đã chạy factory OpenAI/matcher cùng PostgreSQL thật và mạng Storage/OpenAI giả lập; chưa nghiệm thu kết hợp toàn bộ dịch vụ live.
- Chưa có Vision/ảnh thật để hiệu chỉnh scoring; chưa nghiệm thu matcher mới trên iPhone hoặc hai điện thoại.
- Không chạy lại Storage live test vì không đổi adapter ảnh. Bộ test SQL dùng database riêng, không Supabase project app.
- Backend demo đang chạy giữ nguyên phiên bản trong bộ nhớ; guard mới chỉ có hiệu lực khi chủ động khởi động server dùng source mới vào thời điểm đã phối hợp. Không tự restart phiên đang dùng để đưa policy lên dữ liệu chung.
- Bước tiếp theo: cấu hình AI riêng, ảnh được phép dùng, thử backend cổng riêng và nghiệm thu thiết bị với Người 1/2/4 theo báo cáo merge readiness.
