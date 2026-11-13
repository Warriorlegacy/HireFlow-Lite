import type { Db } from './db';

/**
 * Fixed-window rate limiter backed by D1 so limits survive isolate restarts.
 * Used only on public and authentication surfaces where abuse is costly.
 */
export async function rateLimit(
  db: Db,
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const row = await db.get<any>('SELECT window_start, count FROM rate_limits WHERE key = ?', [key]);
  if (!row || now - Number(row.window_start) >= windowMs) {
    await db.run(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
      [key, now],
    );
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  const count = Number(row.count);
  if (count >= limit) {
    return { allowed: false, remaining: 0, resetAt: Number(row.window_start) + windowMs };
  }
  await db.run('UPDATE rate_limits SET count = count + 1 WHERE key = ?', [key]);
  return { allowed: true, remaining: limit - count - 1, resetAt: Number(row.window_start) + windowMs };
}

export async function cleanupRateLimits(db: Db): Promise<void> {
  await db.run('DELETE FROM rate_limits WHERE window_start < ?', [Date.now() - 24 * 60 * 60 * 1000]);
}
