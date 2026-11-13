import type { AuthContext } from './types';
import type { Db } from './db';
import { fail } from './auth';

export type AccessLevel = 'manage' | 'edit' | 'view' | 'interview' | 'none';

export function isWorkspaceAdmin(auth: AuthContext): boolean {
  return auth.membership.role === 'owner' || auth.membership.role === 'admin';
}

/**
 * Job-level access. Admins manage every job. Everyone else is scoped by
 * explicit job membership or by being the hiring owner. Interviewers get
 * packet-level access only (checked per application), never the pipeline.
 */
export async function jobAccess(db: Db, auth: AuthContext, jobId: string): Promise<{ job: any | null; level: AccessLevel; jobRole: string | null }> {
  const job = await db.get<any>('SELECT * FROM jobs WHERE id = ? AND organization_id = ?', [jobId, auth.org.id]);
  if (!job) return { job: null, level: 'none', jobRole: null };
  if (isWorkspaceAdmin(auth)) return { job, level: 'manage', jobRole: null };

  const membership = await db.get<any>(
    'SELECT role FROM job_memberships WHERE job_id = ? AND user_id = ? AND organization_id = ?',
    [jobId, auth.user.id, auth.org.id],
  );
  const jobRole = membership?.role || (job.hiring_owner_id === auth.user.id ? 'hiring_manager' : null);

  if (!jobRole) return { job, level: 'none', jobRole: null };
  if (auth.membership.role === 'recruiter' && (jobRole === 'recruiter' || jobRole === 'hiring_manager')) {
    return { job, level: 'edit', jobRole };
  }
  if (auth.membership.role === 'hiring_manager' && (jobRole === 'hiring_manager' || jobRole === 'recruiter')) {
    return { job, level: 'view', jobRole };
  }
  if (auth.membership.role === 'interviewer' && jobRole === 'interviewer') {
    return { job, level: 'interview', jobRole };
  }
  // A recruiter who is also the hiring owner keeps edit. Anything else is denied.
  return { job, level: 'none', jobRole };
}

export async function canEditJob(db: Db, auth: AuthContext, jobId: string): Promise<boolean> {
  const access = await jobAccess(db, auth, jobId);
  return access.level === 'manage' || access.level === 'edit';
}

export async function canViewJobApplications(db: Db, auth: AuthContext, jobId: string): Promise<boolean> {
  const access = await jobAccess(db, auth, jobId);
  return access.level === 'manage' || access.level === 'edit' || access.level === 'view';
}

/**
 * Application-level access. Interviewers only reach candidates through an
 * interview they participate in, and receive a reduced field set.
 */
export async function applicationAccess(db: Db, auth: AuthContext, applicationId: string): Promise<{ application: any | null; level: AccessLevel; jobRole: string | null }> {
  const application = await db.get<any>(
    `SELECT a.*, j.title AS job_title, j.slug AS job_slug, j.department, j.location, j.work_mode,
            j.status AS job_status, j.hiring_owner_id, c.full_name AS candidate_name, c.email AS candidate_email
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN candidates c ON c.id = a.candidate_id
      WHERE a.id = ? AND a.organization_id = ?`,
    [applicationId, auth.org.id],
  );
  if (!application) return { application: null, level: 'none', jobRole: null };
  if (isWorkspaceAdmin(auth)) return { application, level: 'manage', jobRole: null };

  const access = await jobAccess(db, auth, application.job_id);
  if (access.level !== 'none' && access.level !== 'interview') {
    // Interviewer job membership still needs an interview relation below.
    if (auth.membership.role !== 'interviewer') {
      return { application, level: access.level, jobRole: access.jobRole };
    }
  }

  const interview = await db.get<any>(
    `SELECT i.id FROM interviews i
       JOIN interview_participants p ON p.interview_id = i.id
      WHERE i.application_id = ? AND p.user_id = ? AND i.organization_id = ?
      LIMIT 1`,
    [applicationId, auth.user.id, auth.org.id],
  );
  if (interview) return { application, level: 'interview', jobRole: 'interviewer' };
  return { application, level: 'none', jobRole: null };
}

export function denyUnless(c: any, ok: boolean, message = 'You do not have access to this record.') {
  if (!ok) return fail(c, 403, 'FORBIDDEN', message);
  return null;
}

export function canTransition(role: string, level: AccessLevel): boolean {
  if (level === 'manage' || level === 'edit') return true;
  // Hiring managers may record a decision but cannot bulk-edit the pipeline.
  if (level === 'view' && (role === 'hiring_manager' || role === 'admin' || role === 'owner')) return true;
  return false;
}

export function canManageTeam(auth: AuthContext): boolean {
  return isWorkspaceAdmin(auth);
}

export function canManageSettings(auth: AuthContext): boolean {
  return isWorkspaceAdmin(auth);
}

export function canSeeCompensation(auth: AuthContext): boolean {
  return auth.membership.role === 'owner' || auth.membership.role === 'admin' || auth.membership.role === 'recruiter';
}

export function canExport(auth: AuthContext): boolean {
  return auth.membership.role === 'owner' || auth.membership.role === 'admin' || auth.membership.role === 'recruiter';
}
