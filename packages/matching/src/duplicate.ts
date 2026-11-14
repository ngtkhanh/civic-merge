import {
  AIAnalysisSchema, IncidentSummarySchema, LocationSchema, MatchCandidateSchema,
  type DuplicateMatcher,
} from '@civicmerge/contracts';
import { distanceMeters } from './geography.js';
import { compareFeatures, rankScore } from './scoring.js';

export interface MatchingOptions {
  radiusMeters?: number;
  maxCandidates?: number;
}

/** GPS/features ranking only: callers must confirm merges and recheck target status. */
export function createGpsFeatureMatcher(options: MatchingOptions = {}): DuplicateMatcher {
  const radius = options.radiusMeters ?? 100;
  const limit = options.maxCandidates ?? 3;
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('radiusMeters must be finite and positive');
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError('maxCandidates must be a positive safe integer');

  return {
    async findCandidates(input) {
      const analysis = AIAnalysisSchema.parse(input.analysis);
      const location = LocationSchema.parse(input.location);
      const incidents = input.incidents.map(incident => IncidentSummarySchema.parse(incident));
      const ranked = incidents
        .filter(incident => incident.type === analysis.type && incident.location !== null && incident.status !== 'resolved')
        .map(incident => ({ incident, distance: distanceMeters(location, incident.location!) }))
        .filter(({ distance }) => distance <= radius)
        .map(({ incident, distance }) => {
          const features = compareFeatures(analysis.features, incident.features);
          return {
            incidentId: incident.id,
            score: rankScore(distance, radius, features.similarity),
            distanceMeters: distance,
            reasons: [
              `Cùng loại sự cố: ${analysis.type}`,
              `Cách khoảng ${Number(distance.toFixed(1))} m, trong bán kính ${radius} m`,
              !features.hasFeatures ? 'Chưa đủ features để so sánh'
                : features.common.length ? `Đặc điểm chung: ${features.common.join(', ')}`
                  : 'Chưa có đặc điểm chung',
            ],
          };
        });
      ranked.sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters
        || (a.incidentId < b.incidentId ? -1 : a.incidentId > b.incidentId ? 1 : 0));
      return ranked.slice(0, limit).map(candidate => MatchCandidateSchema.parse({
        ...candidate,
        score: Number(candidate.score.toFixed(4)),
        distanceMeters: Number(candidate.distanceMeters.toFixed(1)),
      }));
    },
  };
}
