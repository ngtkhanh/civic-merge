# CivicMerge AI Vision

The package exposes two implementations of the shared `VisionAnalyzer` contract:

- `createMockVision(getScenario)` for deterministic local development without an API key.
- `createOpenAIVision({ apiKey, model, timeoutMs? })` for server-side image analysis.

The OpenAI adapter sends image bytes to the Responses API as a Base64 data URL, requests a strict JSON schema, and validates the parsed result again with the shared `AIAnalysisSchema`. It accepts JPEG, PNG, and WebP images up to 8 MB. The default provider timeout is 18 seconds, configurable with `timeoutMs`; timeout aborts the in-flight fetch. Feature tags are restricted to the matching team's MVP vocabulary: `surface:{asphalt,concrete,water}`, `shape:{irregular,round,scattered,piled,spread}`, and `material:{plastic,paper,glass,metal,organic}`. It deduplicates and sorts valid tags, allows at most one surface and one shape, and preserves an empty feature list. It rejects unknown tags rather than guessing a correction. Unsupported images raise `DomainError` with `INVALID_IMAGE` (415); unsuitable incident photos use `INVALID_IMAGE` (422); oversized files use `VALIDATION_ERROR` (413); service/network failures use `AI_UNAVAILABLE` (503); malformed model output uses `AI_INVALID_RESPONSE` (502).

The API key and model must be supplied by the backend at construction time. Do not place secrets in the mobile app or commit them. Backend adapter selection and environment configuration are intentionally owned by the API/workspace owner; this package does not read `.env` directly.

The shared `VisionAnalyzer` method currently has no per-request `AbortSignal` parameter. The adapter cancels the OpenAI fetch at its configured timeout; canceling because an individual client disconnects requires a coordinated shared-contract/API change. The current API analyze flow calls Vision before saving the image or creating a pending report.

The mock remains available and requires no credentials. See the repository API contract for the `AIAnalysis` fields and the lowercase `group:value` feature tag format.
