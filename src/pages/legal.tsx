import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Lock } from 'lucide-react';
import { Badge } from '../components/ui';

function LegalLayout({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-[210px_1fr] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-display text-[32px] leading-tight text-ink sm:text-[38px]">{title}</h1>
          <p className="mt-3 font-mono text-[10.5px] text-muted">Last updated {updated}</p>
          <div className="mt-5 rounded-card border border-rule bg-[#f4f0e6] p-3.5">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
              <Lock size={12} /> Plain-language summary
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-graphite">
              This is the product's baseline notice. A deploying organisation must review it, replace the contact details, and make it
              match its own jurisdiction before using HireFlow Lite with real candidates.
            </p>
          </div>
        </aside>
        <div className="prose-hf min-w-0">{children}</div>
      </div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Privacy" title="Privacy notice" updated="14 November 2026">
      <p>
        HireFlow Lite is applicant-tracking software. This page explains what the product stores, why, how long it keeps it, and what a
        candidate can ask for. The workspace you are applying to is the data controller for your application; the software operator
        processes it on their behalf.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, email address, phone number and location.</li>
        <li>Links you choose to share, such as a portfolio or LinkedIn profile.</li>
        <li>Your resume file, cover note and answers to role-specific questions.</li>
        <li>Interview times, interviewers assigned to you, and notes written by the hiring team.</li>
        <li>The source that brought you to the role, and the version of this notice you accepted.</li>
        <li>Technical request data needed to operate and secure the service, such as IP address in audit entries.</li>
      </ul>

      <h2>Why we process it</h2>
      <p>
        To review your application for the role you applied to, arrange interviews, communicate with you, keep an auditable record of
        hiring decisions, and meet legal obligations. We do not use your data to train a ranking model, and the product does not make
        automated rejection decisions.
      </p>

      <h2>Who can see it</h2>
      <p>
        Access is limited by role. Recruiters and hiring managers assigned to the role can read your application. Interviewers receive a
        reduced packet for the interviews they are assigned to: they do not see your resume, contact details or other interviewers'
        scorecards. Workspace owners and admins can access workspace records for administration, audit and privacy requests.
      </p>

      <h2>Where it is stored</h2>
      <p>
        Application records are stored in Cloudflare D1. Resume files are stored privately in Cloudflare R2 where that binding is
        enabled, or in a private D1 table on deployments without R2. Resumes are served only through authenticated, permission-checked
        downloads. The current deployment does not use R2 because it is not enabled on the account.
      </p>

      <h2>How long we keep it</h2>
      <p>
        The default retention window is 365 days from the application date. When it expires, the application is anonymised: your name,
        contact details, answers, resume and message bodies are removed or replaced. Stage history and audit entries remain, linked to
        an anonymous record, because the hiring team must be able to show how a decision was made. A workspace can configure a different
        window between 30 and 3650 days.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Use the private status link in your acknowledgement to see your stage and interviews.</li>
        <li>Withdraw your application, which records a withdrawal and stops further processing for that role.</li>
        <li>Withdraw consent for future processing where consent is the basis.</li>
        <li>Ask for a correction or deletion. The hiring team receives a reviewable request and must record its decision.</li>
      </ul>
      <p>
        Deletion is not absolute: the workspace may need to retain a minimal record to demonstrate compliance, resolve a dispute, or meet
        a legal obligation. Where that applies, the request is declined with a written reason.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed with PBKDF2-SHA256. Sessions are HTTP-only cookies with CSRF protection on state-changing requests. Sensitive
        actions are written to an append-only audit log with a hash chain. Uploads are validated by file signature, not just extension.
        The service applies a restrictive Content Security Policy and does not inline third-party scripts.
      </p>

      <h2>Contact</h2>
      <p>
        For a demo or pilot deployment, use the contact address configured by the workspace. In this synthetic demo, no real candidate
        data is present, so there is nothing personal to request. Do not submit real personal data to the public demo.
      </p>

      <div className="mt-8 rounded-card border border-rule bg-[#f4f0e6] p-4">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink"><FileText size={14} /> Deployment note</p>
        <p className="mt-1 text-[12px] leading-relaxed text-graphite">
          Replace this baseline notice with a reviewed policy that names the controller, its address, a contact channel, the lawful basis
          for each processing purpose, and any local rights or retention requirements before going live with real candidates.
        </p>
      </div>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout eyebrow="Terms" title="Terms of use" updated="14 November 2026">
      <p>
        These terms cover use of the HireFlow Lite demo and pilot deployment. By using the workspace you agree to use it lawfully and not
        to enter data you have no right to process.
      </p>

      <h2>Demo data</h2>
      <p>
        The public demo contains synthetic organisations, roles and candidates. Names, emails, resumes and outcomes are invented. Do not
        treat demo records as real people or real hiring evidence. Do not submit real candidate data to the public demo.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to access records outside your role or workspace.</li>
        <li>Do not upload malware, executable files or content you lack permission to store.</li>
        <li>Do not use the product to make automated hiring decisions or to build a ranking model from candidate data.</li>
        <li>Do not scrape, resell or redistribute candidate data.</li>
        <li>Do not probe, overload or bypass rate limits, authentication or security controls.</li>
      </ul>

      <h2>Your responsibilities</h2>
      <p>
        If you use the product to hire, you are responsible for the lawful basis for processing, for the privacy notice you present, for
        responding to candidate requests, and for the decisions your team records. HireFlow Lite provides the workflow and the record, not
        legal advice.
      </p>

      <h2>Availability and changes</h2>
      <p>
        The pilot is provided as-is while the product is validated. Features, limits and availability may change. There is no uptime
        guarantee, support SLA or billing relationship in the pilot. The product may suspend a workspace that abuses the service or
        creates a security or legal risk.
      </p>

      <h2>No automated decisions</h2>
      <p>
        The product does not rank candidates, predict performance, or reject anyone automatically. Scorecards are written and submitted by
        named interviewers, and stage changes require a person with permission. AI assistance is off by default and cannot be enabled
        without a configured provider.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, the pilot is provided without warranties, and the operator is not liable for hiring outcomes or for
        data a workspace was not entitled to process.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms should go to the workspace owner who invited you. For the demo deployment, use the contact channel
        published on the landing page.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link to="/privacy" className="inline-flex items-center gap-1.5 text-[13px] text-accent underline underline-offset-2">
          Privacy notice <ArrowRight size={13} />
        </Link>
        <Badge>Synthetic demo</Badge>
      </div>
    </LegalLayout>
  );
}
