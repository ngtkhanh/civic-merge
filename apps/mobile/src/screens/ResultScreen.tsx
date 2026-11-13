import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import type { AnalyzeResponse, ConfirmRequest, IncidentDetail } from '@civicmerge/contracts';
import { api, MOCK_MODE } from '../services/api';
import { Body, Button, Card, ErrorNotice, Heading, Loading, Page, Photo, messageOf, severityLabels, styles, typeLabels } from '../ui';
export function ResultScreen({ result, onConfirmed, onBusy }: { result: AnalyzeResponse; onConfirmed(id: string): void; onBusy(busy: boolean): void }) {
  const [details, setDetails] = useState<Record<string, IncidentDetail>>({}); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  const lock = useRef(false); const [lastRequest, setLastRequest] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all(result.candidates.map(candidate => api.detail(candidate.incidentId))).then(values => {
      if (active) setDetails(Object.fromEntries(values.map(value => [value.id, value])));
    }).catch(error => { if (active) setError(messageOf(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [result, retry]);
  async function confirm(request: ConfirmRequest) {
    if (lock.current) return;
    lock.current = true; setLastRequest(request); setBusy(true); onBusy(true); setError('');
    try { onConfirmed((await api.confirm(request)).incidentId); } catch (error) { setError(messageOf(error)); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <Page><Heading>Kết quả phân tích</Heading>
    {MOCK_MODE && <Body>Phân tích và điểm nghi trùng đang được giả lập.</Body>}
    <Card><Body>{typeLabels[result.analysis.type]} · Mức độ: {severityLabels[result.analysis.severity]}</Body><Body>{result.analysis.description}</Body></Card>
    {result.warnings.map(warning => <Card key={warning.code}><Body>{warning.message}</Body></Card>)}
    {loading && <Loading />}
    {!!error && <><ErrorNotice message={error} />{!lastRequest && <Button title="Tải lại minh chứng" secondary onPress={() => { setLoading(true); setError(''); setRetry(value => value + 1); }} disabled={busy} />}</>}
    {result.candidates.length === 0 && <Body>Chưa có hồ sơ nghi trùng. Bạn có thể tạo hồ sơ mới.</Body>}
    {result.candidates.map(candidate => {
      const detail = details[candidate.incidentId];
      return <Card key={candidate.incidentId}><Body>Hồ sơ có thể trùng</Body>
        <Text style={styles.caption}>Điểm xếp hạng: {candidate.score.toFixed(2)} · {candidate.distanceMeters} m{MOCK_MODE ? ' (giả lập)' : ''}</Text>
        {candidate.reasons.map((reason, index) => <Body key={index}>{reason}</Body>)}
        {detail && <><Body>{detail.description}</Body>{detail.reports.map((report, index) => <Photo key={report.id} uri={report.imageUrl} label={`Minh chứng trước đó ${index + 1}`} />)}</>}
        <Button title="Xác nhận hợp nhất vào hồ sơ này" disabled={busy || !detail || lastRequest !== null} onPress={() => void confirm({ reportId: result.reportId, action: 'merge', targetIncidentId: candidate.incidentId })} />
      </Card>;
    })}
    <Button title="Tạo hồ sơ mới" disabled={busy || lastRequest !== null} onPress={() => void confirm({ reportId: result.reportId, action: 'create' })} secondary={result.candidates.length > 0} />
    {!!error && lastRequest && <Button title="Thử lại cùng lựa chọn xác nhận" disabled={busy} onPress={() => void confirm(lastRequest)} />}
    {busy && <Loading />}
  </Page>;
}
