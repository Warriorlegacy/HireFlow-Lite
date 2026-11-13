-- HireFlow Lite — production schema (SQLite / Cloudflare D1)
-- Multi-tenant applicant tracking with job-level permissions and immutable history.
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Tenancy, identity, access
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  website TEXT,
  careers_intro TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  privacy_notice_version TEXT NOT NULL DEFAULT '2026-11-01',
  privacy_notice_url TEXT,
  default_retention_days INTEGER NOT NULL DEFAULT 365,
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  ai_provider TEXT,
  email_provider TEXT,
  email_from TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','recruiter','hiring_manager','interviewer')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  redeemed_at INTEGER,
  redeemed_user_id TEXT,
  revoked_at INTEGER,
  created_by_user_id TEXT,
  created_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Jobs and hiring teams
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  work_mode TEXT NOT NULL DEFAULT 'onsite' CHECK(work_mode IN ('onsite','hybrid','remote')),
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT NOT NULL,
  responsibilities TEXT,
  qualifications TEXT,
  application_deadline TEXT,
  hiring_owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed','archived')),
  published_at INTEGER,
  closed_at INTEGER,
  privacy_notice_version TEXT NOT NULL DEFAULT '2026-11-01',
  application_fields_json TEXT NOT NULL DEFAULT '[]',
  created_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(organization_id, slug)
);

CREATE TABLE IF NOT EXISTS job_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('recruiter','hiring_manager','interviewer')),
  created_at INTEGER NOT NULL,
  UNIQUE(job_id, user_id)
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'active' CHECK(kind IN ('active','offer','hired','rejected','withdrawn')),
  created_at INTEGER NOT NULL,
  UNIQUE(organization_id, key)
);

CREATE TABLE IF NOT EXISTS scorecard_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scorecard_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES scorecard_templates(id) ON DELETE CASCADE,
  competency TEXT NOT NULL,
  description TEXT,
  anchors_json TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Candidates and applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  anonymized_at INTEGER
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL REFERENCES pipeline_stages(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','hired','rejected','withdrawn','archived')),
  source TEXT,
  source_detail TEXT,
  cover_note TEXT,
  resume_file_id TEXT,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  applied_at INTEGER NOT NULL,
  stage_entered_at INTEGER NOT NULL,
  first_reviewed_at INTEGER,
  rejection_reason TEXT,
  withdrawn_at INTEGER,
  anonymized_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS application_answers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS resume_files (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  storage_backend TEXT NOT NULL DEFAULT 'd1' CHECK(storage_backend IN ('r2','d1')),
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS file_blobs (
  storage_key TEXT PRIMARY KEY,
  data_base64 TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_consents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  withdrawn_at INTEGER
);

CREATE TABLE IF NOT EXISTS stage_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_stage_id TEXT,
  to_stage_id TEXT,
  actor_user_id TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS source_attributions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  detail TEXT,
  utm_json TEXT,
  created_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Interviews, scorecards, feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'video' CHECK(format IN ('video','phone','onsite')),
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  location TEXT,
  meeting_url TEXT,
  candidate_notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled','no_show')),
  created_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_participants (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'interviewer' CHECK(role IN ('lead','interviewer','shadow')),
  created_at INTEGER NOT NULL,
  UNIQUE(interview_id, user_id)
);

CREATE TABLE IF NOT EXISTS scorecards (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interviewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall TEXT NOT NULL CHECK(overall IN ('strong_yes','yes','no','strong_no')),
  summary TEXT,
  submitted_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(interview_id, interviewer_user_id)
);

CREATE TABLE IF NOT EXISTS scorecard_responses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scorecard_id TEXT NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  evidence TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'hiring_team' CHECK(visibility IN ('hiring_team','private')),
  created_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Communication and candidate portal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communication_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(organization_id, key)
);

CREATE TABLE IF NOT EXISTS communication_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  template_id TEXT,
  channel TEXT NOT NULL DEFAULT 'email' CHECK(channel IN ('email','in_app')),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'logged' CHECK(status IN ('logged','queued','sent','delivered','failed','not_configured')),
  provider TEXT,
  provider_message_id TEXT,
  error TEXT,
  created_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);

CREATE TABLE IF NOT EXISTS candidate_portal_tokens (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Retention, deletion, audit, limits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retention_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(organization_id, category)
);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK(request_type IN ('delete','correct','withdraw')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','processing','completed','rejected')),
  note TEXT,
  requested_by TEXT NOT NULL DEFAULT 'candidate',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by_user_id TEXT,
  resolution_note TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at INTEGER NOT NULL,
  prev_hash TEXT,
  row_hash TEXT
);

CREATE TABLE IF NOT EXISTS usage_limits (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE(organization_id, metric, period)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Indexes for the real query paths
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON jobs(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_org_slug ON jobs(organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_job_members_user ON job_memberships(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_apps_org_job ON applications(organization_id, job_id, stage_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_org_applied ON applications(organization_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_org_status ON applications(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_org_email ON candidates(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_answers_app ON application_answers(application_id);
CREATE INDEX IF NOT EXISTS idx_stage_events_app ON stage_events(application_id, created_at);
CREATE INDEX IF NOT EXISTS idx_interviews_org_start ON interviews(organization_id, start_at);
CREATE INDEX IF NOT EXISTS idx_interviews_app ON interviews(application_id, start_at);
CREATE INDEX IF NOT EXISTS idx_participants_user ON interview_participants(user_id, interview_id);
CREATE INDEX IF NOT EXISTS idx_scorecards_interview ON scorecards(interview_id);
CREATE INDEX IF NOT EXISTS idx_responses_scorecard ON scorecard_responses(scorecard_id);
CREATE INDEX IF NOT EXISTS idx_feedback_app ON feedback(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_app ON communication_events(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_token ON candidate_portal_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_org_status ON deletion_requests(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_app ON resume_files(application_id);
