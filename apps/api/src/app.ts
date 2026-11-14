import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import {
  AIAnalysisSchema, AnalyzeResponseSchema, ConfirmRequestSchema, ConfirmResponseSchema,
  DomainError, IncidentDetailSchema, IncidentListResponseSchema, LocationSchema,
  MockStateSchema, type DuplicateMatcher, type ImageStorage, type IncidentRepository,
  type IncidentRouter, type MockScenario, type VisionAnalyzer, type BackendCapabilities,
} from '@civicmerge/contracts';
import { MAX_IMAGE_BYTES, validateImageInput } from './storage/image.js';
import { publicImageUrl } from './storage/reference.js';
import type { ImageDelivery } from './storage/delivery.js';
import { PendingReportWriteRejected } from './repositories/errors.js';

export interface AppDependencies {
  repository: IncidentRepository; storage: ImageStorage; vision: VisionAnalyzer;
  matcher: DuplicateMatcher; router: IncidentRouter;
  uploadDir: string; mockMode: boolean;
  publicBaseUrl?: string;
  imageDelivery?: ImageDelivery;
  capabilities?: BackendCapabilities;
  mockControl?: { getScenario(): MockScenario; setScenario(scenario: MockScenario): void };
}
function validateImage(file: Express.Multer.File | undefined) {
  if (!file) throw new DomainError('VALIDATION_ERROR', 'Cần gửi ảnh trong field image.', 400);
  return validateImageInput({ bytes: file.buffer, mimeType: file.mimetype });
}

async function dependency<T>(code: string, work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(code, 'Dịch vụ tạm thời không khả dụng. Hãy thử lại.', 503);
  }
}

export function createApp(deps: AppDependencies) {
  const app = express();
  let generation = 0;
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', mode: deps.mockMode ? 'mock' : 'real',
    ...(deps.capabilities ? { capabilities: deps.capabilities } : {}),
  }));
  app.use('/uploads', express.static(deps.uploadDir, { dotfiles: 'deny', index: false }));
  if (deps.imageDelivery) app.get('/api/images/:bucket/:prefix/:name', async (req, res) => {
    const image = await deps.imageDelivery!.readObject(req.params.bucket, req.params.prefix, req.params.name);
    res.set({ 'Content-Type': image.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(Buffer.from(image.bytes));
  });
  const imageUrl = (value: string) => deps.publicBaseUrl ? publicImageUrl(value, deps.publicBaseUrl) : value;
  const summaries = async () => (await dependency('DATABASE_UNAVAILABLE', () => deps.repository.list()))
    .map(incident => ({ ...incident, coverImageUrl: imageUrl(incident.coverImageUrl) }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 2, parts: 3 } });

  app.post('/api/reports/analyze', upload.single('image'), async (req, res) => {
    const image = validateImage(req.file);
    const { latitude, longitude, ...unknown } = req.body ?? {};
    if (Object.keys(unknown).length) throw new DomainError('VALIDATION_ERROR', 'Field không được hỗ trợ.', 400);
    const missing = latitude === undefined && longitude === undefined;
    if (!missing && (typeof latitude !== 'string' || typeof longitude !== 'string' || !latitude.trim() || !longitude.trim())) {
      throw new DomainError('VALIDATION_ERROR', 'Cần gửi đủ latitude và longitude hợp lệ.', 400);
    }
    const parsed = missing ? null : LocationSchema.safeParse({ latitude: Number(latitude), longitude: Number(longitude) });
    if (parsed && !parsed.success) throw new DomainError('VALIDATION_ERROR', 'Tọa độ không hợp lệ.', 400);
    const location = parsed?.data ?? null;
    const startedAtGeneration = generation;
    const visionResult = await dependency('AI_UNAVAILABLE', () => deps.vision.analyzeIncidentImage(image));
    const parsedAnalysis = AIAnalysisSchema.safeParse(visionResult);
    if (!parsedAnalysis.success) throw new DomainError('PROVIDER_INVALID_RESPONSE', 'Kết quả phân tích không hợp lệ.', 502);
    const analysis = parsedAnalysis.data;
    const candidates = location ? await dependency('MATCHING_UNAVAILABLE', async () => deps.matcher.findCandidates({ analysis, location, incidents: await summaries() })) : [];
    // Validate module output before saving report or image.
    if (!AnalyzeResponseSchema.omit({ reportId: true }).safeParse({ analysis, candidates, warnings: [] }).success) {
      throw new DomainError('PROVIDER_INVALID_RESPONSE', 'Kết quả tìm trùng không hợp lệ.', 502);
    }
    const savedImage = await dependency('STORAGE_UNAVAILABLE', () => deps.storage.save(image));
    let writeStarted = false;
    let saved = false;
    try {
      if (startedAtGeneration !== generation) throw new DomainError('MOCK_RESET', 'Dữ liệu vừa được reset. Hãy gửi lại ảnh.', 409);
      writeStarted = true;
      const report = await dependency('DATABASE_UNAVAILABLE', () => deps.repository.createPending({ analysis, location, imageUrl: savedImage }));
      saved = true;
      res.status(201).json(AnalyzeResponseSchema.parse({
        reportId: report.id, analysis, candidates,
        warnings: location ? [] : [{ code: 'GPS_UNAVAILABLE', message: 'Không có GPS; chức năng tìm trùng theo vị trí bị hạn chế.' }],
      }));
    } catch (error) {
      if (!saved && (!writeStarted || error instanceof PendingReportWriteRejected)) {
        try { await deps.storage.remove(savedImage); }
        catch { console.error('Image cleanup failed; retain object for operator review.'); }
      }
      throw error;
    }
  });
  app.post('/api/reports/confirm', async (req, res) => {
    const parsed = ConfirmRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Yêu cầu xác nhận không hợp lệ.', 400);
    const report = await dependency('DATABASE_UNAVAILABLE', () => deps.repository.findReport(parsed.data.reportId));
    if (!report) throw new DomainError('REPORT_NOT_FOUND', 'Không tìm thấy báo cáo.', 404);
    res.json(ConfirmResponseSchema.parse(await dependency('DATABASE_UNAVAILABLE', () => deps.repository.confirm(parsed.data, deps.router.assignTeam(report.analysis.type)))));
  });
  app.get('/api/incidents', async (_req, res) => res.json(IncidentListResponseSchema.parse({ incidents: await summaries() })));
  app.get('/api/incidents/:id', async (req, res) => {
    const incident = await dependency('DATABASE_UNAVAILABLE', () => deps.repository.get(req.params.id));
    if (!incident) throw new DomainError('INCIDENT_NOT_FOUND', 'Không tìm thấy hồ sơ.', 404);
    res.json(IncidentDetailSchema.parse({ ...incident, coverImageUrl: imageUrl(incident.coverImageUrl),
      reports: incident.reports.map(report => ({ ...report, imageUrl: imageUrl(report.imageUrl) })),
    }));
  });

  // Development-only controls. Never register them on a real backend.
  if (deps.mockMode && deps.mockControl) {
    app.get('/api/mock/state', (_req, res) => res.json({ scenario: deps.mockControl!.getScenario() }));
    app.post('/api/mock/scenario', (req, res) => {
      const result = MockStateSchema.strict().safeParse(req.body);
      if (!result.success) throw new DomainError('VALIDATION_ERROR', 'Kịch bản mock không hợp lệ.', 400);
      deps.mockControl!.setScenario(result.data.scenario);
      res.json(result.data);
    });
    app.post('/api/mock/reset', async (_req, res) => {
      generation += 1;
      await deps.repository.reset();
      deps.mockControl!.setScenario('pothole');
      res.json({ scenario: 'pothole' });
    });
  }
  app.use((_req, _res, next) => next(new DomainError('NOT_FOUND', 'Đường dẫn không tồn tại.', 404)));
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof DomainError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    if (error instanceof multer.MulterError) {
      res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: { code: 'VALIDATION_ERROR', message: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh vượt giới hạn 8 MB.' : 'Multipart không hợp lệ.' } });
      return;
    }
    if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON không hợp lệ.' } }); return;
    }
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON vượt giới hạn 32 KiB.' } }); return;
    }
    console.error('API request failed.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Không thể xử lý yêu cầu. Hãy thử lại.' } });
  };
  app.use(handleError);
  return app;
}
