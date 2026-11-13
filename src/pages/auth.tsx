import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { Button, Field, Input } from '../components/ui';

const DEMO_ACCOUNTS = [
  { email: 'owner@hireflow.demo', label: 'Owner', name: 'Ananya Rao' },
  { email: 'recruiter@hireflow.demo', label: 'Recruiter', name: 'Priya Nair' },
  { email: 'manager@hireflow.demo', label: 'Hiring manager', name: 'Daniel Cho' },
  { email: 'interviewer@hireflow.demo', label: 'Interviewer', name: 'Sofia Lind' },
];

export function LoginPage() {
  const { session, login, demoSwitch } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('owner@hireflow.demo');
  const [password, setPassword] = useState('DemoPass123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState('');

  useEffect(() => {
    if (session?.authenticated) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(target: string) {
    setSwitching(target);
    setError('');
    try {
      await demoSwitch(target);
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSwitching('');
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col justify-between px-5 py-8 sm:px-10 lg:px-14">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-white">
            <span className="font-display text-[15px] leading-none">H</span>
          </span>
          <span className="font-display text-[18px] text-ink">HireFlow</span>
          <span className="rounded-[3px] border border-rule px-1 py-0.5 font-mono text-[9px] text-muted">lite</span>
        </Link>

        <div className="mx-auto w-full max-w-[380px] py-12">
          <h1 className="font-display text-[30px] leading-tight text-ink">Sign in</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-graphite">
            This demo workspace uses synthetic candidate records. Every account below shares the same password.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Work email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && (
              <p className="rounded-md border border-negative/20 bg-negativeSoft px-3 py-2 text-[13px] text-negative" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" loading={busy} className="w-full">
              Sign in
            </Button>
          </form>

          <div className="mt-8 border-t border-rule pt-5">
            <p className="text-[12px] font-medium text-graphite">Or enter as a role</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  onClick={() => switchTo(account.email)}
                  disabled={Boolean(switching)}
                  className="flex flex-col rounded-md border border-rule bg-surface px-2.5 py-2 text-left transition-colors hover:border-accent/40 hover:bg-accentSoft/40 disabled:opacity-60"
                >
                  <span className="text-[12.5px] font-medium text-ink">{account.label}</span>
                  <span className="text-[11px] text-muted">{switching === account.email ? 'Opening…' : account.name}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted">
              <KeyRound size={12} /> Password for all demo accounts: <span className="font-mono text-[11px]">DemoPass123!</span>
            </p>
          </div>

          <p className="mt-6 text-[12.5px] text-muted">
            Have an invitation link? Open it directly — it sets your own password.
          </p>
        </div>

        <p className="text-[12px] text-muted">© {new Date().getFullYear()} HireFlow Lite. Synthetic data only.</p>
      </div>

      <div className="relative hidden border-l border-rule bg-[#f1ede3] lg:block">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="w-full max-w-[460px]">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-rule px-4 py-3">
                <div>
                  <p className="text-[12px] text-muted">Senior Product Designer</p>
                  <p className="text-[14px] font-medium text-ink">Pipeline · 4 candidates</p>
                </div>
                <span className="stamp">interview</span>
              </div>
              <div className="space-y-2.5 p-4">
                {[
                  { name: 'Lena Fischer', stage: 'Offer', tone: 'text-positive' },
                  { name: 'Maya Krishnan', stage: 'Interview', tone: 'text-accent' },
                  { name: 'Nadia Rahman', stage: 'Assessment', tone: 'text-graphite' },
                  { name: 'Hugo Silva', stage: 'New', tone: 'text-muted' },
                ].map((row) => (
                  <div key={row.name} className="flex items-center justify-between rounded-md border border-rule bg-surface px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-[10px] font-medium text-graphite">
                        {row.name.split(' ').map((p) => p[0]).join('')}
                      </span>
                      <span className="text-[13px] text-ink">{row.name}</span>
                    </div>
                    <span className={`font-mono text-[11px] ${row.tone}`}>{row.stage}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-rule px-4 py-3">
                <p className="text-[12px] leading-relaxed text-muted">
                  Every stage change records who moved it, when, and why. Resumes stay private.
                </p>
              </div>
            </div>
            <p className="mt-5 text-center font-mono text-[11px] text-muted">product preview · synthetic demo data</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) setError('This link is missing its invitation token. Ask an admin for a new link.');
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/auth/accept-invite', { body: { token, full_name: fullName, password } });
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-white">
            <span className="font-display text-[15px] leading-none">H</span>
          </span>
          <span className="font-display text-[18px] text-ink">HireFlow</span>
        </Link>
        <div className="card card-pad mt-8">
          <h1 className="font-display text-[26px] leading-tight text-ink">Join the workspace</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-graphite">
            Set your name and a password. This one-time link expires seven days after it was issued.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Full name" htmlFor="name" required>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required minLength={2} />
            </Field>
            <Field label="Password" htmlFor="new-password" hint="At least 10 characters." required>
              <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
            </Field>
            <Field label="Confirm password" htmlFor="confirm-password" required>
              <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={10} />
            </Field>
            {error && (
              <p className="rounded-md border border-negative/20 bg-negativeSoft px-3 py-2 text-[13px] text-negative" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!token}>
              Join workspace <ArrowRight size={15} />
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-[12px] text-muted">
          Already have an account? <Link to="/login" className="text-accent underline underline-offset-2">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
