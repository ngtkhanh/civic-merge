import { useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { AIAnalysis, IncidentType } from '@civicmerge/contracts';

export type Severity = AIAnalysis['severity'];

export const colors = {
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  ink: '#0F172A',
  muted: '#475569',
  subtle: '#64748B',
  border: '#E2E8F0',
  primary: '#0284C7',
  primaryDark: '#0369A1',
  soft: '#E0F2FE',
  softBorder: '#BAE6FD',
  success: '#15803D',
  successSoft: '#DCFCE7',
  successBorder: '#86EFAC',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  warningBorder: '#FCD34D',
  error: '#B91C1C',
  errorSoft: '#FEE2E2',
  errorBorder: '#FCA5A5',
};

export const typeLabels: Record<IncidentType, string> = {
  pothole: 'Ổ gà',
  trash: 'Rác thải',
  flood: 'Ngập nước',
};

export const typeIcons: Record<IncidentType, string> = {
  pothole: '⚠️',
  trash: '♻️',
  flood: '🌊',
};

export const severityLabels: Record<Severity, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};

export const statusLabels = {
  open: 'Mới tiếp nhận',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
};

export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Đã có lỗi. Hãy thử lại.';

export const dateLabel = (date: string) => new Date(date).toLocaleString('vi-VN');

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}) {
  const palette = {
    neutral: { bg: colors.surfaceMuted, border: colors.border, text: colors.muted },
    primary: { bg: colors.soft, border: colors.softBorder, text: colors.primaryDark },
    success: { bg: colors.successSoft, border: colors.successBorder, text: colors.success },
    warning: { bg: colors.warningSoft, border: colors.warningBorder, text: colors.warning },
    danger: { bg: colors.errorSoft, border: colors.errorBorder, text: colors.error },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export function TypeBadge({ type }: { type: IncidentType }) {
  const tone = type === 'pothole' ? 'warning' : type === 'trash' ? 'success' : 'primary';
  return <Badge tone={tone} label={`${typeIcons[type]} ${typeLabels[type]}`} />;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone = severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'success';
  return <Badge tone={tone} label={`Mức độ: ${severityLabels[severity]}`} />;
}

export function StatusBadge({ status }: { status: keyof typeof statusLabels }) {
  const tone = status === 'resolved' ? 'success' : status === 'in_progress' ? 'warning' : 'primary';
  return <Badge tone={tone} label={statusLabels[status]} />;
}

export function Button({
  title,
  onPress,
  secondary = false,
  tone = 'primary',
  disabled = false,
  compact = false,
}: {
  title: string;
  onPress(): void;
  secondary?: boolean;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  compact?: boolean;
}) {
  const solidBg =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.error
          : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        secondary ? styles.secondary : { backgroundColor: solidBg },
        { opacity: disabled ? 0.45 : pressed ? 0.78 : 1 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          compact && styles.buttonTextCompact,
          secondary && { color: colors.primaryDark },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Page({ children }: PropsWithChildren) {
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
        ⚠️ {message}
      </Text>
    </View>
  );
}

export function Loading({ label = 'Đang xử lý dữ liệu…' }: { label?: string }) {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator accessibilityLabel="Đang tải" size="large" color={colors.primary} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

export function Photo({ uri, label }: { uri: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.photoContainer}>
      <Image
        accessibilityLabel={label}
        source={{ uri }}
        resizeMode="cover"
        style={styles.photo}
        onLoad={() => setFailed(false)}
        onError={() => setFailed(true)}
      />
      <Text style={styles.caption}>{label}</Text>
      {failed && (
        <ErrorNotice message="Không tải được ảnh. Kiểm tra URL ảnh và kết nối API." />
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  page: {
    padding: 16,
    gap: 14,
    paddingBottom: 44,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  caption: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.error,
  },
  loadingBox: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonCompact: {
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  secondary: {
    backgroundColor: colors.soft,
    borderColor: colors.softBorder,
    borderWidth: 1,
  },
  buttonText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  buttonTextCompact: {
    fontSize: 13,
    fontWeight: '600',
  },
  photoContainer: {
    gap: 6,
  },
  photo: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  gridTwo: {
    flexDirection: 'row',
    gap: 10,
  },
  flexOne: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
});
