export interface DbStatement {
  sql: string;
  params?: unknown[];
}

export interface Db {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  batch(statements: DbStatement[]): Promise<void>;
}

export function d1Db(d1: D1Database): Db {
  return {
    async all<T>(sql: string, params: unknown[] = []) {
      const res = await d1.prepare(sql).bind(...params).all<T>();
      return (res.results ?? []) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const res = await d1.prepare(sql).bind(...params).first<T>();
      return (res ?? null) as T | null;
    },
    async run(sql: string, params: unknown[] = []) {
      const res = await d1.prepare(sql).bind(...params).run();
      return { changes: res.meta?.changes ?? 0 };
    },
    async batch(statements: DbStatement[]) {
      if (!statements.length) return;
      for (let i = 0; i < statements.length; i += 100) {
        const chunk = statements.slice(i, i + 100).map((s) => d1.prepare(s.sql).bind(...(s.params ?? [])));
        await d1.batch(chunk);
      }
    },
  };
}

export function rowId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function nowMs(): number {
  return Date.now();
}
