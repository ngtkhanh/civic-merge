import type { AIAnalysis, IncidentSummary, Location } from '@civicmerge/contracts';

// Synthetic coordinates/features for algorithm tests, not real Vision evidence.
export const origin: Location = { latitude: 0, longitude: 0 };
export const analysis: AIAnalysis = {
  type: 'pothole', severity: 'high', description: 'Synthetic pothole fixture',
  features: ['surface:asphalt', 'shape:irregular'],
};

export function atMeters(meters: number): Location {
  return { latitude: meters / 6_371_000 * 180 / Math.PI, longitude: 0 };
}

export function incident(index = 1, overrides: Partial<IncidentSummary> = {}): IncidentSummary {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ...structuredClone(analysis), location: atMeters(10), status: 'open',
    assignedTeam: 'Tổ đường bộ (thí điểm)', reportCount: 1,
    coverImageUrl: 'http://images.test/fixture.png',
    createdAt: '2026-11-14T00:00:00.000Z', updatedAt: '2026-11-14T00:00:00.000Z',
    ...overrides,
  };
}
