export type Role = 'owner' | 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active?: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  website?: string | null;
  careers_intro?: string | null;
  timezone?: string;
  privacy_notice_version?: string;
  privacy_notice_url?: string | null;
  default_retention_days?: number;
  ai_enabled?: number;
  email_from?: string | null;
  created_at?: number;
}

export interface Membership {
  id: string;
  role: Role;
  title?: string | null;
  status: string;
}

export interface Session {
  authenticated: boolean;
  user: User | null;
  org: Organization | null;
  membership: Membership | null;
  csrf_token?: string;
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  location: string | null;
  work_mode: 'onsite' | 'hybrid' | 'remote';
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  description: string;
  responsibilities: string | null;
  qualifications: string | null;
  application_deadline: string | null;
  hiring_owner_id: string | null;
  status: 'draft' | 'published' | 'closed' | 'archived';
  published_at: number | null;
  closed_at: number | null;
  privacy_notice_version: string | null;
  application_fields?: FormField[];
  created_at: number;
  updated_at: number;
  active_applications?: number;
  new_applications?: number;
  total_applications?: number;
  upcoming_interviews?: number;
  hiring_owner_name?: string | null;
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'select';
  required: boolean;
  options?: string[];
}

export interface Stage {
  id: string;
  key: string;
  name: string;
  position: number;
  kind: 'active' | 'offer' | 'hired' | 'rejected' | 'withdrawn';
}

export interface ApplicationListItem {
  id: string;
  job_id: string;
  stage_id: string;
  status: 'active' | 'hired' | 'rejected' | 'withdrawn' | 'archived';
  source: string | null;
  applied_at: number;
  stage_entered_at: number;
  first_reviewed_at: number | null;
  updated_at: number;
  owner_user_id: string | null;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_location: string | null;
  job_title: string;
  job_slug: string;
  department: string | null;
  stage_name: string;
  stage_kind: string;
  stage_position: number;
  owner_name: string | null;
  interview_count: number;
  feedback_count: number;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  anonymized_at: number | null;
}

export interface StageEvent {
  id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  from_stage_name: string | null;
  to_stage_name: string | null;
  actor_name: string | null;
  reason: string | null;
  created_at: number;
}

export interface Interview {
  id: string;
  title: string;
  format: 'video' | 'phone' | 'onsite';
  start_at: number;
  end_at: number;
  timezone: string;
  location: string | null;
  meeting_url: string | null;
  candidate_notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  participant_count?: number;
  scorecard_count?: number;
  candidate_name?: string;
  job_title?: string;
  application_id?: string;
  participants?: Participant[];
  scorecards?: Scorecard[];
}

export interface Participant {
  id?: string;
  user_id: string;
  role: 'lead' | 'interviewer' | 'shadow';
  full_name?: string;
  email?: string;
}

export interface Scorecard {
  id: string;
  interviewer_user_id: string;
  interviewer_name?: string;
  overall: 'strong_yes' | 'yes' | 'no' | 'strong_no';
  summary: string | null;
  submitted_at: number;
  responses?: ScorecardResponse[];
}

export interface ScorecardResponse {
  item_id: string;
  rating: number;
  evidence: string | null;
}

export interface ScorecardTemplate {
  id: string;
  name: string;
  description: string | null;
  items: ScorecardItem[];
}

export interface ScorecardItem {
  id: string;
  competency: string;
  description: string | null;
  anchors: Record<string, string>;
  position: number;
}

export interface Feedback {
  id: string;
  body: string;
  visibility: 'hiring_team' | 'private';
  author_name: string;
  created_at: number;
}

export interface Communication {
  id: string;
  channel: string;
  to_email: string;
  subject: string;
  body: string;
  status: 'sent' | 'failed' | 'not_configured';
  provider: string | null;
  error: string | null;
  created_by_name: string | null;
  created_at: number;
  sent_at: number | null;
}

export interface ApplicationDetail {
  access: 'manage' | 'edit' | 'view' | 'interview';
  application: {
    id: string;
    job_id: string;
    job_title: string;
    job_slug: string;
    department: string;
    location: string;
    work_mode: string;
    stage_id: string;
    stage_name: string | null;
    stage_kind: string | null;
    status: string;
    source: string | null;
    source_detail: string | null;
    owner_user_id?: string | null;
    cover_note: string | null;
    applied_at: number;
    stage_entered_at: number;
    first_reviewed_at: number | null;
    rejection_reason: string | null;
    withdrawn_at: number | null;
    anonymized_at: number | null;
    candidate_name: string;
    candidate_email: string;
    candidate?: Candidate;
    answers?: { question: string; answer: string }[];
    consent?: { granted: number; notice_version: string; created_at: number; withdrawn_at: number | null } | null;
    resume?: { id: string; original_filename: string; mime_type: string; size_bytes: number; created_at: number } | null;
    portal_token?: { id: string; expires_at: number; revoked_at: number | null; last_used_at: number | null } | null;
    deletion_requests?: DeletionRequest[];
  };
  history?: StageEvent[];
  interviews?: Interview[];
  feedback?: Feedback[];
  communications?: Communication[];
  stages?: Stage[];
  owner?: { id: string; full_name: string; email: string } | null;
  scorecard_template?: ScorecardTemplate | null;
  my_scorecards?: Scorecard[];
  notFound?: boolean;
}

export interface DeletionRequest {
  id: string;
  request_type: 'delete' | 'correct';
  status: 'open' | 'completed' | 'rejected';
  note: string;
  requested_by: string;
  created_at: number;
  resolved_at: number | null;
  resolution_note: string | null;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
}

export interface Template {
  id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
  updated_at: number;
}

export interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: Role;
  title: string | null;
  status: string;
  job_count: number;
  upcoming_interviews: number;
  jobs: { job_id: string; title: string }[];
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  title: string | null;
  expires_at: number;
  created_at: number;
}

export interface PortalData {
  organization: {
    name: string;
    slug: string;
    privacy_notice_version: string;
    privacy_notice_url: string | null;
    retention_days: number;
  };
  application: {
    reference: string;
    candidate_name: string;
    candidate_email: string;
    job_title: string;
    job_location: string | null;
    work_mode: string;
    stage_name: string;
    stage_kind: string;
    status: string;
    applied_at: number;
    withdrawn_at: number | null;
  };
  timeline: { created_at: number; to_stage_name: string; to_stage_kind: string }[];
  interviews: {
    title: string;
    format: string;
    start_at: number;
    end_at: number;
    timezone: string;
    location: string | null;
    meeting_url: string | null;
    candidate_notes: string | null;
    status: string;
  }[];
  messages: { subject: string; body: string; status: string; created_at: number; sent_at: number | null }[];
  consent: { granted: number; notice_version: string; created_at: number; withdrawn_at: number | null } | null;
  deletion_requests: DeletionRequest[];
}
