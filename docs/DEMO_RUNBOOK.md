# Chạy demo riêng — PostgreSQL/Storage thật, AI/matching mock

Chặng chuẩn bị demo từ commit backend `32f1854`, nhánh `feature/demo-readiness`. Không thay repository/migration/Storage hoặc backend cổng 3000. Không triển khai OTA/FPT, không nhận diện ảnh thật. Kiểm tra thiết bị theo mục cuối; chưa đánh dấu nghiệm thu Android/iPhone/hai điện thoại.

## Chạy trên máy Windows hiện tại

**Cách đơn giản:** mở file **`CivicMerge.cmd`** ngay tại root repo bằng double-click. Script tự tìm IP; nếu demo đã chạy với IP đó thì chỉ hiện lại URL, nếu IP đã đổi thì tự dừng đúng phiên demo cũ và chạy lại ở IP mới. Không cần gõ stop/start. Nhập URL được hiện ra vào ô kết nối trong APK; giữ cửa sổ backend đang chạy mở. Backend 3000 và `.env` không đổi. Có thể tạo shortcut tới file này trên Desktop bằng thao tác Windows bình thường.

Mở PowerShell tại root repo. Cách đơn giản, tự dùng Node portable nếu có và đặt cache/TEMP dưới `.runtime/cache` trên ổ chứa repo (máy này là D):

```powershell
cd D:\codex14-11\civic-merge-1
.\scripts\DemoBackend.cmd check
.\scripts\DemoBackend.cmd start
```

Cũng có thể mở `scripts/DemoBackend.cmd` bằng double-click để start. Giữ terminal đó mở. Sau khi dùng `.runtime/DevTerminal.cmd`, có thể thay bằng npm scripts:

```powershell
npm.cmd run demo:check
npm.cmd run demo:start
```

Node **24.21.0**, npm **11.19.0** là toolchain đã kiểm tra; không cần cài thêm Android Studio, Docker hay Expo/Supabase account. Backend đọc credential riêng từ `apps/api/.env`, giữ nguyên file đó. Thông tin database/TLS/bucket xem [BACKEND_STORAGE.md](BACKEND_STORAGE.md).

`check` chỉ đọc metadata private bucket và bảng database, không mở server hoặc tạo report. `start` chạy đúng cổng **3011**, chọn IPv4 LAN đang gán cho máy, bỏ loopback/adapter ảo. Nếu nhiều mạng không thể chọn chắc chắn:

```powershell
.\scripts\DemoBackend.cmd start --ip=192.168.1.20
# Hoặc npm.cmd run demo:start -- --ip=192.168.1.20
```

Thay IP bằng IPv4 Wi-Fi hiện tại từ `ipconfig`. Script từ chối IP không gán cho máy. Không hard-code IP vào source, không ghi credential vào lệnh terminal. Khi đổi Wi-Fi, dừng riêng demo và start lại để URL ảnh mới theo IP hiện tại.

Script chỉ override môi trường **tiến trình demo**:

```dotenv
PORT=3011
HOST=0.0.0.0
PUBLIC_BASE_URL=http://<LAN-IP>:3011
PERSISTENCE_MODE=postgres
STORAGE_PROVIDER=supabase
AI_PROVIDER=mock
MATCHING_PROVIDER=mock
MOCK_MODE=true
```

Giữ các biến database/TLS và bucket trong `.env` đã cấu hình. **Dùng cùng DATABASE_URL và bucket của app**, không phải một môi trường test tự động riêng. Báo cáo người dùng chủ động gửi vào demo được giữ trong database đó. Nếu database đang được nhóm dùng chung, phối hợp trước khi gửi dữ liệu demo; backend cũ cổng 3000 có thể chưa hiểu tham chiếu ảnh Storage mới. Giữ nguyên tiến trình 3000 không đồng nghĩa hai backend có nguồn dữ liệu độc lập.

Không có fixture tự động, seed, reset hoặc cleanup nghiệp vụ trên database/bucket app. Không mở public bucket. Test tự động tiếp tục dùng môi trường riêng theo tài liệu database/Storage.

## Xem trạng thái và dừng đúng backend

Từ terminal khác:

```powershell
.\scripts\DemoBackend.cmd status
.\scripts\DemoBackend.cmd stop
# Hoặc npm.cmd run demo:status / npm.cmd run demo:stop
```

Hoặc Ctrl+C trong chính terminal chạy demo. Không dùng `taskkill /IM node.exe`, không đóng terminal của backend 3000.

Metadata PID/session trong `.runtime/demo` (gitignored). Lệnh stop xác thực token ngẫu nhiên **và PID phiên demo** qua named pipe local (không phải TCP/HTTP endpoint), yêu cầu HTTP server/pool tự đóng. Không kill PID từ file. PID/token cũ, controller lạ hoặc metadata hỏng bị từ chối, không fallback sang kill tiến trình. Token không được in log hoặc đưa vào Git.

Start lần nữa với cùng IP chỉ báo URL, không tạo backend trùng. Nếu IP đổi, xác thực và yêu cầu phiên demo cũ shutdown an toàn rồi mới chạy lại; nếu chưa dừng xong sau 30 giây thì báo chờ, không force kill. Nếu cổng 3011 đã bị một chương trình khác chiếm, start thất bại an toàn, không tự dừng chương trình đó. Lock của tiến trình đã chết có thể được gỡ theo token sau kiểm tra PID; nếu PID vẫn sống mà controller không xác thực được thì dừng để người quản trị kiểm tra.

## Kết nối APK đang có

1. Laptop và Android cùng Wi-Fi; laptop có Internet truy cập Supabase.
2. Start demo và lấy URL được in ra, dạng `http://<LAN-IP>:3011`.
3. Trên Chrome Android mở URL đó thêm `/health`. Phải có:

```json
{"status":"ok","mode":"mock","capabilities":{"persistence":"postgres","storage":"supabase","vision":"mock","matching":"mock"}}
```

4. Mở CivicMerge → Kết nối máy chủ → nhập **URL gốc** `http://<LAN-IP>:3011`, không kèm `/health` → Lưu và kết nối.
5. Giữ `http://` cho backend LAN hiện không TLS. Nếu không truy cập được từ Chrome, kiểm tra IP/Wi-Fi và inbound rule cho Node/cổng 3011. Không tắt toàn bộ Windows Firewall; chỉ phối hợp mở rule giới hạn mạng phù hợp khi cần.

APK đã tải trước đây vẫn gọi được backend này. Những sửa UI/client trong chặng hiện tại chỉ có sau khi build/cài APK mới; export bundle không thay APK trên điện thoại. Xem [ANDROID_APK.md](ANDROID_APK.md).

## Checklist điện thoại — người dùng thực hiện

Không reset database để tạo danh sách trống. Ghi lại ID incident vừa tạo để đối chiếu, tránh nhầm dữ liệu đã có.

- [ ] Cài/mở APK, lưu URL demo; đóng/mở app còn URL.
- [ ] Ảnh đầu: chụp/chọn ảnh, cấp GPS hoặc dùng **vị trí mẫu (demo)**, phân tích rồi **Tạo hồ sơ mới**. Ghi incident ID. Analyze chưa tạo incident trước confirm.
- [ ] Ảnh thứ hai: chọn ảnh khác, cùng vị trí mẫu/GPS; tìm đúng incident vừa tạo trong candidates, xem ảnh cũ rồi **Xác nhận hợp nhất**.
- [ ] Detail của incident đó có **reportCount=2, hai reports, hai ảnh, hai history events**. Tổng database có thể có incident/report khác từ trước.
- [ ] Trong Dashboard Storage, bucket app có các object UUID mới; cả hai ảnh xem được qua URL proxy `/api/images/...` của backend demo.
- [ ] Tải lại danh sách và đóng/mở app vẫn xem được.
- [ ] Khi không còn thao tác gửi/confirm: `demo:stop` rồi `demo:start`, mở lại đúng incident, hai ảnh/dữ liệu còn. Chỉ restart 3011, giữ 3000 nguyên trạng.
- [ ] Từ chối GPS/gửi không GPS: analyze vẫn được, candidates rỗng, cảnh báo rõ; nếu confirm tạo mới thì đây là một incident demo bổ sung có chủ đích.
- [ ] Nếu có hai điện thoại: cả hai dùng cùng URL demo; điện thoại thứ nhất tạo, thứ hai merge, tải lại trên máy thứ nhất thấy hai minh chứng.

Một điện thoại gửi hai báo cáo chỉ chứng minh luồng một thiết bị. Chưa tính là nghiệm thu hai điện thoại hoặc iPhone. Không tạo thêm report khi chỉ retry confirm: test tự động đã chứng minh retry cùng lựa chọn giữ snapshot/count. Không đổi lựa chọn sau timeout; chỉ retry cùng lựa chọn. UI client mới cho phép đổi lựa chọn sau lỗi merge chắc chắn bị từ chối; bản APK cũ có thể chưa có sửa này.

AI mặc định fixture `pothole`; mọi ảnh hợp lệ có thể nhận cùng kết quả. Matching có score/khoảng cách giả lập. Luồng demo này chứng minh API, transaction và persistence/Storage, không chứng minh độ chính xác AI/GPS scoring.

## Kết quả tự động chặng chuẩn bị

- Typecheck toàn workspace, lint Mobile, module fixtures và HTTP integration: PASS.
- `test:demo`: PASS 6/6 (chọn LAN; metadata không nhắm 3000; token/PID sai không stop; controller lạ không kill PID; giữ phiên cùng IP, chờ shutdown khi đổi IP và không force kill khi dừng chậm).
- `demo:check`: PASS trên Supabase cấu hình riêng, chỉ đọc.
- Start 3011 → health localhost/LAN, list, mock controls không tồn tại → status → start lặp → stop → start lại: PASS, không ghi report/ảnh tự động vào app.
- So sánh SHA-256 file `.env` và PID listener cổng 3000 trước/sau: không đổi; health 3000 tiếp tục 200.
- Người dùng đã xác nhận mở `/health` cổng 3011 trên Chrome Android cùng Wi-Fi và thấy đúng status/capabilities PostgreSQL + Storage. Đây là kiểm tra mạng trên thiết bị, chưa phải nghiệm thu chụp ảnh/create/merge.
- Test DB/concurrency và Storage live không chạy lại trong chặng này vì không thay implementation. Kết quả đã chạy riêng ở [BACKEND_VERIFICATION.md](BACKEND_VERIFICATION.md), không coi đó là test mới.

## Khi nhận module thật

Người 2 bàn giao đường dẫn/export factory `VisionAnalyzer`, key/model/timeout/cancellation và lỗi an toàn. Người 4 bàn giao factory `DuplicateMatcher`, config ngưỡng và fixtures GPS/features. Người 3 import/register tại `createConfiguredBackend(..., {root, factories})` trong `server.ts`, chạy lại test tích hợp rồi mới đổi selector. Launcher demo này cố ý giữ mock để kiểm thử xác định; không dùng nó để tuyên bố module thật đã tích hợp. Không gửi key qua chat hoặc đưa vào Mobile.
