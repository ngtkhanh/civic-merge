import {
  AIAnalysisSchema,
  DomainError,
  type ImageInput,
  type VisionAnalyzer,
} from '@civicmerge/contracts';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 18_000;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_FEATURES: Record<string, ReadonlySet<string>> = {
  surface: new Set(['asphalt', 'concrete', 'water']),
  shape: new Set(['irregular', 'round', 'scattered', 'piled', 'spread']),
  material: new Set(['plastic', 'paper', 'glass', 'metal', 'organic']),
};

const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['pothole', 'trash', 'flood'] },
    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
    description: { type: 'string' },
    features: { type: 'array', items: { type: 'string' } },
  },
  required: ['type', 'severity', 'description', 'features'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = [
  'Analyze the provided image for one visible urban issue.',
  'Classify only as pothole, trash, or flood. If the image is not a usable photo of one of those issues, set description to start exactly with "UNSUITABLE_IMAGE:" and briefly explain why; the caller will reject it.',
  'Choose severity low, medium, or high based on visible extent and immediate public risk.',
  'Describe only observable details. Do not infer an address, cause, or hidden facts.',
  'Return features only from this vocabulary, using lowercase ASCII group:value tags: surface:asphalt, surface:concrete, surface:water; shape:irregular, shape:round, shape:scattered, shape:piled, shape:spread; material:plastic, material:paper, material:glass, material:metal, material:organic.',
  'Return at most one surface tag and at most one shape tag. Multiple material tags are allowed only when each material is clearly visible. Do not invent synonyms or tags outside the vocabulary; omit uncertain tags. Duplicate tags are unnecessary.',
].join(' ');

export interface OpenAIVisionOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function validateImage(image: ImageInput): void {
  if (!SUPPORTED_IMAGE_TYPES.has(image.mimeType)) {
    throw new DomainError('INVALID_IMAGE', 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.', 415);
  }
  if (image.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new DomainError('VALIDATION_ERROR', 'Ảnh vượt quá giới hạn 8 MB.', 413);
  }
  if (image.bytes.byteLength === 0) {
    throw new DomainError('INVALID_IMAGE', 'Tệp ảnh rỗng.', 415);
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function normalizeFeatures(features: string[]): string[] {
  const uniqueFeatures = [...new Set(features)];
  const groupCounts = new Map<string, number>();

  for (const feature of uniqueFeatures) {
    const [group, value] = feature.split(':');
    if (!group || !value || !ALLOWED_FEATURES[group]?.has(value)) {
      throw new DomainError('AI_INVALID_RESPONSE', 'AI trả về feature ngoài bộ từ vựng đã thống nhất.', 502);
    }
    const count = (groupCounts.get(group) ?? 0) + 1;
    groupCounts.set(group, count);
    if ((group === 'surface' || group === 'shape') && count > 1) {
      throw new DomainError('AI_INVALID_RESPONSE', `AI trả về nhiều tag ${group} trong khi chỉ cho phép một.`, 502);
    }
  }

  return uniqueFeatures.sort();
}

function getOutputText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || !('output' in payload)) return undefined;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return undefined;

  for (const item of output) {
    if (!item || typeof item !== 'object' || !('content' in item)) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      if ('type' in part && part.type === 'refusal') {
        throw new DomainError('AI_INVALID_RESPONSE', 'AI từ chối phân tích ảnh này.', 502);
      }
      if ('type' in part && part.type === 'output_text' && 'text' in part && typeof part.text === 'string') {
        return part.text;
      }
    }
  }
  return undefined;
}

export function createOpenAIVision(options: OpenAIVisionOptions): VisionAnalyzer {
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const request = options.fetchImpl ?? fetch;

  if (!apiKey || !model) {
    throw new DomainError('AI_UNAVAILABLE', 'Thiếu cấu hình OpenAI API key hoặc model.', 503);
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive number');
  }

  return {
    async analyzeIncidentImage(image: ImageInput) {
      validateImage(image);
      const base64 = encodeBase64(image.bytes);

      let response: Response;
      try {
        response = await request(OPENAI_RESPONSES_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model,
            store: false,
            input: [{
              role: 'user',
              content: [
                { type: 'input_text', text: SYSTEM_PROMPT },
                { type: 'input_image', image_url: `data:${image.mimeType};base64,${base64}` },
              ],
            }],
            text: {
              format: {
                type: 'json_schema',
                name: 'civicmerge_incident_analysis',
                strict: true,
                schema: ANALYSIS_JSON_SCHEMA,
              },
            },
          }),
        });
      } catch {
        throw new DomainError('AI_UNAVAILABLE', 'Không thể kết nối dịch vụ phân tích ảnh.', 503);
      }

      if (!response.ok) {
        throw new DomainError('AI_UNAVAILABLE', 'Dịch vụ phân tích ảnh đang không khả dụng.', 503);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new DomainError('AI_INVALID_RESPONSE', 'Dịch vụ AI trả về dữ liệu không đọc được.', 502);
      }

      let outputText: string | undefined;
      try {
        outputText = getOutputText(payload);
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError('AI_INVALID_RESPONSE', 'Dịch vụ AI trả về cấu trúc không hợp lệ.', 502);
      }
      if (!outputText) {
        throw new DomainError('AI_INVALID_RESPONSE', 'Dịch vụ AI không trả về kết quả phân tích.', 502);
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(outputText);
      } catch {
        throw new DomainError('AI_INVALID_RESPONSE', 'Kết quả AI không phải JSON hợp lệ.', 502);
      }

      const analysis = AIAnalysisSchema.safeParse(parsedJson);
      if (!analysis.success) {
        throw new DomainError('AI_INVALID_RESPONSE', 'Kết quả AI không khớp schema CivicMerge.', 502);
      }
      if (analysis.data.description.startsWith('UNSUITABLE_IMAGE:')) {
        throw new DomainError('INVALID_IMAGE', 'Ảnh không thể hiện rõ một sự cố đô thị được hỗ trợ.', 422);
      }
      return { ...analysis.data, features: normalizeFeatures(analysis.data.features) };
    },
  };
}
