import { z } from 'zod';

export const IncidentTypeSchema = z.enum(['pothole', 'trash', 'flood']);
export const SeveritySchema = z.enum(['low', 'medium', 'high']);
export const LocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
// Lowercase ASCII tags, e.g. surface:asphalt or shape:irregular; not free prose.
export const FeatureSchema = z.string().regex(/^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/);
export const AIAnalysisSchema = z.object({
  type: IncidentTypeSchema, severity: SeveritySchema,
  description: z.string().min(1), features: z.array(FeatureSchema),
});
export const MatchCandidateSchema = z.object({
  incidentId: z.string().uuid(), score: z.number().min(0).max(1),
  distanceMeters: z.number().nonnegative(), reasons: z.array(z.string()),
});
export const ReportSchema = z.object({
  id: z.string().uuid(), incidentId: z.string().uuid().nullable(),
  status: z.enum(['pending', 'confirmed']), analysis: AIAnalysisSchema,
  location: LocationSchema.nullable(), imageUrl: z.string().url(),
  createdAt: z.string().datetime(),
});
export const IncidentSummarySchema = z.object({
  id: z.string().uuid(), type: IncidentTypeSchema, severity: SeveritySchema,
  description: z.string(), location: LocationSchema.nullable(),
  features: z.array(FeatureSchema), status: z.enum(['open', 'in_progress', 'resolved']),
  assignedTeam: z.string(), reportCount: z.number().int().positive(),
  coverImageUrl: z.string().url(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export const IncidentDetailSchema = IncidentSummarySchema.extend({
  reports: z.array(ReportSchema),
  history: z.array(z.object({
    at: z.string().datetime(), event: z.enum(['created', 'report_merged']), reportId: z.string().uuid(),
  })),
});
export const AnalyzeRequestSchema = z.object({ location: LocationSchema.nullable() });
export const AnalyzeResponseSchema = z.object({
  reportId: z.string().uuid(), analysis: AIAnalysisSchema,
  candidates: z.array(MatchCandidateSchema),
  warnings: z.array(z.object({ code: z.literal('GPS_UNAVAILABLE'), message: z.string() })),
});
export const ConfirmRequestSchema = z.discriminatedUnion('action', [
  z.object({ reportId: z.string().uuid(), action: z.literal('create') }).strict(),
  z.object({ reportId: z.string().uuid(), action: z.literal('merge'), targetIncidentId: z.string().uuid() }).strict(),
]);
export const ConfirmResponseSchema = z.object({
  incidentId: z.string().uuid(), action: z.enum(['created', 'merged']),
  reportCount: z.number().int().positive(), assignedTeam: z.string(),
});
export const IncidentListResponseSchema = z.object({ incidents: z.array(IncidentSummarySchema) });
export const ApiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export const HealthSchema = z.object({ status: z.literal('ok'), mode: z.enum(['mock', 'real']) });
// Development controls are separate from the business request schemas.
export const MockScenarioSchema = z.enum(['pothole', 'trash', 'flood', 'ai-error']);
export const MockStateSchema = z.object({ scenario: MockScenarioSchema });

export type IncidentType = z.infer<typeof IncidentTypeSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type IncidentSummary = z.infer<typeof IncidentSummarySchema>;
export type IncidentDetail = z.infer<typeof IncidentDetailSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type ConfirmRequest = z.infer<typeof ConfirmRequestSchema>;
export type ConfirmResponse = z.infer<typeof ConfirmResponseSchema>;
export type MockScenario = z.infer<typeof MockScenarioSchema>;

export interface ImageInput { bytes: Uint8Array; mimeType: string }
export interface VisionAnalyzer { analyzeIncidentImage(image: ImageInput): Promise<AIAnalysis> }
export interface DuplicateMatcher {
  findCandidates(input: { analysis: AIAnalysis; location: Location; incidents: IncidentSummary[] }): Promise<MatchCandidate[]>;
}
export interface IncidentRouter { assignTeam(type: IncidentType): string }
export interface ImageStorage { save(image: ImageInput): Promise<string>; remove(url: string): Promise<void> }
export interface IncidentRepository {
  createPending(input: { analysis: AIAnalysis; location: Location | null; imageUrl: string }): Promise<Report>;
  list(): Promise<IncidentSummary[]>;
  get(id: string): Promise<IncidentDetail | null>;
  // Implementations must perform validation, linking and idempotency atomically.
  confirm(request: ConfirmRequest, assignedTeam: string): Promise<ConfirmResponse>;
  findReport(id: string): Promise<Report | null>;
  reset(): Promise<void>;
}
export class DomainError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
