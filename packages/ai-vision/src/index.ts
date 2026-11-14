import { AIAnalysisSchema, DomainError, type ImageInput, type MockScenario, type VisionAnalyzer } from '@civicmerge/contracts';
import fixtures from '../../../mocks/fixtures/analyses.json';

export function createMockVision(getScenario: () => MockScenario): VisionAnalyzer {
  return {
    async analyzeIncidentImage(_image: ImageInput) {
      // TODO: mock — member 2 replaces this adapter with validated Vision output.
      const scenario = getScenario();
      if (scenario === 'ai-error') throw new DomainError('AI_UNAVAILABLE', 'AI đang không khả dụng. Hãy thử lại.', 503);
      return AIAnalysisSchema.parse(fixtures[scenario]);
    },
  };
}

export { createOpenAIVision, type OpenAIVisionOptions } from './openai.js';
