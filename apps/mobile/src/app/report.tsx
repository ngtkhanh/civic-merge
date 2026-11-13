import { router } from 'expo-router';
import { ReportScreen } from '../screens/ReportScreen';
import { useFlow } from '../state/flow';
export default function Report() {
  const { setResult, setBusy } = useFlow();
  return <ReportScreen onBusy={setBusy} onResult={result => { setResult(result); router.replace('/result'); }} />;
}
