import { useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { IncidentType } from '@civicmerge/contracts';
export const colors = {
  background: '#F8FAFC', surface: '#FFFFFF', ink: '#0F172A', muted: '#475569',
  border: '#CBD5E1', primary: '#0369A1', soft: '#E0F2FE', error: '#B91C1C',
};
export const typeLabels: Record<IncidentType, string> = { pothole: 'Ổ gà', trash: 'Rác thải', flood: 'Ngập nước' };
export const severityLabels = { low: 'Thấp', medium: 'Trung bình', high: 'Cao' };
export const statusLabels = { open: 'Mới tiếp nhận', in_progress: 'Đang xử lý', resolved: 'Đã xử lý' };
export const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Đã có lỗi. Hãy thử lại.';
export const dateLabel = (date: string) => new Date(date).toLocaleString('vi-VN');
export function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress(): void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
    <Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{title}</Text>
  </Pressable>;
}
export function Page({ children }: PropsWithChildren) { return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>; }
export function Card({ children }: PropsWithChildren) { return <View style={styles.card}>{children}</View>; }
export function Heading({ children }: PropsWithChildren) { return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>; }
export function Body({ children }: PropsWithChildren) { return <Text style={styles.body}>{children}</Text>; }
export function ErrorNotice({ message }: { message: string }) { return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>; }
export function Loading() { return <ActivityIndicator accessibilityLabel="Đang tải" size="large" color={colors.primary} />; }
export function Photo({ uri, label }: { uri: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return <View><Image accessibilityLabel={label} source={{ uri }} resizeMode="cover" style={styles.photo} onLoad={() => setFailed(false)} onError={() => setFailed(true)} />
    <Text style={styles.caption}>{label}</Text>{failed && <ErrorNotice message="Không tải được ảnh. Kiểm tra URL ảnh và kết nối API." />}</View>;
}
export const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { padding: 16, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { fontSize: 26, fontWeight: '700', color: colors.ink }, body: { fontSize: 16, lineHeight: 25, color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 6 }, error: { fontSize: 16, lineHeight: 24, color: colors.error },
  button: { minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center' },
  secondary: { backgroundColor: colors.soft, borderColor: colors.primary, borderWidth: 1 },
  buttonText: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.surface },
  photo: { width: '100%', aspectRatio: 1.6, borderRadius: 10, backgroundColor: colors.soft },
});
