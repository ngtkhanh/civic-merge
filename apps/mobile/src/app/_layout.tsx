import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FlowProvider, useFlow } from '../state/flow';
import { colors } from '../ui';

function Navigation() {
  const { busy } = useFlow();
  const pathname = usePathname();
  useEffect(() => {
    if (!busy) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [busy]);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View style={s.leftGroup}>
          {pathname !== '/' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Về trang chủ"
              disabled={busy}
              onPress={() => router.dismissTo('/')}
              style={({ pressed }) => [
                s.backButton,
                { opacity: busy ? 0.4 : pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={s.backText}>← Trang chủ</Text>
            </Pressable>
          )}
          <View>
            <Text style={s.brand}>CivicMerge</Text>
            <Text style={s.tagline}>One Issue · One Record</Text>
          </View>
        </View>
      </View>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: !busy,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </SafeAreaView>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <FlowProvider>
        <Navigation />
      </FlowProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.softBorder,
  },
  backText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  brand: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tagline: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
