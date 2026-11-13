declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): Array<{ columns: string[]; values: any[][] }>;
    prepare(sql: string): Statement;
    close(): void;
  }
  export interface Statement {
    bind(values: any[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): boolean;
  }
  export interface SqlJsStatic {
    Database: new () => Database;
  }
  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}
