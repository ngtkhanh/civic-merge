import { router } from 'expo-router';
import { ResultScreen } from '../screens/ResultScreen';
import { useFlow } from '../state/flow';
import { Body, Button, Page } from '../ui';
export default function Result() {
  const { result, setBusy } = useFlow();
  if (!result) return <Page><Body>Không có báo cáo đang chờ. Hãy gửi ảnh mới.</Body><Button title="Báo cáo sự cố" onPress={() => router.replace('/report')} /></Page>;
  return <ResultScreen result={result} onBusy={setBusy} onConfirmed={id => router.replace({ pathname: '/detail', params: { id } })} />;
}
