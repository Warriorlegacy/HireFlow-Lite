import type { AuthContext } from './types';
import type { Db } from './db';

export interface AppEnv {
  Bindings: {
    DB: D1Database;
    FILES?: R2Bucket;
    ENVIRONMENT?: string;
    ALLOW_DEMO?: string;
    DEMO_SECRET?: string;
    APP_URL?: string;
    AI_ENABLED?: string;
    GEMINI_API_KEY?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
  };
  Variables: {
    db: Db;
    auth: AuthContext | null;
  };
}
