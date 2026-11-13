import type { Db } from './db';
import { newId } from './crypto';

export interface EmailResult {
  status: 'sent' | 'failed' | 'not_configured';
  provider: string | null;
  providerMessageId?: string | null;
  error?: string | null;
}

/**
 * Optional email adapter. It never claims delivery. When no provider is
 * configured the caller persists the message as a logged communication and
 * the UI states that nothing was sent.
 */
export async function sendEmail(
  env: any,
  input: { to: string; subject: string; text: string; from?: string | null },
): Promise<EmailResult> {
  const apiKey = env?.RESEND_API_KEY;
  const from = input.from || env?.EMAIL_FROM;
  if (!apiKey || !from) {
    return {
      status: 'not_configured',
      provider: null,
      error: 'No email provider configured. Message saved to the application log only.',
    };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: 'failed', provider: 'resend', error: `Provider rejected the message (${res.status}).` };
    }
    return { status: 'sent', provider: 'resend', providerMessageId: json?.id || null };
  } catch {
    return { status: 'failed', provider: 'resend', error: 'Provider request failed. The message was not sent.' };
  }
}

export async function logCommunication(
  db: Db,
  input: {
    orgId: string;
    applicationId: string;
    templateId?: string | null;
    channel: 'email' | 'in_app';
    toEmail: string;
    subject: string;
    body: string;
    result: EmailResult;
    userId?: string | null;
    sentAt?: number | null;
  },
): Promise<string> {
  const id = newId('com');
  const now = Date.now();
  await db.run(
    `INSERT INTO communication_events (id, organization_id, application_id, template_id, channel, to_email, subject, body, status, provider, provider_message_id, error, created_by_user_id, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.orgId, input.applicationId, input.templateId || null, input.channel, input.toEmail,
      input.subject.slice(0, 300), input.body.slice(0, 12000), input.result.status, input.result.provider,
      input.result.providerMessageId || null, input.result.error || null, input.userId || null, now,
      input.result.status === 'sent' ? input.sentAt || now : null,
    ],
  );
  return id;
}
