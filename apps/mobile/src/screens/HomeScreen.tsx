import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { IncidentSummary } from '@civicmerge/contracts';
import { api, API_URL, providerState, setApiUrl } from '../services/api';
import { useFlow } from '../state/flow';
import {
  Badge,
  Body,
  Button,
  Card,
  colors,
  dateLabel,
  ErrorNotice,
  Heading,
  Loading,
  Page,
  Photo,
  SectionTitle,
  SeverityBadge,
  StatusBadge,
  styles,
  TypeBadge,
  typeLabels,
  messageOf,
} from '../ui';

export function HomeScreen({
  onReport,
  onDetail,
}: {
  onReport(): void;
  onDetail(id: string): void;
}) {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [backendUrl, setBackendUrl] = useState(API_URL);
  const [connectionNote, setConnectionNote] = useState('');
  const { setResult } = useFlow();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!API_URL) { setLoading(false); return; }
    try {
      await api.health();
      setIncidents((await api.list()).incidents);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function connect() {
    setLoading(true); setError(''); setConnectionNote('');
    try {
      setApiUrl(backendUrl); setBackendUrl(API_URL); setResult(null); setIncidents([]);
      const health = await api.health();
      setIncidents((await api.list()).incidents);
      setConnectionNote(health.capabilities?.persistence === 'postgres' && health.capabilities.storage === 'supabase'
        ? 'Đã kết nối PostgreSQL và Supabase Storage.' : 'Đã kết nối máy chủ.');
    } catch (error) { setError(messageOf(error)); }
    finally { setLoading(false); }
  }

  function reset() {
    Alert.alert(
      'Reset dữ liệu mock?',
      'Xóa dữ liệu nghiệp vụ của backend đang kết nối. Chỉ reset khi cả nhóm đã thống nhất.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setLoading(true);
            setError('');
            void api
              .reset()
              .then(load)
              .catch((error) => {
                setError(messageOf(error));
                setLoading(false);
              });
          },
        },
      ],
    );
  }

  const totalReports = incidents.reduce((sum, item) => sum + item.reportCount, 0);

  return (
    <Page>
      <Card style={s.heroCard}>
        <Badge tone="primary" label="ONE ISSUE, ONE RECORD" />
        <Heading>Cùng chăm sóc thành phố</Heading>
        <Body>
          Gửi ảnh sự cố đô thị, xem đề xuất nghi trùng và xác nhận tạo hồ sơ mới hoặc hợp nhất vào hồ sơ sẵn có.
        </Body>
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statNumber}>{incidents.length}</Text>
            <Text style={styles.caption}>Hồ sơ sự cố</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNumber}>{totalReports}</Text>
            <Text style={styles.caption}>Minh chứng cộng đồng</Text>
          </View>
        </View>
        <Button title="📷 Báo cáo sự cố mới" onPress={onReport} disabled={loading || !API_URL} />
        <Button
          title="🔄 Tải lại danh sách"
          onPress={() => void load()}
          secondary
          compact
          disabled={loading}
        />
      </Card>

      <Card>
        <SectionTitle>Kết nối máy chủ</SectionTitle>
        <TextInput accessibilityLabel="Địa chỉ máy chủ" placeholder="http://<LAN-IP>:3011" value={backendUrl}
          onChangeText={setBackendUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
          editable={!loading} style={styles.input} />
        <Body>Điện thoại cần cùng Wi-Fi với laptop khi dùng địa chỉ LAN.</Body>
        <Button title="Lưu và kết nối" onPress={() => void connect()} disabled={loading} secondary />
        {!!connectionNote && <Text accessibilityLiveRegion="polite" style={styles.caption}>{connectionNote}</Text>}
      </Card>

      {(
        <Card style={s.mockBanner}>
          <View style={styles.rowBetween}>
            <Badge tone="neutral" label="CẤU HÌNH MÁY CHỦ" />
            {providerState().controlsAllowed && <Button
              title="Reset dữ liệu"
              onPress={reset}
              secondary
              compact
              disabled={loading}
            />}
          </View>
          <Text selectable style={styles.caption}>
            API: {API_URL || 'Chưa cấu hình'}
          </Text>
          <Text style={styles.caption}>
            {providerState().label}
          </Text>
        </Card>
      )}

      <View style={styles.rowBetween}>
        <SectionTitle>Hồ sơ sự cố gần đây</SectionTitle>
        <Badge tone="neutral" label={`${incidents.length} hồ sơ`} />
      </View>

      {loading && <Loading label="Đang tải danh sách sự cố…" />}
      {!!error && <ErrorNotice message={error} />}

      {!loading && !error && !!API_URL && incidents.length === 0 && (
        <Card style={s.emptyCard}>
          <Text style={s.emptyIcon}>🏙️</Text>
          <SectionTitle>Chưa có hồ sơ sự cố nào</SectionTitle>
          <Body>
            Hãy bấm &ldquo;Báo cáo sự cố mới&rdquo; và gửi bức ảnh đầu tiên để bắt đầu theo dõi.
          </Body>
        </Card>
      )}

      {incidents.map((incident) => (
        <Card key={incident.id}>
          <View style={styles.rowBetween}>
            <View style={styles.rowWrap}>
              <TypeBadge type={incident.type} />
              <SeverityBadge severity={incident.severity} />
            </View>
            <StatusBadge status={incident.status} />
          </View>

          <Photo
            uri={incident.coverImageUrl}
            label={`Ảnh minh chứng ${typeLabels[incident.type]} · Cập nhật ${dateLabel(incident.updatedAt)}`}
          />

          <Body>{incident.description}</Body>

          <View style={s.metaBox}>
            <View style={styles.rowBetween}>
              <Badge
                tone={incident.reportCount > 1 ? 'success' : 'neutral'}
                label={`📸 ${incident.reportCount} minh chứng${incident.reportCount > 1 ? ' (Đã hợp nhất)' : ''}`}
              />
              <Text style={styles.caption}>🏛️ {incident.assignedTeam}</Text>
            </View>
          </View>

          <Button
            title="Xem chi tiết hồ sơ →"
            onPress={() => onDetail(incident.id)}
            secondary
          />
        </Card>
      ))}
    </Page>
  );
}

const s = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softBorder,
    borderWidth: 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 2,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  mockBanner: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    padding: 12,
    gap: 6,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyIcon: {
    fontSize: 36,
  },
  metaBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
