import { randomUUID } from 'node:crypto';
import { DomainError, type ConfirmRequest, type ConfirmResponse, type IncidentDetail, type IncidentRepository, type Report } from '@civicmerge/contracts';

export function createMemoryRepository(options: { incidents?: Map<string, IncidentDetail> } = {}): IncidentRepository {
  const reports = new Map<string, Report>();
  // Instance-owned backing store allows deterministic status-transition fixtures.
  // No status mutation method or test endpoint is exposed through the HTTP API.
  const incidents = options.incidents ?? new Map<string, IncidentDetail>();
  const confirmations = new Map<string, { request: ConfirmRequest; response: ConfirmResponse }>();
  const copy = <T>(value: T): T => structuredClone(value);
  return {
    async createPending(input) {
      const report: Report = { ...copy(input), id: randomUUID(), incidentId: null, status: 'pending', createdAt: new Date().toISOString() };
      reports.set(report.id, report);
      return copy(report);
    },
    async list() {
      return [...incidents.values()].reverse().map(({ reports: _reports, history: _history, ...summary }) => copy(summary));
    },
    async get(id) { return copy(incidents.get(id) ?? null); },
    async findReport(id) { return copy(reports.get(id) ?? null); },
    async confirm(request, assignedTeam) {
      // No await between validation and writes: atomic within this single-process mock.
      // Member 3 must use a database transaction/unique constraints in the real adapter.
      const prior = confirmations.get(request.reportId);
      if (prior) {
        if (prior.request.action !== request.action || (prior.request.action === 'merge' && request.action === 'merge' && prior.request.targetIncidentId !== request.targetIncidentId)) {
          throw new DomainError('REPORT_ALREADY_CONFIRMED', 'Báo cáo đã được xác nhận với lựa chọn khác.', 409);
        }
        return copy(prior.response);
      }
      const report = reports.get(request.reportId);
      if (!report) throw new DomainError('REPORT_NOT_FOUND', 'Không tìm thấy báo cáo.', 404);
      const now = new Date().toISOString();
      let incident: IncidentDetail;
      if (request.action === 'merge') {
        const target = incidents.get(request.targetIncidentId);
        if (!target) throw new DomainError('INCIDENT_NOT_FOUND', 'Hồ sơ đích không tồn tại.', 404);
        if (target.type !== report.analysis.type) throw new DomainError('INCIDENT_TYPE_MISMATCH', 'Không thể hợp nhất hai loại sự cố khác nhau.', 409);
        if (target.status === 'resolved') throw new DomainError('INCIDENT_RESOLVED', 'Hồ sơ đích đã được xử lý. Hãy tạo hồ sơ mới.', 409);
        incident = target;
      } else {
        incident = {
          id: randomUUID(), ...copy(report.analysis), location: copy(report.location),
          status: 'open', assignedTeam, reportCount: 0, coverImageUrl: report.imageUrl,
          createdAt: now, updatedAt: now, reports: [], history: [],
        };
      }
      report.incidentId = incident.id;
      report.status = 'confirmed';
      incident.reports.push(copy(report));
      incident.reportCount = incident.reports.length;
      incident.updatedAt = now;
      incident.history.push({ at: now, event: request.action === 'create' ? 'created' : 'report_merged', reportId: report.id });
      incidents.set(incident.id, incident);
      const response: ConfirmResponse = {
        incidentId: incident.id, action: request.action === 'create' ? 'created' : 'merged',
        reportCount: incident.reportCount, assignedTeam: incident.assignedTeam,
      };
      confirmations.set(report.id, { request: copy(request), response: copy(response) });
      return copy(response);
    },
    async reset() { reports.clear(); incidents.clear(); confirmations.clear(); },
  };
}
