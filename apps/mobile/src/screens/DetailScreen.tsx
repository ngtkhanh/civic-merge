import { useEffect, useState } from 'react';
import type { IncidentDetail } from '@civicmerge/contracts';
import { api } from '../services/api';
import { Body, Button, Card, ErrorNotice, Heading, Loading, Page, Photo, dateLabel, messageOf, severityLabels, statusLabels, typeLabels } from '../ui';
export function DetailScreen({ id, onHome }: { id: string; onHome(): void }) {
  const [detail, setDetail] = useState<IncidentDetail | null>(null); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api.detail(id).then(value => { if (active) setDetail(value); }).catch(error => { if (active) setError(messageOf(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);
  return <Page><Heading>Hồ sơ sự cố</Heading>{loading && <Loading />}{!!error && <ErrorNotice message={error} />}
    {detail && <><Card><Body>{typeLabels[detail.type]} · {statusLabels[detail.status]}</Body><Body>{detail.description}</Body>
      <Body>Mức độ: {severityLabels[detail.severity]}</Body><Body>{detail.assignedTeam}</Body><Body>{detail.reportCount} minh chứng</Body></Card>
      {detail.reports.map((report, index) => <Card key={report.id}><Photo uri={report.imageUrl} label={`Minh chứng ${index + 1}`} /><Body>{dateLabel(report.createdAt)}</Body></Card>)}
      <Card><Body>Lịch sử hồ sơ</Body>{detail.history.map((event, index) => <Body key={index}>{dateLabel(event.at)} — {event.event === 'created' ? 'Tạo hồ sơ' : 'Thêm minh chứng bằng hợp nhất'}</Body>)}</Card>
    </>}
    <Button title="Tải lại hồ sơ" secondary disabled={loading} onPress={() => { setLoading(true); setError(''); setRetry(value => value + 1); }} /><Button title="Về trang chủ" onPress={onHome} />
  </Page>;
}
