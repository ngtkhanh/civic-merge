import { createMockVision } from '@civicmerge/ai-vision';
import { mockMatcher, ruleRouter } from '@civicmerge/matching';
import type { MockScenario } from '@civicmerge/contracts';
import { createApp } from '../app.js';
import { createMemoryRepository } from '../repositories/memory.js';
import { createLocalStorage } from '../storage/local.js';

export function createMockApp(options: { uploadDir: string; publicBaseUrl: string; mockMode?: boolean }) {
  let scenario: MockScenario = 'pothole';
  const mockControl = { getScenario: () => scenario, setScenario: (value: MockScenario) => { scenario = value; } };
  const repository = createMemoryRepository();
  return {
    repository,
    app: createApp({
      uploadDir: options.uploadDir, mockMode: options.mockMode ?? true,
      repository, storage: createLocalStorage(options.uploadDir, options.publicBaseUrl),
      vision: createMockVision(mockControl.getScenario), matcher: mockMatcher, router: ruleRouter, mockControl,
    }),
  };
}
