import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { PendingReportWriteRejected } from './errors.js';
import {
  AIAnalysisSchema, ConfirmRequestSchema, ConfirmResponseSchema, DomainError,
  IncidentDetailSchema, IncidentSummarySchema, LocationSchema, ReportSchema,
  type IncidentRepository,
} from '@civicmerge/contracts';

const iso = (value: Date) => value.toISOString();
const location = (row: QueryResultRow) => row.latitude === null ? null : { latitude: row.latitude, longitude: row.longitude };
function report(row: QueryResultRow) {
  return ReportSchema.parse({
    id: row.id, incidentId: row.incident_id, status: row.status,
    analysis: { type: row.type, severity: row.severity, description: row.description, features: row.features },
    location: location(row), imageUrl: row.image_url, createdAt: iso(row.created_at),
  });
}
function summary(row: QueryResultRow) {
  return IncidentSummarySchema.parse({
    id: row.id, type: row.type, severity: row.severity, description: row.description, features: row.features,
    location: location(row), status: row.status, assignedTeam: row.assigned_team,
    reportCount: row.report_count, coverImageUrl: row.cover_image_url,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  });
}

// All statements in a transaction use one checked-out client, never pool.query.
async function transaction<T>(pool: Pool, begin: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let failedConnection: Error | undefined;
  try {
    await client.query(begin);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); }
    catch { failedConnection = new Error('Database rollback failed'); }
    throw error;
  } finally { client.release(failedConnection); }
}

export function createPostgresRepository(pool: Pool): IncidentRepository {
  return {
    async createPending(input) {
      const analysis = AIAnalysisSchema.parse(input.analysis);
      const point = LocationSchema.nullable().parse(input.location);
      const imageUrl = ReportSchema.shape.imageUrl.parse(input.imageUrl);
      let result;
      try { result = await pool.query(`
        INSERT INTO civicmerge.reports (id, type, severity, description, features, latitude, longitude, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [randomUUID(), analysis.type, analysis.severity, analysis.description, analysis.features,
        point?.latitude ?? null, point?.longitude ?? null, imageUrl]); }
      catch (error) {
        // SQLSTATE data/constraint/syntax/rollback failures mean this single
        // INSERT was rejected. Transport/cancellation/unknown errors do not.
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        if (/^(22|23|40|42)[A-Z0-9]{3}$/.test(code) || code === 'P0001') throw new PendingReportWriteRejected();
        throw new DomainError('DATABASE_UNAVAILABLE', 'Chưa xác định được kết quả lưu báo cáo. Không tự động gửi lại.', 503);
      }
      return report(result.rows[0]);
    },
    async findReport(id) {
      if (!ReportSchema.shape.id.safeParse(id).success) return null;
      const result = await pool.query('SELECT * FROM civicmerge.reports WHERE id = $1', [id]);
      return result.rows[0] ? report(result.rows[0]) : null;
    },
    async list() {
      const result = await pool.query('SELECT * FROM civicmerge.incidents ORDER BY created_at DESC, id DESC');
      return result.rows.map(summary);
    },
    async get(id) {
      if (!IncidentSummarySchema.shape.id.safeParse(id).success) return null;
      // One consistent snapshot even while another connection is confirming.
      return transaction(pool, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', async client => {
        const result = await client.query('SELECT * FROM civicmerge.incidents WHERE id = $1', [id]);
        if (!result.rows[0]) return null;
        const reports = await client.query('SELECT * FROM civicmerge.reports WHERE incident_id = $1 ORDER BY created_at, id', [id]);
        const history = await client.query('SELECT * FROM civicmerge.history WHERE incident_id = $1 ORDER BY at, report_id', [id]);
        return IncidentDetailSchema.parse({
          ...summary(result.rows[0]), reports: reports.rows.map(report),
          history: history.rows.map(row => ({ at: iso(row.at), event: row.event, reportId: row.report_id })),
        });
      });
    },
    async confirm(input, assignedTeam) {
      const parsed = ConfirmRequestSchema.safeParse(input);
      if (!parsed.success) throw new DomainError('VALIDATION_ERROR', 'Yêu cầu xác nhận không hợp lệ.', 400);
      const request = parsed.data;
      return transaction(pool, 'BEGIN ISOLATION LEVEL READ COMMITTED', async client => {
        // Global lock order: report -> target incident. Retries wait here.
        const locked = await client.query('SELECT * FROM civicmerge.reports WHERE id = $1 FOR UPDATE', [request.reportId]);
        if (!locked.rows[0]) throw new DomainError('REPORT_NOT_FOUND', 'Không tìm thấy báo cáo.', 404);
        const pending = report(locked.rows[0]);
        const prior = await client.query('SELECT * FROM civicmerge.confirmations WHERE report_id = $1', [request.reportId]);
        if (prior.rows[0]) {
          const saved = prior.rows[0];
          if (saved.action !== request.action || (request.action === 'merge' && saved.target_incident_id !== request.targetIncidentId.toLowerCase())) {
            throw new DomainError('REPORT_ALREADY_CONFIRMED', 'Báo cáo đã được xác nhận với lựa chọn khác.', 409);
          }
          return ConfirmResponseSchema.parse(saved.response);
        }
        if (pending.status !== 'pending') throw new Error('Confirmed report is missing its confirmation snapshot');

        let incident: QueryResultRow;
        if (request.action === 'merge') {
          const target = await client.query('SELECT * FROM civicmerge.incidents WHERE id = $1 FOR UPDATE', [request.targetIncidentId]);
          if (!target.rows[0]) throw new DomainError('INCIDENT_NOT_FOUND', 'Hồ sơ đích không tồn tại.', 404);
          if (target.rows[0].type !== pending.analysis.type) throw new DomainError('INCIDENT_TYPE_MISMATCH', 'Không thể hợp nhất hai loại sự cố khác nhau.', 409);
          if (target.rows[0].status === 'resolved') throw new DomainError('INCIDENT_RESOLVED', 'Hồ sơ đích đã được xử lý. Hãy tạo hồ sơ mới.', 409);
          const updated = await client.query(`UPDATE civicmerge.incidents
            SET report_count = report_count + 1, updated_at = clock_timestamp() WHERE id = $1 RETURNING *`, [request.targetIncidentId]);
          incident = updated.rows[0];
        } else {
          const created = await client.query(`INSERT INTO civicmerge.incidents
            (id, type, severity, description, features, latitude, longitude, assigned_team, report_count, cover_image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9) RETURNING *`,
          [randomUUID(), pending.analysis.type, pending.analysis.severity, pending.analysis.description, pending.analysis.features,
            pending.location?.latitude ?? null, pending.location?.longitude ?? null, assignedTeam, pending.imageUrl]);
          incident = created.rows[0];
        }
        await client.query("UPDATE civicmerge.reports SET incident_id = $1, status = 'confirmed' WHERE id = $2", [incident.id, pending.id]);
        await client.query('INSERT INTO civicmerge.history (report_id, incident_id, event, at) VALUES ($1, $2, $3, $4)',
          [pending.id, incident.id, request.action === 'create' ? 'created' : 'report_merged', incident.updated_at]);
        const response = ConfirmResponseSchema.parse({
          incidentId: incident.id, action: request.action === 'create' ? 'created' : 'merged',
          reportCount: incident.report_count, assignedTeam: incident.assigned_team,
        });
        await client.query(`INSERT INTO civicmerge.confirmations
          (report_id, incident_id, action, target_incident_id, response, confirmed_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [pending.id, incident.id, request.action, request.action === 'merge' ? request.targetIncidentId : null,
          JSON.stringify(response), incident.updated_at]);
        return response;
      });
    },
    async reset() { throw new DomainError('RESET_DISABLED', 'Không được reset dữ liệu PostgreSQL qua ứng dụng.', 403); },
  };
}
