import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AnalyzeResponse, ConfirmRequest, IncidentDetail } from '@civicmerge/contracts';
import { api, providerState } from '../services/api';
import { ApiRequestError, isDefinitiveConfirmRejection } from '../services/http-error';
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
  SeverityBadge,
  styles,
  TypeBadge,
} from '../ui';

export function ResultScreen({
  result,
  onConfirmed,
  onBusy,
}: {
  result: AnalyzeResponse;
  onConfirmed(id: string): void;
  onBusy(busy: boolean): void;
}) {
  const [details, setDetails] = useState<Record<string, IncidentDetail>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [rejectedIncidentIds, setRejectedIncidentIds] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const [lastRequest, setLastRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled(result.candidates.map((candidate) => api.detail(candidate.incidentId)))
      .then((values) => {
        if (!active) return;
        const available = values.flatMap(value => value.status === 'fulfilled' ? [value.value] : []);
        setDetails(Object.fromEntries(available.map(value => [value.id, value])));
        if (values.some(value => value.status === 'rejected')) setError('Một số hồ sơ không tải được minh chứng. Bạn có thể tải lại hoặc chọn hồ sơ đã tải được.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [result, retry]);

  async function confirm(request: ConfirmRequest) {
    if (lock.current) return;
    lock.current = true;
    setLastRequest(request);
    setBusy(true);
    onBusy(true);
    setError('');
    setErrorCode(null);
    try {
      onConfirmed((await api.confirm(request)).incidentId);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrorCode(error.code ?? null);
        if (isDefinitiveConfirmRejection(error)) {
          setLastRequest(null);
          if (request.action === 'merge') setRejectedIncidentIds(previous => ({ ...previous, [request.targetIncidentId]: error.code! }));
          setError(error.code === 'INCIDENT_RESOLVED'
            ? `${error.message} Báo cáo vẫn đang chờ xác nhận; bạn có thể tạo mới hoặc chọn hồ sơ khác.` : error.message);
          return;
        }
        if (error.code === 'REPORT_ALREADY_CONFIRMED') {
          setError(`${error.message} Báo cáo đã được xác nhận, không thể đổi lựa chọn.`);
          return;
        }
      }
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  const isAlreadyConfirmed = errorCode === 'REPORT_ALREADY_CONFIRMED';

  return (
    <Page>
      <View style={s.headerBox}>
        <Heading>Kết quả phân tích AI</Heading>
        <Body>
          Kiểm tra thông tin nhận diện và quyết định hợp nhất vào hồ sơ sẵn có hoặc tạo mới.
        </Body>
      </View>

      {(
        <Card style={s.warningCard}>
          <Badge tone="neutral" label="CẤU HÌNH PHÂN TÍCH" />
          <Body>{providerState().label}</Body>
        </Card>
      )}

      <Card>
        <View style={styles.rowBetween}>
          <SectionTitle>Nhận diện từ hình ảnh</SectionTitle>
          {providerState().visionMock && <Badge tone="warning" label="AI Giả lập" />}
        </View>

        <View style={styles.rowWrap}>
          <TypeBadge type={result.analysis.type} />
          <SeverityBadge severity={result.analysis.severity} />
        </View>

        <Body>{result.analysis.description}</Body>

        {result.analysis.features.length > 0 && (
          <View style={s.featureSection}>
            <Text style={styles.caption}>Đặc điểm trích xuất:</Text>
            <View style={styles.rowWrap}>
              {result.analysis.features.map((feature) => (
                <Badge key={feature} tone="neutral" label={feature} />
              ))}
            </View>
          </View>
        )}
      </Card>

      {result.warnings.map((warning) => (
        <Card key={warning.code} style={s.warningCard}>
          <Badge tone="warning" label="LƯU Ý VỊ TRÍ GPS" />
          <Body>{warning.message}</Body>
        </Card>
      ))}

      {loading && <Loading label="Đang tải minh chứng của các hồ sơ nghi trùng…" />}

      {!!error && (
        <>
          <ErrorNotice message={error} />
          {!lastRequest && !isAlreadyConfirmed && errorCode === null && (
            <Button
              title="🔄 Tải lại minh chứng"
              secondary
              onPress={() => {
                setLoading(true);
                setError('');
                setRetry((value) => value + 1);
              }}
              disabled={busy}
            />
          )}
        </>
      )}

      {result.candidates.length === 0 ? (
        <Card style={s.noMatchCard}>
          <Badge tone="success" label="KHÔNG PHÁT HIỆN TRÙNG LẶP" />
          <SectionTitle>Sự cố mới tại khu vực này</SectionTitle>
          <Body>
            Hệ thống chưa ghi nhận hồ sơ cùng loại nào ở gần vị trí của bạn. Hãy xác nhận tạo hồ sơ sự cố mới bên dưới.
          </Body>
        </Card>
      ) : (
        <View style={s.candidateList}>
          <View style={styles.rowBetween}>
            <SectionTitle>⚡ Đề xuất hợp nhất ({result.candidates.length})</SectionTitle>
            <Badge tone="warning" label="One Issue, One Record" />
          </View>

          {result.candidates.map((candidate) => {
            const detail = details[candidate.incidentId];
            const rejectionCode = rejectedIncidentIds[candidate.incidentId];
            const isResolved = rejectionCode === 'INCIDENT_RESOLVED' || detail?.status === 'resolved';
            const isCandidateDisabled = busy || !detail || lastRequest !== null || Boolean(rejectionCode) || isResolved || isAlreadyConfirmed;
            return (
              <Card key={candidate.incidentId} style={s.candidateCard}>
                <View style={styles.rowBetween}>
                  <Badge tone={isResolved ? 'danger' : 'warning'} label={isResolved ? 'HỒ SƠ ĐÃ XỬ LÝ' : 'HỒ SƠ CÓ THỂ TRÙNG'} />
                  <View style={styles.rowWrap}>
                    <Badge tone="primary" label={`📍 Cách ${candidate.distanceMeters} m${providerState().matchingMock ? ' (giả lập)' : ''}`} />
                    <Badge
                      tone="success"
                      label={`Điểm xếp hạng: ${candidate.score.toFixed(2)}`}
                    />
                  </View>
                </View>

                <View style={s.reasonBox}>
                  <Text style={s.reasonHeading}>Lý do hệ thống đề xuất hợp nhất:</Text>
                  {candidate.reasons.map((reason, index) => (
                    <Text key={index} style={s.reasonItem}>
                      • {reason}
                    </Text>
                  ))}
                </View>

                {detail && (
                  <View style={s.existingBox}>
                    <View style={styles.rowBetween}>
                      <Text style={s.reasonHeading}>
                        Hồ sơ hiện có ({detail.reportCount} minh chứng):
                      </Text>
                      <Text style={styles.caption}>🏛️ {detail.assignedTeam}</Text>
                    </View>
                    <Body>{detail.description}</Body>
                    {detail.reports.map((report, index) => (
                      <Photo
                        key={report.id}
                        uri={report.imageUrl}
                        label={`Minh chứng đã lưu #${index + 1} — Đối chiếu với ảnh của bạn`}
                      />
                    ))}
                  </View>
                )}

                <Button
                  title={isResolved ? 'Hồ sơ đã xử lý (Chọn hồ sơ khác hoặc Tạo mới)' : '🔗 Xác nhận hợp nhất vào hồ sơ này'}
                  tone="success"
                  disabled={isCandidateDisabled}
                  onPress={() =>
                    void confirm({
                      reportId: result.reportId,
                      action: 'merge',
                      targetIncidentId: candidate.incidentId,
                    })
                  }
                />
              </Card>
            );
          })}
        </View>
      )}

      <Card style={s.createBox}>
        <Text style={styles.caption}>
          {result.candidates.length > 0
            ? 'Nếu đây là một sự cố khác hoặc hồ sơ gợi ý đã xử lý xong:'
            : 'Xác nhận khởi tạo hồ sơ mới và định tuyến tới tổ xử lý:'}
        </Text>
        <Button
          title="➕ Tạo hồ sơ sự cố mới"
          disabled={busy || lastRequest !== null || isAlreadyConfirmed}
          onPress={() => void confirm({ reportId: result.reportId, action: 'create' })}
          secondary={result.candidates.length > 0 && Object.keys(rejectedIncidentIds).length === 0}
        />
      </Card>

      {!!error && lastRequest && !isAlreadyConfirmed && (
        <Button
          title="🔄 Thử lại cùng lựa chọn xác nhận"
          disabled={busy}
          onPress={() => void confirm(lastRequest)}
        />
      )}

      {busy && <Loading label="Đang lưu hồ sơ và cập nhật minh chứng…" />}
    </Page>
  );
}

const s = StyleSheet.create({
  headerBox: {
    gap: 4,
  },
  featureSection: {
    gap: 6,
    paddingTop: 4,
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
  },
  noMatchCard: {
    backgroundColor: colors.surface,
    borderColor: colors.successBorder,
    borderWidth: 1.5,
  },
  candidateList: {
    gap: 12,
  },
  candidateCard: {
    borderColor: colors.warningBorder,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  reasonBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    gap: 4,
  },
  reasonHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  reasonItem: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  existingBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  createBox: {
    backgroundColor: colors.surfaceMuted,
  },
});
