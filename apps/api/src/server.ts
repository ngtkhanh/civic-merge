import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackendConfigurationError, createConfiguredBackend } from './bootstrap/configured.js';
import { DomainError } from '@civicmerge/contracts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
config({ path: path.join(root, 'apps/api/.env'), quiet: true });
try {
  const { app, pool, config: selected, capabilities } = await createConfiguredBackend(process.env, { root });
  const server = app.listen(selected.port, selected.host, () => {
    console.log(`CivicMerge API | mode=${selected.mockMode ? 'mock' : 'real'} | ${JSON.stringify(capabilities)}`);
  });
  server.on('error', () => {
    console.error('API listener failed. Check HOST/PORT and whether another backend is running.');
    void (pool?.end() ?? Promise.resolve()).finally(() => { process.exitCode = 1; });
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => {
    void (pool?.end() ?? Promise.resolve()).then(() => process.exit(0));
  }));
} catch (error) {
  // Unknown factory/driver errors may contain secrets: never print them.
  console.error(error instanceof BackendConfigurationError || (error instanceof DomainError && error.code === 'STORAGE_CONFIG_ERROR') ? error.message
    : 'Backend startup failed. Check private database/Storage/provider configuration; no fallback was started.');
  process.exitCode = 1;
}
