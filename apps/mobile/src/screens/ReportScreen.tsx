import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ExpoLocation from 'expo-location';
import type { AnalyzeResponse, Location, MockScenario } from '@civicmerge/contracts';
import demoLocation from '../../../../mocks/fixtures/location.json';
import { api, MOCK_MODE, type UploadImage } from '../services/api';
import {
  Badge,
  Body,
  Button,
  Card,
  colors,
  ErrorNotice,
  Heading,
  Loading,
  messageOf,
  Page,
  Photo,
  SectionTitle,
  styles,
} from '../ui';

const scenarios: { value: MockScenario; title: string; icon: string }[] = [
  { value: 'pothole', title: 'Ổ gà', icon: '⚠️' },
  { value: 'trash', title: 'Rác thải', icon: '♻️' },
  { value: 'flood', title: 'Ngập nước', icon: '🌊' },
  { value: 'ai-error', title: 'AI lỗi', icon: '🛑' },
];

export function ReportScreen({
  onResult,
  onBusy,
}: {
  onResult(result: AnalyzeResponse): void;
  onBusy(busy: boolean): void;
}) {
  const [image, setImage] = useState<UploadImage | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [locationNote, setLocationNote] = useState('Chưa có GPS. Bạn vẫn có thể gửi báo cáo.');
  const [isDemoLocation, setIsDemoLocation] = useState(false);
  const [scenario, setScenario] = useState<MockScenario>('pothole');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  async function pick(camera: boolean) {
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      throw new Error('Chưa được cấp quyền camera. Bạn có thể mở Cài đặt hoặc chọn ảnh có sẵn.');
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    // Normalize HEIC/other picker formats to a bounded JPEG accepted by the API.
    const converted = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: Math.min(result.assets[0].width, 1600) } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    setImage({ uri: converted.uri, name: 'incident.jpg', type: 'image/jpeg' });
  }

  async function gps() {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setLocation(null);
      setIsDemoLocation(false);
      setLocationNote('Bạn từ chối GPS. Báo cáo vẫn được gửi nhưng không có tìm trùng theo vị trí.');
      return;
    }
    if (!(await ExpoLocation.hasServicesEnabledAsync())) {
      throw new Error('Dịch vụ vị trí đang tắt. Có thể gửi báo cáo không kèm GPS.');
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Chưa lấy được GPS. Thử lại hoặc gửi không kèm vị trí.')),
            12000,
          );
        }),
      ]);
      setLocation({ latitude: value.coords.latitude, longitude: value.coords.longitude });
      setIsDemoLocation(false);
      setLocationNote('Đang dùng GPS thực tế của thiết bị.');
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    <Page>
      <View style={s.headerBox}>
        <Heading>Báo cáo sự cố</Heading>
        <Body>Cung cấp hình ảnh và vị trí để AI phân loại và kiểm tra hồ sơ trùng lặp.</Body>
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <SectionTitle>1. Hình ảnh minh chứng</SectionTitle>
          <Badge
            tone={image ? 'success' : 'neutral'}
            label={image ? '✓ Đã chọn ảnh' : 'Bắt buộc'}
          />
        </View>

        {image ? (
          <Photo uri={image.uri} label="Ảnh minh chứng đã chuẩn hóa JPEG, sẵn sàng phân tích" />
        ) : (
          <View style={s.placeholderBox}>
            <Text style={s.placeholderIcon}>📸</Text>
            <Text style={s.placeholderTitle}>Chưa có ảnh sự cố</Text>
            <Text style={styles.caption}>
              Hãy chụp ảnh trực tiếp hoặc chọn ảnh từ thư viện thiết bị
            </Text>
          </View>
        )}

        <View style={styles.gridTwo}>
          <View style={styles.flexOne}>
            <Button
              title="📷 Chụp ảnh"
              onPress={() => void run(() => pick(true))}
              disabled={busy}
            />
          </View>
          <View style={styles.flexOne}>
            <Button
              title="🖼️ Thư viện"
              onPress={() => void run(() => pick(false))}
              disabled={busy}
              secondary
            />
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <SectionTitle>2. Vị trí sự cố (GPS)</SectionTitle>
          <Badge
            tone={location ? (isDemoLocation ? 'warning' : 'success') : 'neutral'}
            label={
              location
                ? isDemoLocation
                  ? '📍 Vị trí mẫu Demo'
                  : '📍 Đã có GPS'
                : 'Chưa có GPS'
            }
          />
        </View>

        <View style={s.coordBox}>
          <Body>{locationNote}</Body>
          {location && (
            <Text style={s.coordText}>
              Tọa độ: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          )}
        </View>

        <Button
          title="📍 Lấy vị trí hiện tại"
          onPress={() => void run(gps)}
          disabled={busy}
          secondary
        />

        <View style={styles.gridTwo}>
          {MOCK_MODE && (
            <View style={styles.flexOne}>
              <Button
                title="🎯 Vị trí mẫu (Demo)"
                onPress={() => {
                  setLocation(demoLocation);
                  setIsDemoLocation(true);
                  setLocationNote('Đang dùng vị trí mẫu cố định để demo tìm trùng.');
                }}
                disabled={busy}
                secondary
                compact
              />
            </View>
          )}
          <View style={styles.flexOne}>
            <Button
              title="Bỏ qua GPS"
              onPress={() => {
                setLocation(null);
                setIsDemoLocation(false);
                setLocationNote('Đã chọn gửi báo cáo không kèm GPS.');
              }}
              disabled={busy}
              secondary
              compact
            />
          </View>
        </View>
      </Card>

      {MOCK_MODE && (
        <Card style={s.mockCard}>
          <View style={styles.rowBetween}>
            <SectionTitle>3. Kịch bản AI giả lập</SectionTitle>
            <Badge tone="warning" label="MOCK MODE" />
          </View>
          <Text style={styles.caption}>
            Chọn kết quả giả lập cho backend khi thử nghiệm (chọn cùng loại để test gộp hồ sơ):
          </Text>
          <View style={s.scenarioGrid}>
            {scenarios.map((item) => {
              const active = scenario === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setScenario(item.value)}
                  style={[s.scenarioChip, active && s.scenarioChipActive]}
                >
                  <Text style={[s.scenarioText, active && s.scenarioTextActive]}>
                    {item.icon} {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      {!!error && (
        <>
          <ErrorNotice message={error} />
          <Button
            title="⚙️ Mở Cài đặt ứng dụng"
            onPress={() => void run(() => Linking.openSettings())}
            disabled={busy}
            secondary
          />
        </>
      )}

      {busy && <Loading label="AI đang phân tích hình ảnh và đối chiếu dữ liệu…" />}

      <Button
        title={
          busy
            ? 'Đang phân tích…'
            : MOCK_MODE
              ? '🔍 Phân tích & Kiểm tra trùng (Mock)'
              : '🔍 Phân tích sự cố bằng AI'
        }
        disabled={busy || !image}
        onPress={() =>
          void run(async () => {
            if (!image) return;
            if (MOCK_MODE) await api.scenario(scenario);
            onResult(await api.analyze(image, location));
          })
        }
      />
    </Page>
  );
}

const s = StyleSheet.create({
  headerBox: {
    gap: 4,
  },
  placeholderBox: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    gap: 6,
  },
  placeholderIcon: {
    fontSize: 32,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  coordBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  coordText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  mockCard: {
    backgroundColor: colors.surface,
    borderColor: colors.warningBorder,
  },
  scenarioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scenarioChip: {
    width: '48%',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  scenarioChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.soft,
  },
  scenarioText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  scenarioTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
});
