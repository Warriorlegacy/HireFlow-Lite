import { createApp } from './app';
import { d1Db } from './db';
import { runRetention } from './retention';
import { careersSeo, injectSeo, seoHead, sitemapXml } from './seo';

const app = createApp();

function appUrl(request: Request, env: any): string {
  return env.APP_URL || new URL(request.url).origin;
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }

    if (path === '/sitemap.xml' && env.DB) {
      const db = d1Db(env.DB);
      const base = appUrl(request, env);
      const jobs = await db.all<any>(
        `SELECT j.slug, j.updated_at FROM jobs j
          WHERE j.status = 'published' ORDER BY j.published_at DESC LIMIT 500`,
      );
      return new Response(sitemapXml(base, jobs), {
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 'public, max-age=900',
        },
      });
    }

    if ((path === '/careers' || /^\/careers\/[^/]+$/.test(path)) && env.ASSETS) {
      const base = appUrl(request, env);
      const db = env.DB ? d1Db(env.DB) : null;
      const jobSlug = path.startsWith('/careers/') ? decodeURIComponent(path.split('/')[2] || '') : undefined;
      // Use the built shell so scripts and styles are the real bundle.
      const asset = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString(), { headers: { accept: 'text/html' } }));
      let template = asset.ok
        ? await asset.text()
        : '<!doctype html><html lang="en"><head><!-- SEO_HEAD --></head><body><div id="root"></div></body></html>';
      if (db) {
        const seo = await careersSeo(db, base, jobSlug);
        template = injectSeo(template, seoHead(seo));
      }
      return new Response(template, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=300, s-maxage=900',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'strict-origin-when-cross-origin',
          'content-security-policy':
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
        },
      });
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return app.fetch(request, env, ctx);
  },

  async scheduled(_event: ScheduledController, env: any): Promise<void> {
    if (!env.DB) return;
    const db = d1Db(env.DB);
    const orgs = await db.all<any>('SELECT id FROM organizations');
    for (const org of orgs) {
      try {
        await runRetention(env, db, org.id);
      } catch (err) {
        console.error('retention failed for org', org.id, err);
      }
    }
  },
};
