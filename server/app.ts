import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import { d1Db } from './db';
import { attachAuth, csrfGuard } from './auth';

import { authRouter } from './routes/auth';
import { jobsRouter } from './routes/jobs';
import { applicationsRouter } from './routes/applications';
import { interviewsRouter } from './routes/interviews';
import { teamRouter } from './routes/team';
import { settingsRouter } from './routes/settings';
import { communicationsRouter } from './routes/communications';
import { analyticsRouter } from './routes/analytics';
import { importExportRouter } from './routes/importexport';
import { auditRouter } from './routes/audit';
import { privacyRouter } from './routes/privacy';
import { dashboardRouter } from './routes/dashboard';
import { portalRouter } from './routes/portal';
import { publicRouter } from './routes/public';

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    // Portal routes set a stricter no-referrer policy inside their own middleware.
    if (!c.req.path.startsWith('/api/v1/portal/')) {
      c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
  });

  app.use('*', async (c, next) => {
    if (c.env?.DB) c.set('db', d1Db(c.env.DB));
    return next();
  });

  app.use('*', attachAuth());
  app.use('*', csrfGuard());

  app.get('/api/v1/health', (c) =>
    c.json({
      status: 'ok',
      service: 'HireFlow Lite API',
      version: '1.0.0',
      environment: c.env?.ENVIRONMENT || 'production',
      timestamp: new Date().toISOString(),
    }),
  );

  app.route('/api/v1/auth', authRouter);
  app.route('/api/v1/jobs', jobsRouter);
  app.route('/api/v1/applications', applicationsRouter);
  app.route('/api/v1/interviews', interviewsRouter);
  app.route('/api/v1/team', teamRouter);
  app.route('/api/v1/settings', settingsRouter);
  app.route('/api/v1/communications', communicationsRouter);
  app.route('/api/v1/analytics', analyticsRouter);
  app.route('/api/v1/import-export', importExportRouter);
  app.route('/api/v1/audit', auditRouter);
  app.route('/api/v1/privacy', privacyRouter);
  app.route('/api/v1/dashboard', dashboardRouter);
  app.route('/api/v1/portal', portalRouter);
  app.route('/api/v1/public', publicRouter);

  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) return c.json({ error: 'Endpoint not found', code: 'NOT_FOUND' }, 404);
    return c.text('Not found', 404);
  });

  app.onError((err, c) => {
    console.error('Unhandled server error:', err);
    return c.json({ error: 'An internal server error occurred', code: 'INTERNAL_ERROR' }, 500);
  });

  return app;
}
