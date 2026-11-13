import type { Pool } from 'pg';
import { createMockVision } from '@civicmerge/ai-vision';
import { mockMatcher, ruleRouter } from '@civicmerge/matching';
import type { MockScenario } from '@civicmerge/contracts';
import { createApp } from '../app.js';
import { createPostgresRepository } from '../repositories/postgres.js';
import { createLocalStorage } from '../storage/local.js';

// Persistent database + MOCK AI/matching + local images. Not a complete real MVP.
export function createPostgresApp(options: {
  pool: Pool; uploadDir: string; publicBaseUrl: string; scenario?: MockScenario;
}) {
  const repository = createPostgresRepository(options.pool);
  return {
    repository,
    app: createApp({
      repository, uploadDir: options.uploadDir, mockMode: true,
      storage: createLocalStorage(options.uploadDir, options.publicBaseUrl),
      vision: createMockVision(() => options.scenario ?? 'pothole'),
      matcher: mockMatcher, router: ruleRouter,
      // Intentionally no mockControl: no scenario/reset API with persisted data.
    }),
  };
}
