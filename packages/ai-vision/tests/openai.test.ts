import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AIAnalysisSchema, DomainError } from '@civicmerge/contracts';
import { createOpenAIVision } from '../src/openai.ts';

const validAnalysis = {
  type: 'pothole',
  severity: 'high',
  description: 'An irregular pothole is visible in an asphalt road.',
  features: ['surface:asphalt', 'shape:irregular'],
};

function responseFor(value: unknown, status = 200): Response {
  const output = typeof value === 'string' ? value : JSON.stringify(value);
  return new Response(JSON.stringify({
    output: [{ type: 'message', content: [{ type: 'output_text', text: output }] }],
  }), { status });
}

function makeVision(fetchImpl: typeof fetch) {
  return createOpenAIVision({ apiKey: 'test-key', model: 'test-vision-model', fetchImpl });
}

test('sends image and normalizes valid features before returning contract analysis', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const responseAnalysis = {
    ...validAnalysis,
    features: ['material:plastic', 'shape:scattered', 'material:plastic'],
  };
  const vision = makeVision(async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return responseFor(responseAnalysis);
  });

  const result = await vision.analyzeIncidentImage({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' });
  assert.deepEqual(result.features, ['material:plastic', 'shape:scattered']);
  assert.equal(result.type, validAnalysis.type);
  AIAnalysisSchema.parse(result);
  assert.equal(requestBody?.model, 'test-vision-model');
  assert.equal(requestBody?.store, false);
  const input = requestBody?.input as Array<{ content: Array<{ type: string; image_url?: string }> }>;
  assert.equal(input[0]?.content[1]?.type, 'input_image');
  assert.match(input[0]?.content[1]?.image_url ?? '', /^data:image\/png;base64,/);
});

test('rejects tags outside the agreed vocabulary or multiple single-value groups', async () => {
  for (const features of [
    ['surface:road'],
    ['water:standing'],
    ['surface:asphalt', 'surface:concrete'],
    ['shape:round', 'shape:irregular'],
  ]) {
    const vision = makeVision(async () => responseFor({ ...validAnalysis, features }));
    await assert.rejects(
      vision.analyzeIncidentImage({ bytes: new Uint8Array([1]), mimeType: 'image/png' }),
      (error: unknown) => error instanceof DomainError && error.code === 'AI_INVALID_RESPONSE',
    );
  }
});

test('allows an empty feature list when no visual tag is reliable', async () => {
  const vision = makeVision(async () => responseFor({ ...validAnalysis, features: [] }));
  const result = await vision.analyzeIncidentImage({ bytes: new Uint8Array([1]), mimeType: 'image/png' });
  assert.deepEqual(result.features, []);
});

test('rejects unsupported or empty images before calling provider', async () => {
  let requested = false;
  const vision = makeVision(async () => {
    requested = true;
    return responseFor(validAnalysis);
  });
  await assert.rejects(
    vision.analyzeIncidentImage({ bytes: new Uint8Array([1]), mimeType: 'image/gif' }),
    (error: unknown) => error instanceof DomainError && error.code === 'INVALID_IMAGE' && error.status === 415,
  );
  await assert.rejects(
    vision.analyzeIncidentImage({ bytes: new Uint8Array(), mimeType: 'image/png' }),
    (error: unknown) => error instanceof DomainError && error.code === 'INVALID_IMAGE',
  );
  assert.equal(requested, false);
});

test('returns 413 for files over the API upload limit', async () => {
  const vision = makeVision(async () => responseFor(validAnalysis));
  await assert.rejects(
    vision.analyzeIncidentImage({ bytes: new Uint8Array(8 * 1024 * 1024 + 1), mimeType: 'image/jpeg' }),
    (error: unknown) => error instanceof DomainError && error.code === 'VALIDATION_ERROR' && error.status === 413,
  );
});

test('maps network and provider failures to AI_UNAVAILABLE', async () => {
  const networkFailure = makeVision(async () => { throw new Error('network details'); });
  await assert.rejects(
    networkFailure.analyzeIncidentImage({ bytes: new Uint8Array([1]), mimeType: 'image/png' }),
    (error: unknown) => error instanceof DomainError && error.code === 'AI_UNAVAILABLE' && error.status === 503,
  );

  const providerFailure = makeVision(async () => new Response('{}', { status: 503 }));
  await assert.rejects(
    providerFailure.analyzeIncidentImage({ bytes: new Uint8Array([1]), mimeType: 'image/png' }),
    (error: unknown) => error instanceof DomainError && error.code === 'AI_UNAVAILABLE',
  );

  const timeoutFailure = createOpenAIVision({
    apiKey: 'test-key',
    model: 'test-vision-model',
    timeoutMs: 1,
    fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }),
  });
  await assert.rejects(
    timeoutFailure.analyzeIncidentImage({ bytes: new Uint8Array([1]), mimeType: 'image/png' }),
    (error: unknown) => error instanceof DomainError && error.code === 'AI_UNAVAILABLE',
  );
});

test('rejects malformed structured output and unsuitable images', async () => {
  const malformed = makeVision(async () => responseFor({ ...validAnalysis, severity: 'severe' }));
  await assert.rejects(
    malformed.analyzeIncidentImage({ bytes: new Uint8Array([1]), mimeType: 'image/png' }),
    (error: unknown) => error instanceof DomainError && error.code === 'AI_INVALID_RESPONSE' && error.status === 502,
  );

  const unsuitable = makeVision(async () => responseFor({
    ...validAnalysis,
    description: 'UNSUITABLE_IMAGE: The photo does not show a supported urban incident.',
  }));
  await assert.rejects(
    unsuitable.analyzeIncidentImage({ bytes: new Uint8Array([1]), mimeType: 'image/png' }),
    (error: unknown) => error instanceof DomainError && error.code === 'INVALID_IMAGE' && error.status === 422,
  );
});

const realSamplePaths = [
  'CIVICMERGE_VISION_POTHOLE_1', 'CIVICMERGE_VISION_POTHOLE_2',
  'CIVICMERGE_VISION_TRASH_1', 'CIVICMERGE_VISION_TRASH_2',
  'CIVICMERGE_VISION_FLOOD_1', 'CIVICMERGE_VISION_FLOOD_2',
] as const;
const realSampleTypes = ['pothole', 'pothole', 'trash', 'trash', 'flood', 'flood'] as const;
const hasRealCredentials = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
const hasAllRealSamples = realSamplePaths.every(name => Boolean(process.env[name]));

test('real Vision: two permitted sample images per incident type', {
  skip: !hasRealCredentials || !hasAllRealSamples
    ? 'Set OPENAI_API_KEY, OPENAI_MODEL and all six CIVICMERGE_VISION_* sample paths to run (makes six billable API requests).'
    : false,
}, async () => {
  const vision = createOpenAIVision({ apiKey: process.env.OPENAI_API_KEY!, model: process.env.OPENAI_MODEL! });
  for (let index = 0; index < realSamplePaths.length; index += 1) {
    const path = process.env[realSamplePaths[index]!]!;
    const bytes = await readFile(path);
    const result = await vision.analyzeIncidentImage({ bytes, mimeType: 'image/jpeg' });
    AIAnalysisSchema.parse(result);
    assert.equal(result.type, realSampleTypes[index], `Unexpected classification for ${path}`);
  }
});
