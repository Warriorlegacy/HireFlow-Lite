import type { Db } from './db';
import { base64FromBytes, bytesFromBase64 } from './crypto';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function sanitizeFilename(name: string): string {
  return (name || 'resume').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

/** Verify the real file signature, not the extension or browser MIME alone. */
export function detectResumeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return 'application/pdf';
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return null;
}

export function validateResume(filename: string, claimedType: string, bytes: Uint8Array): { ok: boolean; mimeType?: string; reason?: string } {
  if (!bytes.length) return { ok: false, reason: 'The file is empty.' };
  if (bytes.length > MAX_RESUME_BYTES) return { ok: false, reason: 'Resume must be 5 MB or smaller.' };
  const detected = detectResumeType(bytes);
  if (!detected) return { ok: false, reason: 'Upload a PDF or DOCX file. Other formats are not accepted.' };
  if (claimedType && ALLOWED.has(claimedType) && claimedType !== detected) {
    return { ok: false, reason: 'The file content does not match its declared type.' };
  }
  const lower = (filename || '').toLowerCase();
  if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
    return { ok: false, reason: 'Resume filename must end in .pdf or .docx.' };
  }
  if (detected === 'application/pdf' && !lower.endsWith('.pdf')) return { ok: false, reason: 'PDF content requires a .pdf filename.' };
  if (detected !== 'application/pdf' && !lower.endsWith('.docx')) return { ok: false, reason: 'DOCX content requires a .docx filename.' };
  return { ok: true, mimeType: detected };
}

export async function storeResume(
  env: any,
  db: Db,
  meta: { orgId: string; applicationId: string; fileId: string; filename: string; mimeType: string; bytes: Uint8Array },
): Promise<{ backend: 'r2' | 'd1'; key: string }> {
  const key = `${meta.orgId}/${meta.applicationId}/${meta.fileId}-${sanitizeFilename(meta.filename)}`;
  if (env?.FILES) {
    await env.FILES.put(key, meta.bytes, { httpMetadata: { contentType: meta.mimeType } });
    return { backend: 'r2', key };
  }
  await db.run('INSERT OR REPLACE INTO file_blobs (storage_key, data_base64, created_at) VALUES (?, ?, ?)', [
    key,
    base64FromBytes(meta.bytes),
    Date.now(),
  ]);
  return { backend: 'd1', key };
}

export async function readResume(env: any, db: Db, file: any): Promise<Uint8Array | null> {
  if (file.storage_backend === 'r2') {
    if (!env?.FILES) return null;
    const obj = await env.FILES.get(file.storage_key);
    if (!obj) return null;
    return new Uint8Array(await obj.arrayBuffer());
  }
  const row = await db.get<any>('SELECT data_base64 FROM file_blobs WHERE storage_key = ?', [file.storage_key]);
  if (!row) return null;
  return bytesFromBase64(row.data_base64);
}

export async function deleteResume(env: any, db: Db, file: any): Promise<void> {
  if (file.storage_backend === 'r2' && env?.FILES) {
    try {
      await env.FILES.delete(file.storage_key);
    } catch {
      /* object may already be gone; metadata still needs clearing */
    }
  } else {
    await db.run('DELETE FROM file_blobs WHERE storage_key = ?', [file.storage_key]);
  }
}
