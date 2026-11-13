import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FlowProvider, useFlow } from '../state/flow';
import { Button, colors } from '../ui';

function Navigation() {
  const { busy } = useFlow();
  const pathname = usePathname();
  useEffect(() => {
    if (!busy) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [busy]);
  return <SafeAreaView style={s.root}><StatusBar style="dark" />
    <View style={s.header}><Text style={s.brand}>CivicMerge</Text>
      {pathname !== '/' && <Button title="Trang chủ" onPress={() => router.dismissTo('/')} secondary disabled={busy} />}
    </View>
    <Stack screenOptions={{ headerShown: false, gestureEnabled: !busy, contentStyle: { backgroundColor: colors.background } }} />
  </SafeAreaView>;
}
export default function Layout() { return <SafeAreaProvider><FlowProvider><Navigation /></FlowProvider></SafeAreaProvider>; }
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 12, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { color: colors.ink, fontSize: 22, fontWeight: '800' },
});
