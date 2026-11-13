import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar, Button } from './ui';
import { ROLE_LABELS } from '../lib/format';
import type { Role } from '../types';

const NAV: { section: string; roles: Role[] | 'all'; items: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }[] }[] = [
  {
    section: 'Hiring',
    roles: 'all',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/jobs', label: 'Roles', icon: Briefcase },
      { to: '/candidates', label: 'Candidates', icon: Users },
      { to: '/interviews', label: 'Interviews', icon: CalendarDays },
    ],
  },
  {
    section: 'Review',
    roles: ['owner', 'admin', 'recruiter', 'hiring_manager'],
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/templates', label: 'Messages', icon: MessageSquare },
      { to: '/import-export', label: 'Import & export', icon: Database },
    ],
  },
  {
    section: 'Workspace',
    roles: ['owner', 'admin'],
    items: [
      { to: '/team', label: 'Team', icon: Users },
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/privacy-requests', label: 'Privacy requests', icon: Shield },
      { to: '/audit', label: 'Audit log', icon: ClipboardList },
    ],
  },
];

const DEMO_PEOPLE = [
  { email: 'owner@hireflow.demo', name: 'Ananya Rao', role: 'Owner' },
  { email: 'recruiter@hireflow.demo', name: 'Priya Nair', role: 'Recruiter' },
  { email: 'manager@hireflow.demo', name: 'Daniel Cho', role: 'Hiring manager' },
  { email: 'interviewer@hireflow.demo', name: 'Sofia Lind', role: 'Interviewer' },
  { email: 'admin@hireflow.demo', name: 'Marcus Bell', role: 'Admin' },
];

export function AppShell() {
  const { session, logout, demoSwitch } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const role = session?.membership?.role || 'interviewer';

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const nav = NAV.filter((group) => group.roles === 'all' || group.roles.includes(role)).map((group) => ({
    ...group,
    items: role === 'interviewer' ? group.items.filter((i) => ['/dashboard', '/interviews'].includes(i.to)) : group.items,
  }));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[62px] items-center justify-between px-5">
        <NavLink to="/dashboard" className="flex items-center gap-2.5" aria-label="HireFlow Lite home">
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-white">
            <span className="font-display text-[15px] leading-none">H</span>
          </span>
          <span className="font-display text-[18px] tracking-[-0.01em] text-ink">HireFlow</span>
          <span className="rounded-[3px] border border-rule px-1 py-0.5 font-mono text-[9px] text-muted">lite</span>
        </NavLink>
        <button className="rounded p-1.5 text-muted hover:bg-subtle lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Workspace">
        {nav.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="mb-1.5 px-2.5 text-[11px] font-medium text-muted">{group.section}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  <item.icon size={15.5} strokeWidth={1.8} aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        <div className="mx-2 mt-6 rounded-card border border-rule bg-[#f3efe5] p-3">
          <p className="font-mono text-[10.5px] text-muted">demo workspace</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-graphite">
            Synthetic data for Fieldnote Labs. No real candidate information is stored.
          </p>
        </div>
      </nav>

      <div className="border-t border-rule px-3 py-3">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-subtle/70"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <Avatar name={session?.user?.full_name || ''} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{session?.user?.full_name}</span>
              <span className="block truncate text-[11.5px] text-muted">{ROLE_LABELS[role] || role}</span>
            </span>
            <ChevronDown size={14} className="text-muted" aria-hidden />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-card border border-rule bg-surface py-1 shadow-lift" role="menu">
              <div className="border-b border-rule px-3 pb-2 pt-1.5">
                <p className="text-[12px] text-muted">{session?.user?.email}</p>
                <p className="mt-0.5 text-[12px] text-muted">{session?.org?.name}</p>
              </div>
              <div className="px-2 pt-1.5">
                <p className="px-1 pb-1 text-[11px] text-muted">Switch demo persona</p>
                {DEMO_PEOPLE.filter((p) => p.email !== session?.user?.email).map((person) => (
                  <button
                    key={person.email}
                    className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1.5 text-left text-[12.5px] text-graphite hover:bg-subtle"
                    role="menuitem"
                    onClick={async () => {
                      await demoSwitch(person.email);
                      navigate('/dashboard');
                      setMenuOpen(false);
                    }}
                  >
                    <span>{person.name}</span>
                    <span className="text-[11px] text-muted">{person.role}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1 border-t border-rule px-2 pt-1">
                <button
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left text-[12.5px] text-graphite hover:bg-subtle"
                  role="menuitem"
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-rule bg-surface/70 lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[264px] border-r border-rule bg-surface">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-[54px] items-center gap-3 border-b border-rule bg-paper/95 px-4 backdrop-blur sm:px-6 lg:hidden">
          <button className="rounded p-1.5 text-graphite hover:bg-subtle" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={19} />
          </button>
          <span className="font-display text-[17px] text-ink">HireFlow</span>
          <span className="ml-auto text-[12px] text-muted">{session?.org?.name}</span>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function SettingsLink() {
  return (
    <Button size="sm" variant="ghost" icon={<FileText size={14} />} onClick={() => (window.location.href = '/settings')}>
      Settings
    </Button>
  );
}
