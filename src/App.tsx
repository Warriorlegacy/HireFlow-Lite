import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { PublicShell } from './components/PublicShell';

// Pages
import { LandingPage, PricingPage } from './pages/landing';
import { LoginPage, AcceptInvitePage } from './pages/auth';
import { DashboardPage } from './pages/dashboard';
import { JobsPage, JobEditorPage, JobDetailPage } from './pages/jobs';
import { CandidatesPage } from './pages/candidates';
import { PipelinePage } from './pages/pipeline';
import { ApplicationPage } from './pages/application';
import { InterviewsPage, InterviewPage } from './pages/interviews';
import { AnalyticsPage } from './pages/analytics';
import { TemplatesPage } from './pages/templates';
import { ImportExportPage } from './pages/importexport';
import { TeamPage } from './pages/team';
import { SettingsPage } from './pages/settings';
import { PrivacyPage as WorkspacePrivacyPage } from './pages/privacy';
import { PrivacyPage as LegalPrivacyPage, TermsPage } from './pages/legal';
import { AuditPage } from './pages/audit';
import { CareersPage, CareerJobPage, CareerApplyPage } from './pages/careers';
import { PortalPage } from './pages/portal';
import { NotFoundPage } from './pages/notfound';

const ProtectedLayout: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-xs font-mono text-muted">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-white font-mono text-xs animate-pulse">
            H
          </div>
          <span>Verifying workspace session...</span>
        </div>
      </div>
    );
  }

  if (!session?.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
};

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public marketing / careers */}
      <Route element={<PublicShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/careers/:slug" element={<CareerJobPage />} />
        <Route path="/careers/:slug/apply" element={<CareerApplyPage />} />
        <Route path="/privacy" element={<LegalPrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Route>

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      {/* Candidate portal */}
      <Route path="/portal/:token" element={<PortalPage />} />

      {/* Authenticated workspace */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/new" element={<JobEditorPage mode="new" />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/jobs/:id/edit" element={<JobEditorPage mode="edit" />} />
        <Route path="/candidates" element={<CandidatesPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/applications/:id" element={<ApplicationPage />} />
        <Route path="/interviews" element={<InterviewsPage />} />
        <Route path="/interviews/:id" element={<InterviewPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/import-export" element={<ImportExportPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy-requests" element={<WorkspacePrivacyPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;