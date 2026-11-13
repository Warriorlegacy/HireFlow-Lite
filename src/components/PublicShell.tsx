import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PublicShell() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule/80">
        <div className="mx-auto flex h-[64px] max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5" aria-label="HireFlow Lite home">
            <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-white">
              <span className="font-display text-[15px] leading-none">H</span>
            </span>
            <span className="font-display text-[18px] tracking-[-0.01em] text-ink">HireFlow</span>
            <span className="rounded-[3px] border border-rule px-1 py-0.5 font-mono text-[9px] text-muted">lite</span>
          </Link>
          <nav className="flex items-center gap-1 text-[13.5px]">
            <NavLink to="/careers" className={({ isActive }) => `rounded-md px-2.5 py-1.5 ${isActive ? 'text-accent' : 'text-graphite hover:bg-subtle'}`}>
              Careers
            </NavLink>
            <NavLink to="/pricing" className={({ isActive }) => `hidden rounded-md px-2.5 py-1.5 sm:block ${isActive ? 'text-accent' : 'text-graphite hover:bg-subtle'}`}>
              Pricing
            </NavLink>
            {session?.authenticated ? (
              <Link to="/dashboard" className="ml-2 rounded-md bg-accent px-3 py-1.5 font-medium text-white hover:bg-accentDark">
                Open workspace
              </Link>
            ) : (
              <Link to="/login" className="ml-2 rounded-md border border-rule bg-surface px-3 py-1.5 font-medium text-ink hover:bg-subtle">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="mt-16 border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-muted">HireFlow Lite · a small, careful applicant tracker.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-graphite">
            <Link to="/careers" className="hover:text-ink">Careers</Link>
            <Link to="/privacy" className="hover:text-ink">Privacy</Link>
            <Link to="/terms" className="hover:text-ink">Terms</Link>
            <a href="/llms.txt" className="hover:text-ink">llms.txt</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
