import { parseJson } from './util';
import type { Db } from './db';

export interface SeoContext {
  appUrl: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  jsonLd?: Record<string, unknown> | null;
  ogType?: string;
}

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function seoHead(ctx: SeoContext): string {
  const t = escapeHtml(ctx.title);
  const d = escapeHtml(ctx.description);
  const url = escapeHtml(ctx.canonical);
  const json = ctx.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(ctx.jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta name="robots" content="${escapeHtml(ctx.robots)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${escapeHtml(ctx.ogType || 'website')}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${escapeHtml(ctx.appUrl)}/og.svg" />`,
    `<meta property="og:site_name" content="HireFlow Lite" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ctx.appUrl)}/og.svg" />`,
    json,
  ].join('\n    ');
}

function employmentType(value: string): string {
  const map: Record<string, string> = { full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR', internship: 'INTERN' };
  return map[value] || 'FULL_TIME';
}

export async function careersSeo(db: Db, appUrl: string, jobSlug?: string): Promise<SeoContext> {
  const org =
    (await db.get<any>(
      `SELECT o.* FROM organizations o WHERE EXISTS (SELECT 1 FROM jobs j WHERE j.organization_id = o.id AND j.status = 'published') ORDER BY o.created_at LIMIT 1`,
    )) || (await db.get<any>('SELECT * FROM organizations ORDER BY created_at LIMIT 1'));

  if (!jobSlug) {
    const jobs = org
      ? await db.all<any>("SELECT title, slug FROM jobs WHERE organization_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 20", [org.id])
      : [];
    const orgName = org?.name || 'HireFlow Lite';
    return {
      appUrl,
      title: `Careers at ${orgName} — open roles and how we hire`,
      description: org?.careers_intro?.slice(0, 155) || `See every open role at ${orgName}, how the hiring process works, and what happens after you apply.`,
      canonical: `${appUrl}/careers`,
      robots: 'index, follow, max-snippet:-1, max-image-preview:large',
      ogType: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            name: orgName,
            url: appUrl,
            logo: `${appUrl}/favicon.svg`,
          },
          {
            '@type': 'CollectionPage',
            name: `Careers at ${orgName}`,
            url: `${appUrl}/careers`,
            description: org?.careers_intro || '',
            hasPart: jobs.map((j) => ({ '@type': 'JobPosting', title: j.title, url: `${appUrl}/careers/${j.slug}` })),
          },
        ],
      },
    };
  }

  if (!org) {
    return {
      appUrl,
      title: 'Role not found — HireFlow Lite',
      description: 'This role is no longer available.',
      canonical: `${appUrl}/careers`,
      robots: 'noindex, nofollow',
    };
  }

  const job = await db.get<any>('SELECT * FROM jobs WHERE organization_id = ? AND slug = ?', [org.id, jobSlug]);
  if (!job || job.status === 'draft' || job.status === 'archived') {
    return {
      appUrl,
      title: 'Role not found — HireFlow Lite',
      description: 'This role is no longer available.',
      canonical: `${appUrl}/careers`,
      robots: 'noindex, nofollow',
    };
  }

  const open = job.status === 'published';
  const salary = job.salary_min && job.salary_max
    ? {
        '@type': 'MonetaryAmount',
        currency: job.salary_currency || 'INR',
        value: { '@type': 'QuantitativeValue', minValue: job.salary_min, maxValue: job.salary_max, unitText: 'YEAR' },
      }
    : undefined;

  return {
    appUrl,
    title: `${job.title} at ${org.name} — apply by ${job.application_deadline || 'open until filled'}`,
    description: `${job.title} · ${job.location || 'Location flexible'} · ${job.work_mode}. ${String(job.description).replace(/\s+/g, ' ').slice(0, 140)}`,
    canonical: `${appUrl}/careers/${job.slug}`,
    robots: open ? 'index, follow, max-snippet:-1' : 'noindex, follow',
    ogType: 'article',
    jsonLd: open
      ? {
          '@context': 'https://schema.org',
          '@type': 'JobPosting',
          title: job.title,
          description: `${job.description}\n\n${job.responsibilities || ''}\n\n${job.qualifications || ''}`,
          datePosted: new Date(job.published_at || job.created_at).toISOString(),
          validThrough: job.application_deadline ? `${job.application_deadline}T23:59:59+05:30` : undefined,
          employmentType: employmentType(job.employment_type),
          hiringOrganization: { '@type': 'Organization', name: org.name, sameAs: org.website || appUrl },
          jobLocationType: job.work_mode === 'remote' ? 'TELECOMMUTE' : undefined,
          applicantLocationRequirements: job.work_mode === 'remote' ? { '@type': 'Country', name: 'India' } : undefined,
          jobLocation: job.work_mode !== 'remote'
            ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location || 'Bengaluru', addressCountry: 'IN' } }
            : undefined,
          baseSalary: salary,
          directApply: true,
          url: `${appUrl}/careers/${job.slug}`,
          industry: org.name,
        }
      : null,
  };
}

export function injectSeo(template: string, head: string): string {
  if (template.includes('<!-- SEO_HEAD -->')) return template.replace('<!-- SEO_HEAD -->', head);
  return template.replace('</head>', `${head}\n</head>`);
}

export function sitemapXml(appUrl: string, jobs: { slug: string; updated_at?: number }[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${appUrl}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${appUrl}/careers`, priority: '0.9', changefreq: 'daily' },
    { loc: `${appUrl}/pricing`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${appUrl}/privacy`, priority: '0.4', changefreq: 'yearly' },
    { loc: `${appUrl}/terms`, priority: '0.4', changefreq: 'yearly' },
    ...jobs.map((j) => ({ loc: `${appUrl}/careers/${j.slug}`, priority: '0.8', changefreq: 'weekly' })),
  ];
  const body = urls
    .map((u) => `  <url>\n    <loc>${escapeHtml(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function jobFields(value: string | null): any[] {
  return parseJson(value, []);
}
