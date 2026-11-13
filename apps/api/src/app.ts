import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import {
  AIAnalysisSchema, AnalyzeResponseSchema, ConfirmRequestSchema, ConfirmResponseSchema,
  DomainError, IncidentDetailSchema, IncidentListResponseSchema, LocationSchema,
  MockStateSchema, type DuplicateMatcher, type ImageStorage, type IncidentRepository,
  type IncidentRouter, type MockScenario, type VisionAnalyzer,
} from '@civicmerge/contracts';

export interface AppDependencies {
  repository: IncidentRepository; storage: ImageStorage; vision: VisionAnalyzer;
  matcher: DuplicateMatcher; router: IncidentRouter;
  uploadDir: string; mockMode: boolean;
  mockControl?: { getScenario(): MockScenario; setScenario(scenario: MockScenario): void };
}
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function validateImage(file: Express.Multer.File | undefined) {
  if (!file) throw new DomainError('VALIDATION_ERROR', 'Cần gửi ảnh trong field image.', 400);
  const b = file.buffer;
  const detected = b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
    : b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg'
    : b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
  if (!detected || detected !== file.mimetype) throw new DomainError('INVALID_IMAGE', 'Chỉ nhận ảnh JPEG, PNG hoặc WebP có MIME và chữ ký phù hợp.', 415);
  return { bytes: b, mimeType: detected };
}

export function createApp(deps: AppDependencies) {
  const app = express();
  let generation = 0;
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', mode: deps.mockMode ? 'mock' : 'real' }));
  app.use('/uploads', express.static(deps.uploadDir, { dotfiles: 'deny', index: false }));
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
    const analysis = AIAnalysisSchema.parse(await deps.vision.analyzeIncidentImage(image));
    const candidates = location ? await deps.matcher.findCandidates({ analysis, location, incidents: await deps.repository.list() }) : [];
    // Validate module output before saving report or image.
    AnalyzeResponseSchema.omit({ reportId: true }).parse({ analysis, candidates, warnings: [] });
    const imageUrl = await deps.storage.save(image);
    try {
      if (startedAtGeneration !== generation) throw new DomainError('MOCK_RESET', 'Dữ liệu vừa được reset. Hãy gửi lại ảnh.', 409);
      const report = await deps.repository.createPending({ analysis, location, imageUrl });
      res.status(201).json(AnalyzeResponseSchema.parse({
        reportId: report.id, analysis, candidates,
        warnings: location ? [] : [{ code: 'GPS_UNAVAILABLE', message: 'Không có GPS; chức năng tìm trùng theo vị trí bị hạn chế.' }],
      }));
    } catch (error) {
      await deps.storage.remove(imageUrl);
      throw error;
    }
  });
  app.post('/api/reports/confirm', async (req, res) => {
    const parsed = ConfirmRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Yêu cầu xác nhận không hợp lệ.', 400);
    const report = await deps.repository.findReport(parsed.data.reportId);
    if (!report) throw new DomainError('REPORT_NOT_FOUND', 'Không tìm thấy báo cáo.', 404);
    res.json(ConfirmResponseSchema.parse(await deps.repository.confirm(parsed.data, deps.router.assignTeam(report.analysis.type))));
  });
  app.get('/api/incidents', async (_req, res) => res.json(IncidentListResponseSchema.parse({ incidents: await deps.repository.list() })));
  app.get('/api/incidents/:id', async (req, res) => {
    const incident = await deps.repository.get(req.params.id);
    if (!incident) throw new DomainError('INCIDENT_NOT_FOUND', 'Không tìm thấy hồ sơ.', 404);
    res.json(IncidentDetailSchema.parse(incident));
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
    console.error('API request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Không thể xử lý yêu cầu. Hãy thử lại.' } });
  };
  app.use(handleError);
  return app;
}
