import { useRef, useState } from 'react';
import { Linking, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ExpoLocation from 'expo-location';
import type { AnalyzeResponse, Location, MockScenario } from '@civicmerge/contracts';
import demoLocation from '../../../../mocks/fixtures/location.json';
import { api, MOCK_MODE, type UploadImage } from '../services/api';
import { Body, Button, Card, ErrorNotice, Heading, Loading, Page, Photo, messageOf, styles } from '../ui';
const scenarios: { value: MockScenario; title: string }[] = [
  { value: 'pothole', title: 'Ổ gà' }, { value: 'trash', title: 'Rác thải' }, { value: 'flood', title: 'Ngập nước' }, { value: 'ai-error', title: 'AI lỗi' },
];
export function ReportScreen({ onResult, onBusy }: { onResult(result: AnalyzeResponse): void; onBusy(busy: boolean): void }) {
  const [image, setImage] = useState<UploadImage | null>(null); const [location, setLocation] = useState<Location | null>(null);
  const [locationNote, setLocationNote] = useState('Chưa có GPS. Bạn vẫn có thể gửi báo cáo.');
  const [scenario, setScenario] = useState<MockScenario>('pothole');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusy(true); setError('');
    try { await action(); } catch (error) { setError(messageOf(error)); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  async function pick(camera: boolean) {
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Chưa được cấp quyền camera. Bạn có thể mở Cài đặt hoặc chọn ảnh có sẵn.');
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    // Normalize HEIC/other picker formats to a bounded JPEG accepted by the API.
    const converted = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: Math.min(result.assets[0].width, 1600) } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    setImage({ uri: converted.uri, name: 'incident.jpg', type: 'image/jpeg' });
  }
  async function gps() {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    if (!permission.granted) { setLocation(null); setLocationNote('Bạn từ chối GPS. Báo cáo vẫn được gửi nhưng không có tìm trùng theo vị trí.'); return; }
    if (!await ExpoLocation.hasServicesEnabledAsync()) throw new Error('Dịch vụ vị trí đang tắt. Có thể gửi báo cáo không kèm GPS.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Chưa lấy được GPS. Thử lại hoặc gửi không kèm vị trí.')), 12000); }),
      ]);
      setLocation({ latitude: value.coords.latitude, longitude: value.coords.longitude }); setLocationNote('Đang dùng GPS của thiết bị.');
    } finally { clearTimeout(timer); }
  }
  return <Page><Heading>Báo cáo sự cố</Heading><Body>Ảnh của bạn là minh chứng cho hồ sơ.</Body>
    {image && <Photo uri={image.uri} label="Ảnh sẽ được gửi" />}
    <Button title="Chụp ảnh" onPress={() => void run(() => pick(true))} disabled={busy} />
    <Button title="Chọn ảnh có sẵn" onPress={() => void run(() => pick(false))} disabled={busy} secondary />
    <Card><Body>{locationNote}</Body>{location && <Text style={styles.caption}>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</Text>}
      <Button title="Lấy vị trí hiện tại" onPress={() => void run(gps)} disabled={busy} secondary />
      <Button title="Gửi không kèm GPS" onPress={() => { setLocation(null); setLocationNote('Đã chọn không gửi GPS.'); }} disabled={busy} secondary />
      {MOCK_MODE && <Button title="Dùng vị trí mẫu (demo)" onPress={() => { setLocation(demoLocation); setLocationNote('Đang dùng vị trí mẫu, không phải GPS thật.'); }} disabled={busy} secondary />}
    </Card>
    {MOCK_MODE && <Card><Body>Kịch bản AI giả lập</Body><Text style={styles.caption}>Ảnh không quyết định kết quả AI trong bản mock. Lựa chọn này áp dụng cho backend đang kết nối; phối hợp khi dùng chung.</Text>
      {scenarios.map(item => <Button key={item.value} title={`${scenario === item.value ? 'Đã chọn: ' : ''}${item.title}`} onPress={() => setScenario(item.value)} disabled={busy} secondary={scenario !== item.value} />)}
    </Card>}
    {!!error && <><ErrorNotice message={error} /><Button title="Mở Cài đặt ứng dụng" onPress={() => void run(() => Linking.openSettings())} disabled={busy} secondary /></>}
    {busy && <Loading />}
    <Button title={busy ? 'Đang xử lý…' : MOCK_MODE ? 'Phân tích bằng mock' : 'Phân tích ảnh'} disabled={busy || !image} onPress={() => void run(async () => {
      if (!image) return; if (MOCK_MODE) await api.scenario(scenario); onResult(await api.analyze(image, location));
    })} />
  </Page>;
}
