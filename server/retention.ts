import type { Db } from './db';
import { newId } from './crypto';
import { deleteResume } from './files';
import { auditSystem } from './auth';

export interface AnonymiseResult {
  applications: number;
  resumesDeleted: number;
}

/**
 * Irreversibly anonymise one application and the linked candidate record.
 * File objects are deleted first; relational redaction follows.
 */
export async function anonymizeApplication(env: any, db: Db, orgId: string, applicationId: string): Promise<boolean> {
  const app = await db.get<any>(
    `SELECT a.*, c.id AS candidate_row_id FROM applications a JOIN candidates c ON c.id = a.candidate_id
      WHERE a.id = ? AND a.organization_id = ?`,
    [applicationId, orgId],
  );
  if (!app) return false;
  if (app.anonymized_at) return false;

  const files = await db.all<any>('SELECT * FROM resume_files WHERE application_id = ? AND organization_id = ? AND deleted_at IS NULL', [applicationId, orgId]);
  for (const file of files) {
    await deleteResume(env, db, file);
    await db.run("UPDATE resume_files SET deleted_at = ?, original_filename = 'redacted', storage_key = 'deleted' WHERE id = ?", [Date.now(), file.id]);
  }

  const now = Date.now();
  const anonymousEmail = `anonymised+${String(applicationId).slice(-8)}@invalid.local`;
  await db.batch([
    {
      sql: `UPDATE candidates SET full_name = 'Anonymised candidate', email = ?, phone = NULL, location = NULL,
              linkedin_url = NULL, portfolio_url = NULL, anonymized_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      params: [anonymousEmail, now, now, app.candidate_id, orgId],
    },
    {
      sql: `UPDATE applications SET status = 'archived', cover_note = NULL, resume_file_id = NULL,
              rejection_reason = NULL, anonymized_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      params: [now, now, applicationId, orgId],
    },
    { sql: 'DELETE FROM application_answers WHERE application_id = ?', params: [applicationId] },
    {
      sql: 'UPDATE candidate_portal_tokens SET revoked_at = ? WHERE application_id = ? AND revoked_at IS NULL',
      params: [now, applicationId],
    },
    {
      sql: "UPDATE candidate_consents SET withdrawn_at = COALESCE(withdrawn_at, ?) WHERE application_id = ?",
      params: [now, applicationId],
    },
    {
      sql: "UPDATE communication_events SET to_email = 'redacted', body = '[redacted by retention policy]' WHERE application_id = ?",
      params: [applicationId],
    },
  ]);
  await auditSystem(db, orgId, 'retention.application_anonymised', 'application', applicationId, { resumes_deleted: files.length }, 'system');
  return true;
}

export async function runRetention(env: any, db: Db, orgId: string): Promise<AnonymiseResult> {
  const rule = await db.get<any>("SELECT * FROM retention_rules WHERE organization_id = ? AND category = 'applications'", [orgId]);
  const org = await db.get<any>('SELECT default_retention_days FROM organizations WHERE id = ?', [orgId]);
  const days = Number(rule?.retention_days || org?.default_retention_days || 365);
  const cutoff = Date.now() - days * 86400_000;
  const rows = await db.all<any>(
    'SELECT id FROM applications WHERE organization_id = ? AND applied_at < ? AND anonymized_at IS NULL',
    [orgId, cutoff],
  );
  let applications = 0;
  let resumesDeleted = 0;
  for (const row of rows) {
    const files = await db.all<any>('SELECT id FROM resume_files WHERE application_id = ? AND deleted_at IS NULL', [row.id]);
    const done = await anonymizeApplication(env, db, orgId, row.id);
    if (done) {
      applications++;
      resumesDeleted += files.length;
    }
  }
  await db.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
  await db.run('DELETE FROM rate_limits WHERE window_start < ?', [Date.now() - 86400_000]);
  await db.run('UPDATE invitations SET revoked_at = ? WHERE expires_at < ? AND redeemed_at IS NULL AND revoked_at IS NULL', [Date.now(), Date.now()]);
  return { applications, resumesDeleted };
}
