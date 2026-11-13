import { sha256Hex } from './crypto';
import type { Db } from './db';

export async function prevHashFor(db: Db, scopeValue: string): Promise<string> {
  const row = await db.get<any>(
    'SELECT row_hash FROM audit_events WHERE organization_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
    [scopeValue],
  );
  return row?.row_hash && String(row.row_hash).length > 0 ? String(row.row_hash) : 'GENESIS';
}

export async function chainHash(prevHash: string, payload: string): Promise<string> {
  return sha256Hex(`${prevHash}|${payload}`);
}
