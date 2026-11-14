import { DomainError } from '@civicmerge/contracts';

// Only a definite server-side rejection permits deleting an uploaded image.
// Connection loss/timeout can occur after INSERT committed: retain the object.
export class PendingReportWriteRejected extends DomainError {
  constructor() { super('DATABASE_WRITE_REJECTED', 'Không thể lưu báo cáo. Hãy thử lại.', 503); }
}
