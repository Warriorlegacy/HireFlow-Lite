import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { Badge, Button } from '../components/ui';

/* -------------------------------------------------------------------------- */
/* Product visual: a real, static rendering of the workspace UI               */
/* -------------------------------------------------------------------------- */
function WorkspacePreview() {
  const columns = [
    {
      name: 'New',
      count: 3,
      cards: [
        { name: 'Hugo Silva', role: 'Senior Product Designer', note: 'Applied 2h ago', source: 'careers page' },
        { name: 'Ira Banerjee', role: 'Staff Engineer', note: 'Referred by Sam', source: 'referral' },
      ],
    },
    {
      name: 'Interview',
      count: 2,
      cards: [
        { name: 'Maya Krishnan', role: 'Senior Product Designer', note: 'Craft interview · 18 Nov', source: 'careers page' },
        { name: 'Tomas Weber', role: 'Staff Engineer', note: 'System design · 19 Nov', source: 'linkedin' },
      ],
    },
    {
      name: 'Offer',
      count: 1,
      cards: [{ name: 'Lena Fischer', role: 'Senior Product Designer', note: 'Offer sent · awaiting reply', source: 'referral' }],
    },
  ];

  return (
    <div className="overflow-hidden rounded-panel border border-rule bg-surface shadow-lift">
      <div className="flex items-center gap-2 border-b border-rule bg-[#f1ede3] px-3.5 py-2.5">
        <span className="h-2 w-2 rounded-full bg-rule" />
        <span className="h-2 w-2 rounded-full bg-rule" />
        <span className="h-2 w-2 rounded-full bg-rule" />
        <span className="ml-2 truncate font-mono text-[10px] text-muted">hireflow · senior product designer · pipeline</span>
      </div>
      <div className="grid grid-cols-[150px_1fr]">
        <div className="hidden border-r border-rule bg-[#faf8f3] p-3 sm:block">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-accent text-white"><span className="font-display text-[13px] leading-none">H</span></span>
            <span className="font-display text-[14px] text-ink">HireFlow</span>
          </div>
          <div className="space-y-0.5">
            {[
              ['Dashboard', false],
              ['Roles', true],
              ['Candidates', false],
              ['Interviews', false],
            ].map(([label, active]) => (
              <p key={String(label)} className={`rounded px-2 py-1 text-[10.5px] ${active ? 'bg-accentSoft font-medium text-accentDark' : 'text-graphite'}`}>{label}</p>
            ))}
          </div>
          <div className="mt-5 border-t border-rule pt-3">
            <p className="text-[9.5px] text-muted">Fieldnote Labs</p>
            <p className="mt-0.5 text-[9.5px] text-muted">5 roles · 6 people</p>
          </div>
        </div>
        <div className="p-3">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-display text-[17px] leading-tight text-ink">Senior Product Designer</p>
              <p className="mt-0.5 text-[10px] text-muted">Design · Hybrid · Bengaluru · 8 active</p>
            </div>
            <span className="stamp text-[9.5px]">interview</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {columns.map((column) => (
              <div key={column.name} className="rounded-md border border-rule bg-[#f4f1e9]/70 p-1.5">
                <div className="flex items-center justify-between px-0.5 pb-1.5">
                  <p className="text-[9.5px] font-medium text-ink">{column.name}</p>
                  <p className="font-mono text-[9px] text-muted">{column.count}</p>
                </div>
                <div className="space-y-1.5">
                  {column.cards.map((card) => (
                    <div key={card.name} className="rounded border border-rule bg-surface p-1.5">
                      <p className="truncate text-[9.5px] font-medium text-ink">{card.name}</p>
                      <p className="mt-0.5 truncate text-[8.5px] text-muted">{card.role}</p>
                      <div className="mt-1 flex items-center justify-between gap-1 border-t border-rule/60 pt-1">
                        <span className="truncate text-[8px] text-muted">{card.note}</span>
                        <span className="shrink-0 font-mono text-[7.5px] text-accent">{card.source}</span>
                      </div>
                    </div>
                  ))}
                  {column.cards.length < column.count && (
                    <div className="rounded border border-dashed border-rule px-1.5 py-1.5 text-center text-[8px] text-muted">
                      {column.count - column.cards.length} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2 rounded-md border border-rule bg-[#faf8f3] px-2 py-1.5">
            <ClipboardList size={11} className="text-accent" />
            <p className="text-[8.5px] text-graphite">Maya Krishnan moved to Interview by Priya Nair · reason recorded</p>
            <p className="ml-auto shrink-0 font-mono text-[7.5px] text-muted">2h ago</p>
          </div>
        </div>
      </div>
      <div className="border-t border-rule px-3.5 py-1.5">
        <p className="font-mono text-[8.5px] text-muted">synthetic demo data · no real candidates</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Landing                                                                    */
/* -------------------------------------------------------------------------- */
export function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-14 pt-12 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_1fr] lg:gap-14">
          <div>
            <p className="eyebrow">Applicant tracking for small hiring teams</p>
            <h1 className="mt-3 max-w-[15ch] font-display text-[42px] leading-[1.04] tracking-[-0.015em] text-ink sm:text-[58px]">
              A hiring desk, not a funnel.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[15.5px] leading-[1.7] text-graphite">
              HireFlow Lite keeps a few open roles legible. Publish a role, collect applications, move people through a clear
              pipeline, and leave a record of every decision. No ranking engine, no black box.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Link to="/login">
                <Button variant="primary" icon={<ArrowRight size={15} />}>Open the demo workspace</Button>
              </Link>
              <Link to="/careers">
                <Button>See the candidate experience</Button>
              </Link>
            </div>

            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
              <span className="inline-flex items-center gap-1.5"><Lock size={11} /> Private resumes</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={11} /> Retention built in</span>
              <span>Synthetic demo data</span>
            </p>
          </div>

          <WorkspacePreview />
        </div>
      </section>

      <section className="border-y border-rule bg-[#f1ede3]">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3">
          {[
            { icon: FileText, title: 'A real application record', body: 'Resume, answers, consent version, source and owner live on one application, not scattered across inboxes.' },
            { icon: ClipboardList, title: 'A history you can read', body: 'Every stage change stores who moved it, when, and why. History is append-only, including withdrawals.' },
            { icon: ShieldCheck, title: 'Privacy with a clock', body: 'Retention turns into anonymisation, not a policy nobody runs. Candidate requests have a review path.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule bg-surface text-accent">
                <item.icon size={15} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-[13.5px] font-medium text-ink">{item.title}</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-graphite">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="max-w-2xl">
          <p className="eyebrow">The work, in order</p>
          <h2 className="mt-2 font-display text-[32px] leading-tight text-ink sm:text-[38px]">Four steps, each with an artifact.</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-graphite">
            The product follows the hiring conversation rather than inventing a parallel process. Each step leaves something a person can check.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '01',
              title: 'Publish the role',
              body: 'A draft with description, salary range, deadline, application questions and a named hiring owner becomes a public careers page with JobPosting metadata.',
              artifact: 'Public URL + structured data',
              icon: FileText,
            },
            {
              step: '02',
              title: 'Read what arrived',
              body: 'Applications land in New with a validated resume, recorded consent and a source. Duplicate applications are refused at the door.',
              artifact: 'Application record + consent',
              icon: UserRound,
            },
            {
              step: '03',
              title: 'Interview with evidence',
              body: 'Schedule conversations, assign only the interviewers who need them, and collect anchored scorecards written by humans.',
              artifact: 'Packet + scorecard',
              icon: CalendarDays,
            },
            {
              step: '04',
              title: 'Decide and close',
              body: 'Move to offer, hired, rejected or withdrawn. Rejections require a reason. Candidates can follow the outcome from a private link.',
              artifact: 'Stage event + candidate status',
              icon: Check,
            },
          ].map((item) => (
            <article key={item.step} className="card flex flex-col p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted">{item.step}</span>
                <item.icon size={16} className="text-accent" strokeWidth={1.8} />
              </div>
              <h3 className="mt-4 font-display text-[20px] leading-tight text-ink">{item.title}</h3>
              <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-graphite">{item.body}</p>
              <p className="mt-4 border-t border-rule pt-2.5 font-mono text-[10px] text-muted">{item.artifact}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-rule bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow">Permissions that mean something</p>
            <h2 className="mt-2 font-display text-[30px] leading-tight text-ink sm:text-[36px]">Small teams still need boundaries.</h2>
            <p className="mt-3 max-w-[48ch] text-[14px] leading-relaxed text-graphite">
              Access is enforced on the server, at the workspace, role and application level. An interviewer's view is not the
              recruiter's view with a few buttons hidden.
            </p>
            <div className="mt-6 space-y-3">
              {[
                { role: 'Owner / admin', detail: 'Workspace settings, team, every role, audit log, exports, retention and privacy requests.' },
                { role: 'Recruiter', detail: 'The roles they are added to, plus applications and messages inside those roles.' },
                { role: 'Hiring manager', detail: 'Read access to their role and the ability to record a decision, but not bulk-edit the pipeline.' },
                { role: 'Interviewer', detail: 'Only assigned interview packets. No pipeline browsing, no resume, no other scorecards.' },
              ].map((row) => (
                <div key={row.role} className="flex gap-3 border-b border-rule/70 pb-3 last:border-0 last:pb-0">
                  <span className="w-[118px] shrink-0 font-mono text-[10.5px] text-accent">{row.role}</span>
                  <p className="text-[12.5px] leading-relaxed text-graphite">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-rule px-4 py-3">
              <div>
                <p className="text-[11px] text-muted">Interview packet</p>
                <p className="text-[13.5px] font-medium text-ink">Craft interview · Maya Krishnan</p>
              </div>
              <Badge tone="accent">Interviewer</Badge>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Candidate', 'Maya Krishnan'],
                  ['Role', 'Senior Product Designer'],
                  ['Stage', 'Interview'],
                  ['Applied', '4 Nov 2026'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-rule bg-paper/50 px-2.5 py-2">
                    <p className="text-[9.5px] text-muted">{label}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-rule px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-ink">Product judgement</p>
                  <p className="font-mono text-[9.5px] text-muted">1–5</p>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">Evidence: described how they cut scope on a launch without losing the core workflow.</p>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-rule bg-[#faf8f3] px-2.5 py-2">
                <X size={12} className="text-muted" />
                <p className="text-[10px] text-muted">Resume, email and other interviewers' notes are withheld.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Candidate side</p>
            <h2 className="mt-2 font-display text-[30px] leading-tight text-ink sm:text-[36px]">Not a void after “submit”.</h2>
            <p className="mt-3 max-w-[44ch] text-[14px] leading-relaxed text-graphite">
              Each application gets a private, expiring status link. Candidates see their stage, scheduled interviews and messages
              sent to them. They can withdraw, withdraw consent, or ask for a correction or deletion.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                'No account or password to check status',
                'Withdrawal writes a proper stage event',
                'Data requests create a reviewable record',
                'Resumes and internal notes are never exposed',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-[13px] text-graphite">
                  <Check size={14} className="mt-0.5 shrink-0 text-accent" /> {line}
                </li>
              ))}
            </ul>
            <Link to="/careers" className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
              Open the live careers page <ArrowRight size={14} />
            </Link>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-rule bg-[#f1ede3] px-4 py-3">
              <p className="font-mono text-[10px] text-muted">private status link</p>
              <p className="mt-1 text-[14px] font-medium text-ink">Your application · Senior Product Designer</p>
            </div>
            <ol className="px-5 py-4">
              {[
                ['Applied', '4 Nov', true],
                ['Screening', '6 Nov', true],
                ['Interview', '12 Nov', true],
                ['Decision', 'Pending', false],
              ].map(([stage, date, done], index, list) => (
                <li key={String(stage)} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < list.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-rule" aria-hidden />}
                  <span className={`mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 ${done ? 'border-accent bg-paper' : 'border-rule bg-paper'}`} aria-hidden />
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <p className={`text-[12.5px] ${done ? 'text-ink' : 'text-muted'}`}>{stage}</p>
                    <p className="font-mono text-[10px] text-muted">{date}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-rule px-4 py-3">
              <p className="flex items-center gap-1.5 text-[10.5px] text-muted"><Mail size={11} /> Messages are shown with their real delivery state.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-rule bg-[#f1ede3]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Questions worth asking</p>
              <h2 className="mt-2 font-display text-[30px] leading-tight text-ink sm:text-[36px]">The honest version.</h2>
            </div>
            <Link to="/pricing" className="text-[13px] text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">See the pilot terms</Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                q: 'Who is HireFlow Lite for?',
                a: 'Startups and boutique recruiters hiring a handful of roles at a time. It is deliberately smaller than an enterprise HRIS: publication, application intake, a transparent pipeline, interviews, scorecards, and candidate status.',
              },
              {
                q: 'Can an interviewer see every candidate?',
                a: 'No. Interviewers only receive the packet for interviews they are assigned to, with the candidate fields needed for that conversation. They cannot browse the pipeline, read other interviews, or see internal feedback.',
              },
              {
                q: 'Does HireFlow Lite rank or reject candidates automatically?',
                a: 'No. There is no automated ranking, scoring, or rejection path. Scorecards require a human interviewer, AI assistance is off by default, and every stage change records who made it and why.',
              },
              {
                q: 'How are resumes protected?',
                a: 'Resumes are never public. Uploads are validated by file signature, stored privately, and served only through authenticated, permission-checked downloads that are written to the audit log.',
              },
            ].map((item) => (
              <article key={item.q} className="card p-5">
                <h3 className="text-[14px] font-medium leading-snug text-ink">{item.q}</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-graphite">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex flex-col items-start justify-between gap-5 rounded-panel border border-rule bg-surface px-6 py-7 sm:flex-row sm:items-center sm:px-8">
          <div>
            <h2 className="font-display text-[26px] leading-tight text-ink">Try the whole flow with synthetic data.</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-graphite">
              Six personas, five roles, twelve applications. Nothing here is a real candidate.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/login"><Button variant="primary" icon={<ArrowRight size={15} />}>Open workspace</Button></Link>
            <Link to="/careers"><Button>Visit careers</Button></Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */
export function PricingPage() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
      <p className="eyebrow">Pilot terms</p>
      <h1 className="mt-2 max-w-[20ch] font-display text-[38px] leading-[1.06] text-ink sm:text-[46px]">One workspace. No invented tiers.</h1>
      <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-graphite">
        HireFlow Lite is in a free pilot while the product is validated with real hiring teams. There is no billing integration yet, so
        nothing on this page charges a card or promises a paid plan that does not exist.
      </p>

      <div className="mt-9 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-6 py-4">
            <div>
              <h2 className="font-display text-[22px] text-ink">Pilot workspace</h2>
              <p className="mt-0.5 text-[12px] text-muted">Full product, synthetic or your own data.</p>
            </div>
            <p className="font-display text-[34px] leading-none text-ink">₹0</p>
          </div>
          <div className="grid gap-x-8 gap-y-3 px-6 py-5 sm:grid-cols-2">
            {[
              'Up to 5 published roles',
              'Up to 10 active seats',
              'Up to 100 applications a month',
              'Public careers page and intake',
              'Pipeline with immutable stage history',
              'Interview packets and human scorecards',
              'Candidate status links',
              'CSV import and export',
              'Retention and anonymisation',
              'Audit log with hash chain',
            ].map((line) => (
              <p key={line} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-graphite">
                <Check size={14} className="mt-0.5 shrink-0 text-accent" /> {line}
              </p>
            ))}
          </div>
          <div className="border-t border-rule px-6 py-4">
            <p className="text-[11.5px] leading-relaxed text-muted">
              These are pilot guidance levels, not enforced billing limits. A future paid plan will be announced before any limit is enforced.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-display text-[19px] text-ink">What is not included</h2>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-graphite">
              <li className="flex items-start gap-2"><X size={13} className="mt-0.5 shrink-0 text-muted" /> Card payments and subscriptions</li>
              <li className="flex items-start gap-2"><X size={13} className="mt-0.5 shrink-0 text-muted" /> Email delivery unless a provider key is configured</li>
              <li className="flex items-start gap-2"><X size={13} className="mt-0.5 shrink-0 text-muted" /> Payroll, HRIS or background-check integrations</li>
              <li className="flex items-start gap-2"><X size={13} className="mt-0.5 shrink-0 text-muted" /> Automated candidate ranking or rejection</li>
              <li className="flex items-start gap-2"><X size={13} className="mt-0.5 shrink-0 text-muted" /> Enterprise SSO or custom data-residency contracts</li>
            </ul>
          </div>
          <div className="rounded-card border border-rule bg-[#f4f0e6] p-5">
            <p className="text-[12.5px] font-medium text-ink">Why this page exists</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-graphite">
              A pricing page should state a real offer. While the product is free, the honest price is zero. When that changes, this page
              and the structured data will change with it.
            </p>
          </div>
          <Link to="/login"><Button variant="primary" className="w-full" icon={<ArrowRight size={15} />}>Open the demo workspace</Button></Link>
        </div>
      </div>
    </section>
  );
}
