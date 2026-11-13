import { router, useLocalSearchParams } from 'expo-router';
import { DetailScreen } from '../screens/DetailScreen';
import { Body, Button, Page } from '../ui';
export default function Detail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id || typeof id !== 'string') return <Page><Body>Thiếu mã hồ sơ.</Body><Button title="Trang chủ" onPress={() => router.dismissTo('/')} /></Page>;
  return <DetailScreen key={id} id={id} onHome={() => router.dismissTo('/')} />;
}
