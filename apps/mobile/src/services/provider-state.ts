import type { BackendCapabilities } from '@civicmerge/contracts';

export function describeProviders(capabilities: BackendCapabilities | undefined, allowMockControls: boolean) {
  const visionMock = capabilities?.vision === 'mock';
  const matchingMock = capabilities?.matching === 'mock';
  return {
    visionMock, matchingMock,
    label: capabilities
      ? `AI: ${visionMock ? 'giả lập' : 'OpenAI'} · Matching: ${matchingMock ? 'giả lập' : 'GPS/features'}`
      : 'Chưa kiểm tra cấu hình AI/matching của máy chủ.',
    controlsAllowed: Boolean(allowMockControls && capabilities?.persistence === 'memory'
      && capabilities.storage === 'local' && visionMock && matchingMock),
  };
}
