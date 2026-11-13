import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Text } from 'react-native';
import type { IncidentSummary } from '@civicmerge/contracts';
import { api, API_URL, MOCK_MODE } from '../services/api';
import { Body, Button, Card, ErrorNotice, Heading, Loading, Page, Photo, messageOf, statusLabels, styles, typeLabels } from '../ui';
export function HomeScreen({ onReport, onDetail }: { onReport(): void; onDetail(id: string): void }) {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setIncidents((await api.list()).incidents); } catch (error) { setError(messageOf(error)); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  function reset() {
    Alert.alert('Reset dữ liệu mock?', 'Xóa dữ liệu nghiệp vụ của backend đang kết nối. Chỉ reset khi cả nhóm đã thống nhất.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => {
        setLoading(true); setError('');
        void api.reset().then(load).catch(error => { setError(messageOf(error)); setLoading(false); });
      } },
    ]);
  }
  return <Page>
    <Text style={styles.caption}>ONE ISSUE, ONE RECORD</Text><Heading>Cùng chăm sóc thành phố</Heading>
    <Body>Gửi một hình ảnh. Kết nối nhiều phản ánh vào một hồ sơ sự cố.</Body>
    {MOCK_MODE && <Card><Body>Đang dùng bản mock</Body><Text selectable style={styles.caption}>API: {API_URL || 'Chưa cấu hình'}</Text><Body>AI và điểm tìm trùng là giả lập. Dữ liệu mất khi backend khởi động lại.</Body></Card>}
    <Button title="Báo cáo sự cố" onPress={onReport} disabled={loading} />
    <Button title="Tải lại danh sách" onPress={() => void load()} secondary disabled={loading} />
    {loading && <Loading />}{!!error && <ErrorNotice message={error} />}
    {!loading && !error && incidents.length === 0 && <Card><Body>Chưa có hồ sơ. Hãy gửi ảnh đầu tiên để bắt đầu.</Body></Card>}
    {incidents.map(incident => <Card key={incident.id}>
      <Photo uri={incident.coverImageUrl} label={`Ảnh ${typeLabels[incident.type]}`} />
      <Body>{typeLabels[incident.type]} · {statusLabels[incident.status]}</Body><Body>{incident.description}</Body>
      <Text style={styles.caption}>{incident.reportCount} minh chứng · {incident.assignedTeam}</Text>
      <Button title="Xem hồ sơ" onPress={() => onDetail(incident.id)} secondary />
    </Card>)}
    {MOCK_MODE && <Button title="Reset dữ liệu mock" onPress={reset} secondary disabled={loading} />}
  </Page>;
}
