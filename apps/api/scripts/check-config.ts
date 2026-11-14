import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { DomainError } from '@civicmerge/contracts';
import { BackendConfigurationError, createConfiguredBackend } from '../src/bootstrap/configured.js';
import { loadMatchingFactories } from '../src/bootstrap/matching-factory.js';
import { loadVisionFactories } from '../src/bootstrap/vision-factory.js';

config({ path: new URL('../.env', import.meta.url), quiet: true });
try {
  const factories = { ...loadVisionFactories(process.env), ...await loadMatchingFactories(process.env) };
  const backend = await createConfiguredBackend(process.env, { root: fileURLToPath(new URL('../../../', import.meta.url)), factories });
  try {
    console.log(JSON.stringify({ status: 'ok', mode: backend.config.mockMode ? 'mock' : 'real', capabilities: backend.capabilities }));
    console.log('Read-only startup checks passed. No API listener started; no application data changed.');
  } finally { await backend.pool?.end(); }
} catch (error) {
  console.error(error instanceof BackendConfigurationError || (error instanceof DomainError && error.code === 'STORAGE_CONFIG_ERROR')
    ? error.message : 'Backend check failed. Verify private database/TLS and provider configuration.');
  process.exitCode = 1;
}
