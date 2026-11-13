import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import type { AnalyzeResponse } from '@civicmerge/contracts';
interface FlowState {
  result: AnalyzeResponse | null; setResult(value: AnalyzeResponse | null): void;
  busy: boolean; setBusy(value: boolean): void;
}
const FlowContext = createContext<FlowState | null>(null);
export function FlowProvider({ children }: PropsWithChildren) {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  return <FlowContext.Provider value={{ result, setResult, busy, setBusy }}>{children}</FlowContext.Provider>;
}
export function useFlow() {
  const value = useContext(FlowContext);
  if (!value) throw new Error('FlowProvider is missing');
  return value;
}
