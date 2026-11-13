import path from 'node:path';
import type { Pool } from 'pg';
import { createMockVision } from '@civicmerge/ai-vision';
import { mockMatcher, ruleRouter } from '@civicmerge/matching';
import { DomainError, MockScenarioSchema, type DuplicateMatcher, type VisionAnalyzer, type BackendCapabilities } from '@civicmerge/contracts';
import { createApp } from '../app.js';
import { createDatabasePool } from '../database/pool.js';
import { createMemoryRepository } from '../repositories/memory.js';
import { createPostgresRepository } from '../repositories/postgres.js';
import { createLocalStorage } from '../storage/local.js';
import { createSupabaseStorage } from '../storage/supabase.js';
import { BackendConfigurationError } from '../configuration-error.js';
export { BackendConfigurationError } from '../configuration-error.js';

export interface AdapterFactories {
  // Member 2 registers their factory here; never load a module path from .env.
  openai?: (config: { apiKey: string; model: string; timeoutMs: number }) => VisionAnalyzer;
  // Member 4 registers the real matcher through the same shared interface.
  realMatcher?: () => DuplicateMatcher;
}
function choice<T extends string>(env: NodeJS.ProcessEnv, name: string, allowed: readonly T[], fallback: T): T {
  const value = env[name] ?? fallback;
  if (!allowed.includes(value as T)) throw new BackendConfigurationError(`${name} must be ${allowed.join(' or ')}.`);
  return value as T;
}
function positiveInteger(value: string | undefined, fallback: number, name: string, max: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new BackendConfigurationError(`Invalid ${name}.`);
  return number;
}
export function readBackendConfig(env: NodeJS.ProcessEnv, root: string) {
  const persistence = choice(env, 'PERSISTENCE_MODE', ['memory', 'postgres'], 'memory');
  const storage = choice(env, 'STORAGE_PROVIDER', ['local', 'supabase'], 'local');
  const vision = choice(env, 'AI_PROVIDER', ['mock', 'openai'], 'mock');
  const matching = choice(env, 'MATCHING_PROVIDER', ['mock', 'real'], 'mock');
  const port = positiveInteger(env.PORT, 3000, 'PORT', 65535);
  const storageTimeoutMs = positiveInteger(env.STORAGE_TIMEOUT_MS, 10000, 'STORAGE_TIMEOUT_MS', 30000);
  const aiTimeoutMs = positiveInteger(env.AI_TIMEOUT_MS, 20000, 'AI_TIMEOUT_MS', 25000);
  const matchingTimeoutMs = positiveInteger(env.MATCHING_TIMEOUT_MS, 3000, 'MATCHING_TIMEOUT_MS', 10000);
  let base: URL;
  try { base = new URL(env.PUBLIC_BASE_URL ?? ''); } catch { throw new BackendConfigurationError('Set PUBLIC_BASE_URL to the API HTTP(S) origin reachable by the phone.'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new BackendConfigurationError('PUBLIC_BASE_URL must be an HTTP(S) origin without credentials or paths.');
  }
  if (env.MOCK_MODE !== undefined && !['true', 'false'].includes(env.MOCK_MODE)) throw new BackendConfigurationError('MOCK_MODE must be true or false.');
  const mockMode = vision === 'mock' || matching === 'mock' || persistence === 'memory' || storage === 'local';
  if (env.MOCK_MODE === 'false' && mockMode) throw new BackendConfigurationError('MOCK_MODE=false requires real AI/matching, postgres and supabase. No mock fallback is allowed.');
  const parsedScenario = MockScenarioSchema.safeParse(env.MOCK_SCENARIO ?? 'pothole');
  if (!parsedScenario.success) throw new BackendConfigurationError('Invalid MOCK_SCENARIO.');
  if (vision === 'openai' && (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_MODEL?.trim())) {
    throw new BackendConfigurationError('Set OPENAI_API_KEY and OPENAI_MODEL privately for AI_PROVIDER=openai.');
  }
  return { persistence, storage, vision, matching, port, storageTimeoutMs, aiTimeoutMs, matchingTimeoutMs, mockMode,
    scenario: parsedScenario.data, publicBaseUrl: base.origin, host: env.HOST ?? '0.0.0.0',
    uploadDir: path.resolve(env.UPLOAD_DIR || path.join(root, '.runtime/uploads')) };
}

function boundedVision(vision: VisionAnalyzer, timeoutMs: number): VisionAnalyzer {
  return { async analyzeIncidentImage(image) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([vision.analyzeIncidentImage(image), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new DomainError('AI_TIMEOUT', 'Phân tích ảnh quá thời gian. Hãy thử lại.', 504)), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  } };
}
function boundedMatcher(matcher: DuplicateMatcher, timeoutMs: number): DuplicateMatcher {
  return { async findCandidates(input) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([matcher.findCandidates(input), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new DomainError('MATCHING_TIMEOUT', 'Tìm hồ sơ trùng quá thời gian. Hãy thử lại.', 504)), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  } };
}

export async function createConfiguredBackend(env: NodeJS.ProcessEnv, options: {
  root: string; pool?: Pool; factories?: AdapterFactories; fetch?: typeof fetch;
}) {
  const config = readBackendConfig(env, options.root);
  let scenario = config.scenario;
  const mockControl = { getScenario: () => scenario, setScenario: (value: typeof scenario) => { scenario = value; } };
  let vision: VisionAnalyzer;
  if (config.vision === 'openai') {
    if (!options.factories?.openai) throw new BackendConfigurationError('AI_PROVIDER=openai selected, but Member 2 OpenAI factory is not registered.');
    vision = options.factories.openai({ apiKey: env.OPENAI_API_KEY!, model: env.OPENAI_MODEL!, timeoutMs: config.aiTimeoutMs });
  } else vision = createMockVision(mockControl.getScenario);
  let matcher: DuplicateMatcher;
  if (config.matching === 'real') {
    if (!options.factories?.realMatcher) throw new BackendConfigurationError('MATCHING_PROVIDER=real selected, but Member 4 matcher factory is not registered.');
    matcher = options.factories.realMatcher();
  } else matcher = mockMatcher;
  const imageDelivery = config.storage === 'supabase' ? createSupabaseStorage({
    url: env.SUPABASE_URL ?? '', secretKey: env.SUPABASE_SECRET_KEY ?? '', bucket: env.SUPABASE_STORAGE_BUCKET ?? '',
    timeoutMs: config.storageTimeoutMs, prefix: env.SUPABASE_STORAGE_PREFIX, fetch: options.fetch,
  }) : undefined;
  const storage = imageDelivery ?? createLocalStorage(config.uploadDir, config.publicBaseUrl);
  // Remote bucket access is read-only at startup. Never create/update/reset it.
  await imageDelivery?.checkReady();
  const pool = config.persistence === 'postgres' ? options.pool ?? createDatabasePool(env) : undefined;
  try {
    if (pool) await pool.query('SELECT 1 FROM civicmerge.confirmations LIMIT 0');
    const repository = pool ? createPostgresRepository(pool) : createMemoryRepository();
    const capabilities: BackendCapabilities = { persistence: config.persistence, storage: config.storage, vision: config.vision, matching: config.matching };
    const controlsAllowed = config.persistence === 'memory' && config.storage === 'local' && config.vision === 'mock' && config.matching === 'mock';
    return { config, pool, repository, capabilities, app: createApp({
      repository, storage, imageDelivery, vision: boundedVision(vision, config.aiTimeoutMs), matcher: boundedMatcher(matcher, config.matchingTimeoutMs), router: ruleRouter,
      uploadDir: config.uploadDir, publicBaseUrl: config.publicBaseUrl, mockMode: config.mockMode, capabilities,
      ...(controlsAllowed ? { mockControl } : {}),
    }) };
  } catch {
    if (pool && !options.pool) await pool.end();
    throw new BackendConfigurationError('Database unavailable or migration missing. Check DATABASE_URL/TLS privately and run db:migrate.');
  }
}
