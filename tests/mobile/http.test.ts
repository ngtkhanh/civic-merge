import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiRequestError, isDefinitiveConfirmRejection } from '../../apps/mobile/src/services/http-error.js';
import { normalizeBackendUrl } from '../../apps/mobile/src/services/backend-url.js';
import { describeProviders } from '../../apps/mobile/src/services/provider-state.js';

test('provider labels and reset controls follow health capabilities, including mixed modes and unknown health', () => {
  assert.equal(describeProviders(undefined, true).controlsAllowed, false);
  assert.match(describeProviders(undefined, true).label, /Chưa kiểm tra/);
  const mixed = describeProviders({ persistence: 'postgres', storage: 'supabase', vision: 'mock', matching: 'real' }, true);
  assert.equal(mixed.visionMock, true); assert.equal(mixed.matchingMock, false);
  assert.equal(mixed.controlsAllowed, false); assert.match(mixed.label, /giả lập.*GPS\/features/);
  const mocks = { persistence: 'memory', storage: 'local', vision: 'mock', matching: 'mock' } as const;
  assert.equal(describeProviders(mocks, false).controlsAllowed, false);
  assert.equal(describeProviders(mocks, true).controlsAllowed, true);
  const real = describeProviders({ persistence: 'postgres', storage: 'supabase', vision: 'openai', matching: 'real' }, true);
  assert.equal(real.visionMock, false); assert.equal(real.matchingMock, false); assert.equal(real.controlsAllowed, false);
  assert.doesNotMatch(real.label, /giả lập/);
});

test('definitively rejected merge allows correction; ambiguous or confirmed outcomes keep the original choice', () => {
  for (const [code, status] of [['VALIDATION_ERROR', 400], ['REPORT_NOT_FOUND', 404], ['INCIDENT_NOT_FOUND', 404], ['INCIDENT_TYPE_MISMATCH', 409], ['INCIDENT_RESOLVED', 409]] as const) {
    assert.equal(isDefinitiveConfirmRejection(new ApiRequestError('fixture', code, status)), true);
  }
  for (const [code, status] of [['REPORT_ALREADY_CONFIRMED', 409], ['DATABASE_UNAVAILABLE', 503], ['INTERNAL_ERROR', 500],
    ['INVALID_RESPONSE', 404], ['REQUEST_TIMEOUT', undefined], ['NETWORK_ERROR', undefined], ['INCIDENT_NOT_FOUND', 500], ['INCIDENT_RESOLVED', 500]] as const) {
    assert.equal(isDefinitiveConfirmRejection(new ApiRequestError('fixture', code, status)), false);
  }
  assert.equal(isDefinitiveConfirmRejection(new Error('unknown transport error')), false);
});

test('backend settings accept an API origin and reject accidental health URLs, credentials or query strings', () => {
  assert.equal(normalizeBackendUrl(' http://192.168.1.20:3011/ '), 'http://192.168.1.20:3011');
  assert.equal(normalizeBackendUrl('https://api.example.test'), 'https://api.example.test');
  for (const url of ['http://192.168.1.20:3011/health', 'http://user:password@host:3011', 'http://host?token=x', 'file:///tmp', 'host:3011']) {
    assert.throws(() => normalizeBackendUrl(url));
  }
});
