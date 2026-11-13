import { useEffect, useState } from 'react';
import { Copy, Mail, Plus, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../components/ui';
import { formatDate, ROLE_LABELS } from '../lib/format';
import type { Invitation, TeamMember } from '../types';

const ASSIGNABLE = ['admin', 'recruiter', 'hiring_manager', 'interviewer'] as const;

export function TeamPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', role: 'recruiter', title: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [busyUser, setBusyUser] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ members: TeamMember[]; invitations: Invitation[]; can_manage: boolean }>('/team');
      setMembers(data.members);
      setInvitations(data.invitations);
      setCanManage(data.can_manage);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function sendInvite(e?: React.FormEvent) {
    e?.preventDefault();
    if (!invite.email.trim()) {
      push('Enter the work email address.', 'error');
      return;
    }
    setInviting(true);
    try {
      const data = await api<{ invite_url: string; note: string }>('/team/invite', {
        body: { email: invite.email.trim(), role: invite.role, title: invite.title.trim() || null },
      });
      setInviteLink(data.invite_url);
      setInvite({ email: '', role: 'recruiter', title: '' });
      push('Invitation created. Email is not configured, so share the link directly.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setInviting(false);
    }
  }

  async function changeMember(member: TeamMember, patch: { role?: string; status?: string }) {
    setBusyUser(member.user_id);
    try {
      await api(`/team/members/${member.user_id}`, { method: 'PATCH', body: patch });
      push('Member updated.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusyUser('');
    }
  }

  async function revoke(invitation: Invitation) {
    try {
      await api(`/team/invite/${invitation.id}/revoke`, { method: 'POST' });
      push('Invitation revoked.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  }

  async function remove() {
    if (!removeTarget) return;
    setBusyUser(removeTarget.user_id);
    try {
      await api(`/team/members/${removeTarget.user_id}`, { method: 'DELETE' });
      push('Member disabled and signed out.');
      setRemoveTarget(null);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusyUser('');
    }
  }

  if (loading) return <><PageHeader title="Team" /><LoadingBlock rows={5} /></>;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  const activeCount = members.filter((m) => m.status === 'active').length;

  return (
    <>
      <PageHeader
        title="Team"
        description={`${activeCount} active ${activeCount === 1 ? 'person' : 'people'} in ${session?.org?.name}. Roles determine what each person can see and change.`}
        actions={canManage ? <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setInviteLink(''); setInviteOpen(true); }}>Invite person</Button> : undefined}
      />

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base min-w-[840px]">
            <thead>
              <tr>
                <th className="pl-5">Person</th>
                <th>Workspace role</th>
                <th>Title</th>
                <th>Role access</th>
                <th>Upcoming interviews</th>
                <th>Status</th>
                <th className="pr-5" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.user_id === session?.user?.id;
                return (
                  <tr key={member.id} className={member.status === 'disabled' ? 'opacity-60' : undefined}>
                    <td className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.full_name} size={28} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink">
                            {member.full_name} {isSelf && <span className="text-[11px] font-normal text-muted">(you)</span>}
                          </p>
                          <p className="truncate text-[11.5px] text-muted">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {canManage && !isSelf ? (
                        <Select
                          value={member.role}
                          aria-label={`Role for ${member.full_name}`}
                          disabled={busyUser === member.user_id}
                          onChange={(e) => changeMember(member, { role: e.target.value })}
                          className="h-8 py-0 text-[12px]"
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="recruiter">Recruiter</option>
                          <option value="hiring_manager">Hiring manager</option>
                          <option value="interviewer">Interviewer</option>
                        </Select>
                      ) : (
                        <Badge tone={member.role === 'owner' ? 'accent' : 'neutral'}>{ROLE_LABELS[member.role] || member.role}</Badge>
                      )}
                    </td>
                    <td className="text-[12.5px] text-graphite">{member.title || '—'}</td>
                    <td className="text-[12px] text-muted">
                      {member.jobs.length === 0 ? 'Workspace-wide' : `${member.jobs.length} role${member.jobs.length === 1 ? '' : 's'}`}
                    </td>
                    <td className="font-mono text-[12px] text-graphite">{member.upcoming_interviews}</td>
                    <td>
                      <Badge tone={member.status === 'active' ? 'success' : 'neutral'}>{member.status === 'active' ? 'Active' : 'Disabled'}</Badge>
                    </td>
                    <td className="pr-5 text-right">
                      {canManage && !isSelf && member.role !== 'owner' && (
                        <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(member)} aria-label={`Remove ${member.full_name}`}>
                          <UserX size={13} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-5">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-medium text-ink">Pending invitations</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">Invitations expire after seven days. Email is not configured, so links are shared manually.</p>
          </div>
          <Badge>{invitations.length}</Badge>
        </div>
        {invitations.length === 0 ? (
          <EmptyState title="No pending invitations" icon={<Mail size={18} />}>
            Invite a recruiter, hiring manager or interviewer when you are ready for them to join.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink">{invitation.email}</p>
                  <p className="text-[11.5px] text-muted">
                    {ROLE_LABELS[invitation.role] || invitation.role} · expires {formatDate(invitation.expires_at)}
                  </p>
                </div>
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => revoke(invitation)} icon={<Trash2 size={13} />}>Revoke</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5 rounded-card border border-rule bg-[#f4f0e6] p-4">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="text-[12.5px] font-medium text-ink">How access works</p>
            <p className="mt-1 text-[12px] leading-relaxed text-graphite">
              Owners and admins manage the workspace. Recruiters see the roles they are added to. Hiring managers get read access to their role and can record decisions.
              Interviewers never see the pipeline: only the interview packets they are assigned, without resumes or contact details.
            </p>
          </div>
        </div>
      </section>

      <Modal
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteLink(''); }}
        title="Invite a teammate"
        description="They set their own password through a one-time link. You choose their workspace role now; role-level access is added on each role."
        footer={
          inviteLink ? (
            <Button variant="primary" onClick={() => { setInviteOpen(false); setInviteLink(''); }}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={inviting} onClick={sendInvite} icon={<Mail size={14} />}>Create invitation</Button>
            </>
          )
        }
      >
        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-graphite">
              Share this link directly with your teammate. It is shown once and expires in seven days.
            </p>
            <div className="rounded-md border border-rule bg-paper/70 p-3">
              <p className="break-all font-mono text-[11.5px] text-graphite">{inviteLink}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                icon={copied ? <ShieldCheck size={13} /> : <Copy size={13} />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    push('Copy failed. Select the link and copy it manually.', 'error');
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <p className="text-[11.5px] text-muted">Email delivery is not configured.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={sendInvite} className="space-y-4" id="invite-form">
            <Field label="Work email" required>
              <Input type="email" value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))} placeholder="name@company.com" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workspace role" hint="Can be changed later.">
                <Select value={invite.role} onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value }))}>
                  {ASSIGNABLE.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </Select>
              </Field>
              <Field label="Title" hint="Optional.">
                <Input value={invite.title} onChange={(e) => setInvite((i) => ({ ...i, title: e.target.value }))} placeholder="Talent partner" />
              </Field>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title={`Disable ${removeTarget?.full_name || 'this member'}?`}
        description="They are signed out immediately and cannot sign in again. Their audit history and recorded decisions are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Keep access</Button>
            <Button variant="danger" loading={busyUser === removeTarget?.user_id} onClick={remove}>Disable member</Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-graphite">
          Disabling is reversible by an owner or admin through this page. Removing an owner is blocked until ownership is transferred.
        </p>
      </Modal>
    </>
  );
}
