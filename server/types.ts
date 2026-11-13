export type Role = 'owner' | 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  website?: string | null;
  careers_intro?: string | null;
  timezone: string;
  privacy_notice_version: string;
  privacy_notice_url?: string | null;
  default_retention_days: number;
  ai_enabled: number;
  ai_provider?: string | null;
  email_provider?: string | null;
  email_from?: string | null;
}

export interface Membership {
  id: string;
  role: Role;
  title?: string | null;
  status: string;
}

export interface AuthContext {
  user: User;
  org: Organization;
  membership: Membership;
  session: { id: string; csrf: string };
}

export interface JobAccess {
  job: any;
  level: 'manage' | 'edit' | 'view';
  jobRole: string | null;
}

export interface PortalContext {
  tokenId: string;
  organizationId: string;
  applicationId: string;
}
