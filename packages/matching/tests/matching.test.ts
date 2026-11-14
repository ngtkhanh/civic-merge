import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchCandidateSchema } from '@civicmerge/contracts';
import { createGpsFeatureMatcher, mockMatcher, ruleRouter } from '../src/index.js';
import { distanceMeters } from '../src/geography.js';
import { compareFeatures } from '../src/scoring.js';
import { analysis, origin, atMeters, incident } from '../../../tests/fixtures/matching.js';

test('Haversine: known distances, symmetry, dateline, poles and antipodes', () => {
  assert.equal(distanceMeters(origin, origin), 0);
  const oneDegree = { latitude: 0, longitude: 1 };
  assert.ok(Math.abs(distanceMeters(origin, oneDegree) - 111_194.9266) < 0.001);
  assert.equal(distanceMeters(origin, oneDegree), distanceMeters(oneDegree, origin));
  assert.ok(distanceMeters({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }) < 223);
  assert.ok(distanceMeters({ latitude: 89.999, longitude: 0 }, { latitude: 89.999, longitude: 180 }) < 223);
  assert.ok(Math.abs(distanceMeters(origin, { latitude: 0, longitude: 180 }) - 20_015_086.796) < 0.001);
  for (const latitude of [NaN, Infinity, 91]) assert.throws(() => distanceMeters(origin, { latitude, longitude: 0 }));
});

test('Jaccard uses sets, handles partial overlap, disjoint and missing evidence', () => {
  assert.equal(compareFeatures(['surface:asphalt', 'surface:asphalt'], ['surface:asphalt']).similarity, 1);
  assert.equal(compareFeatures(analysis.features, ['surface:asphalt', 'shape:round']).similarity, 1 / 3);
  assert.equal(compareFeatures(['shape:round'], ['shape:irregular']).similarity, 0);
  assert.equal(compareFeatures([], []).similarity, 0);
  assert.equal(compareFeatures([], analysis.features).hasFeatures, false);
});

test('filters type, missing location, resolved and raw distance before rounding', async () => {
  const matcher = createGpsFeatureMatcher();
  const result = await matcher.findCandidates({ analysis, location: origin, incidents: [
    incident(1), incident(2, { type: 'trash' }), incident(3, { location: null }),
    incident(4, { status: 'resolved' }), incident(5, { location: atMeters(100.01) }),
    incident(6, { location: atMeters(99.99), status: 'in_progress' }),
  ] });
  assert.deepEqual(result.map(value => value.incidentId), [incident(1).id, incident(6).id]);
  assert.equal(result[0].score, 0.9364);
  assert.equal(result[0].distanceMeters, 10);
  assert.match(result[0].reasons.join(' '), /shape:irregular, surface:asphalt/);
  result.forEach(value => MatchCandidateSchema.parse(value));
  const exactDistance = distanceMeters(origin, atMeters(100));
  assert.equal((await createGpsFeatureMatcher({ radiusMeters: exactDistance }).findCandidates({
    analysis, location: origin, incidents: [incident(1, { location: atMeters(100) })],
  })).length, 1, 'radius comparison is inclusive');
});

test('empty features give no similarity bonus and truthful reasons', async () => {
  const matcher = createGpsFeatureMatcher();
  for (const features of [[], analysis.features]) {
    const [result] = await matcher.findCandidates({ analysis: { ...analysis, features: [] }, location: origin,
      incidents: [incident(1, { features })] });
    assert.equal(result.score, 0.6364);
    assert.match(result.reasons[2], /Chưa đủ/);
  }
  const [result] = await matcher.findCandidates({ analysis, location: origin,
    incidents: [incident(1, { features: ['shape:round'] })] });
  assert.match(result.reasons[2], /Chưa có đặc điểm chung/);
});

test('ranks by full score then distance and ID; top K is independent of input order', async () => {
  const candidates = [incident(4), incident(3), incident(2), incident(1),
    incident(5, { location: atMeters(1), features: [] })];
  const input = { analysis, location: origin, incidents: candidates };
  const before = structuredClone(input);
  const matcher = createGpsFeatureMatcher();
  const result = await matcher.findCandidates(input);
  assert.deepEqual(result.map(value => value.incidentId), [1, 2, 3].map(id => incident(id).id));
  assert.deepEqual(await matcher.findCandidates({ ...input, incidents: [...candidates].reverse() }), result);
  assert.deepEqual(await matcher.findCandidates(input), result);
  assert.deepEqual(input, before);
  assert.equal((await createGpsFeatureMatcher({ maxCandidates: 1 }).findCandidates(input)).length, 1);
});

test('rejects invalid configuration/input and returns empty for empty incidents', async () => {
  for (const radiusMeters of [0, -1, NaN, Infinity]) assert.throws(() => createGpsFeatureMatcher({ radiusMeters }));
  for (const maxCandidates of [0, -1, 1.5, Infinity]) assert.throws(() => createGpsFeatureMatcher({ maxCandidates }));
  const matcher = createGpsFeatureMatcher();
  assert.deepEqual(await matcher.findCandidates({ analysis, location: origin, incidents: [] }), []);
  await assert.rejects(matcher.findCandidates({ analysis, location: { latitude: 91, longitude: 0 }, incidents: [] }));
  await assert.rejects(matcher.findCandidates({ analysis: { ...analysis, features: ['wrong'] }, location: origin, incidents: [] }));
  await assert.rejects(matcher.findCandidates({ analysis, location: origin, incidents: [incident(1, { id: 'invalid' })] }));
});

test('retains mock export and all three pilot routing teams', async () => {
  assert.deepEqual(await mockMatcher.findCandidates({ analysis, location: origin, incidents: [] }), []);
  assert.equal(ruleRouter.assignTeam('pothole'), 'Tổ đường bộ (thí điểm)');
  assert.equal(ruleRouter.assignTeam('trash'), 'Tổ vệ sinh (thí điểm)');
  assert.equal(ruleRouter.assignTeam('flood'), 'Tổ thoát nước (thí điểm)');
});
