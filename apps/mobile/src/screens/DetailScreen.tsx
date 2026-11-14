import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IncidentDetail } from '@civicmerge/contracts';
import { api } from '../services/api';
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
  messageOf,
  Page,
  Photo,
  SectionTitle,
  SeverityBadge,
  StatusBadge,
  styles,
  TypeBadge,
} from '../ui';

export function DetailScreen({ id, onHome }: { id: string; onHome(): void }) {
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .detail(id)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((error) => {
        if (active) setError(messageOf(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  return (
    <Page>
      <View style={s.headerBox}>
        <Heading>Hồ sơ sự cố thống nhất</Heading>
        <Text style={styles.caption}>Mã hồ sơ: #{id.slice(0, 8).toUpperCase()}</Text>
      </View>

      {loading && <Loading label="Đang tải thông tin hồ sơ…" />}
      {!!error && <ErrorNotice message={error} />}

      {detail && (
        <>
          {detail.reportCount > 1 && (
            <Card style={s.mergedBanner}>
              <Badge tone="success" label="✓ ĐÃ HỢP NHẤT PHẢN ÁNH" />
              <Body>
                Hồ sơ này đã gom {detail.reportCount} lượt báo cáo từ người dân vào một đầu mối xử lý duy nhất.
              </Body>
            </Card>
          )}

          <Card>
            <View style={styles.rowBetween}>
              <View style={styles.rowWrap}>
                <TypeBadge type={detail.type} />
                <SeverityBadge severity={detail.severity} />
              </View>
              <StatusBadge status={detail.status} />
            </View>

            <Body>{detail.description}</Body>

            <View style={s.infoGrid}>
              <View style={s.infoItem}>
                <Text style={styles.caption}>Đơn vị tiếp nhận xử lý</Text>
                <Text style={s.infoValue}>🏛️ {detail.assignedTeam}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={styles.caption}>Tổng số minh chứng</Text>
                <Text style={s.infoValue}>📸 {detail.reportCount} hình ảnh</Text>
              </View>
            </View>

            {detail.location && (
              <Text style={styles.caption}>
                📍 Tọa độ GPS: {detail.location.latitude.toFixed(6)},{' '}
                {detail.location.longitude.toFixed(6)}
              </Text>
            )}

            {detail.features.length > 0 && (
              <View style={styles.rowWrap}>
                {detail.features.map((feature) => (
                  <Badge key={feature} tone="neutral" label={feature} />
                ))}
              </View>
            )}
          </Card>

          <View style={styles.rowBetween}>
            <SectionTitle>Hình ảnh minh chứng ({detail.reports.length})</SectionTitle>
            <Badge tone="primary" label={`${detail.reports.length} lượt gửi`} />
          </View>

          {detail.reports.map((report, index) => (
            <Card key={report.id}>
              <View style={styles.rowBetween}>
                <Badge
                  tone={index === 0 ? 'primary' : 'success'}
                  label={
                    index === 0
                      ? 'Minh chứng #1 (Báo cáo gốc)'
                      : `Minh chứng #${index + 1} (Đã hợp nhất)`
                  }
                />
                <Text style={styles.caption}>{dateLabel(report.createdAt)}</Text>
              </View>
              <Photo
                uri={report.imageUrl}
                label={`Minh chứng ${index + 1} · ${report.analysis.description}`}
              />
            </Card>
          ))}

          <Card>
            <SectionTitle>Lịch sử xử lý hồ sơ</SectionTitle>
            <View style={s.timeline}>
              {detail.history.map((event, index) => {
                const isCreated = event.event === 'created';
                return (
                  <View key={index} style={s.timelineItem}>
                    <View
                      style={[
                        s.timelineDot,
                        { backgroundColor: isCreated ? colors.primary : colors.success },
                      ]}
                    />
                    <View style={s.timelineContent}>
                      <Text style={s.timelineTitle}>
                        {isCreated
                          ? 'Khởi tạo hồ sơ sự cố mới'
                          : 'Hợp nhất thêm minh chứng từ cộng đồng'}
                      </Text>
                      <Text style={styles.caption}>{dateLabel(event.at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      )}

      <View style={styles.gridTwo}>
        <View style={styles.flexOne}>
          <Button
            title="🔄 Tải lại hồ sơ"
            secondary
            disabled={loading}
            onPress={() => {
              setLoading(true);
              setError('');
              setRetry((value) => value + 1);
            }}
          />
        </View>
        <View style={styles.flexOne}>
          <Button title="← Về trang chủ" onPress={onHome} />
        </View>
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  headerBox: {
    gap: 2,
  },
  mergedBanner: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder,
    borderWidth: 1.5,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  infoItem: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  timeline: {
    gap: 12,
    paddingTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 5,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
});
