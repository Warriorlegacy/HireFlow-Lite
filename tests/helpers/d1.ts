import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

let SQL: SqlJsStatic | null = null;

export async function makeTestD1() {
  if (!SQL) SQL = await initSqlJs();
  const db: Database = new SQL.Database();
  const schema = fs.readFileSync(path.resolve('server/schema.sql'), 'utf8');
  db.run(schema);

  function prepare(sql: string) {
    let params: unknown[] = [];
    return {
      bind(...values: unknown[]) {
        params = values.map((v) => (v === undefined ? null : v));
        return this;
      },
      async all<T = any>() {
        const stmt = db.prepare(sql);
        stmt.bind(params as any[]);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        stmt.free();
        return { results: rows, success: true, meta: { changes: 0, duration: 0 } };
      },
      async first<T = any>() {
        const rows = await this.all<T>();
        return (rows.results[0] ?? null) as T | null;
      },
      async run() {
        db.run(sql, params as any[]);
        const res = db.exec('SELECT changes() AS changes');
        const changes = Number(res[0]?.values?.[0]?.[0] ?? 0);
        return { meta: { changes } };
      },
    };
  }

  return {
    prepare,
    async exec(sql: string) {
      db.run(sql);
      return { count: 0 };
    },
    async batch(statements: any[]) {
      for (const statement of statements) {
        if (typeof statement?.run === 'function') await statement.run();
        else db.run(statement.sql, (statement.params ?? []) as any[]);
      }
    },
    _raw: db,
  };
}

export type TestD1 = Awaited<ReturnType<typeof makeTestD1>>;