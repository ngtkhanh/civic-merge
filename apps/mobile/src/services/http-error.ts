export class ApiRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status?: number) { super(message); }
}

// Confirm may already have committed on a timeout, transport error or 5xx.
// Only documented, definitive rejections permit choosing create/merge again.
export function isDefinitiveConfirmRejection(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false;
  const rejectionStatuses: Record<string, number> = {
    VALIDATION_ERROR: 400, REPORT_NOT_FOUND: 404, INCIDENT_NOT_FOUND: 404, INCIDENT_TYPE_MISMATCH: 409, INCIDENT_RESOLVED: 409,
  };
  return rejectionStatuses[error.code] !== undefined && error.status === rejectionStatuses[error.code];
}
