const targetUrl = process.argv[2] || process.env.APP_URL || 'https://hireflow-lite.rajpiyush092.workers.dev';
console.log(`[HireFlow Lite Smoke Test] Target URL: ${targetUrl}`);

let exitCode = 0;
let passed = 0;
let failed = 0;

function assert(cond, name, details = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; exitCode = 1; console.error(`  ✗ ${name} — ${details}`); }
}

async function run() {
  try {
    console.log('\n1. Health endpoint:');
    const healthRes = await fetch(`${targetUrl}/api/v1/health`);
    assert(healthRes.status === 200, 'Health endpoint status 200', `Got ${healthRes.status}`);
    const healthJson = await healthRes.json();
    assert(healthJson.status === 'ok', 'Health status ok');
    assert(healthJson.service === 'HireFlow Lite API', 'Service is HireFlow Lite');

    console.log('\n2. Static SPA delivery & SEO:');
    const rootRes = await fetch(`${targetUrl}/`);
    assert(rootRes.status === 200, 'Root HTML returns 200');
    const rootHtml = await rootRes.text();
    assert(rootHtml.includes('id="root"'), 'Root HTML includes div#root');
    assert(rootHtml.includes('rel="canonical"'), 'Root HTML includes canonical link');
    assert(rootHtml.includes('property="og:title"'), 'Root HTML includes og:title');
    assert(rootHtml.includes('name="twitter:card"'), 'Root HTML includes Twitter card');
    assert(rootHtml.includes('SoftwareApplication'), 'Root HTML includes Schema.org SoftwareApplication');
    assert(rootHtml.includes('FAQPage'), 'Root HTML includes Schema.org FAQPage');

    console.log('\n2b. Technical SEO files:');
    const robotsRes = await fetch(`${targetUrl}/robots.txt`);
    assert(robotsRes.status === 200, '/robots.txt returns 200');
    const robotsText = await robotsRes.text();
    assert(robotsText.includes('Sitemap:'), '/robots.txt includes Sitemap declaration');
    const sitemapRes = await fetch(`${targetUrl}/sitemap.xml`);
    assert(sitemapRes.status === 200, '/sitemap.xml returns 200');
    const sitemapXml = await sitemapRes.text();
    assert(sitemapXml.includes('<urlset'), '/sitemap.xml includes <urlset>');
    const llmsRes = await fetch(`${targetUrl}/llms.txt`);
    assert(llmsRes.status === 200, '/llms.txt returns 200');
    const llmsText = await llmsRes.text();
    assert(llmsText.includes('HireFlow'), '/llms.txt contains HireFlow header');

    console.log('\n3. Demo authentication:');
    const demoRes = await fetch(`${targetUrl}/api/v1/auth/demo-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@hireflow.demo' }),
    });
    assert(demoRes.status === 200, 'Owner demo login status 200', `Got ${demoRes.status}`);
    const setCookie = demoRes.headers.get('set-cookie') || '';
    assert(setCookie.includes('hf_session='), 'Session cookie set');
    const cookieMatch = setCookie.match(/hf_session=([^;]+)/);
    const sessionCookie = cookieMatch ? cookieMatch[1] : '';
    const cookieHeader = `hf_session=${sessionCookie}`;
    const demoJson = await demoRes.json();
    assert(demoJson.user?.email === 'owner@hireflow.demo', 'Owner user returned');
    assert(demoJson.role === 'owner', 'Role is owner');
    const csrfToken = demoJson.csrf_token;
    assert(!!csrfToken, 'CSRF token returned');

    console.log('\n4. Session validation:');
    const meRes = await fetch(`${targetUrl}/api/v1/auth/me`, { headers: { Cookie: cookieHeader } });
    assert(meRes.status === 200, '/me returns 200 with cookie');
    const meJson = await meRes.json();
    assert(meJson.authenticated === true, 'Session is authenticated');
    assert(meJson.user?.email === 'owner@hireflow.demo', 'Session user matches');

    console.log('\n5. Jobs listing:');
    const jobsRes = await fetch(`${targetUrl}/api/v1/jobs`, { headers: { Cookie: cookieHeader } });
    assert(jobsRes.status === 200, 'Jobs list returns 200', `Got ${jobsRes.status}`);
    const jobsJson = await jobsRes.json();
    assert(Array.isArray(jobsJson.jobs), 'jobs property is array');
    assert(jobsJson.jobs.length >= 1, `Found ${jobsJson.jobs.length} jobs`);

    console.log('\n6. Applications listing:');
    const appsRes = await fetch(`${targetUrl}/api/v1/applications`, { headers: { Cookie: cookieHeader } });
    assert(appsRes.status === 200, 'Applications list returns 200', `Got ${appsRes.status}`);

    console.log('\n7. Interviews listing:');
    const ivRes = await fetch(`${targetUrl}/api/v1/interviews`, { headers: { Cookie: cookieHeader } });
    assert(ivRes.status === 200, 'Interviews list returns 200', `Got ${ivRes.status}`);

    console.log('\n8. Public careers:');
    const pubRes = await fetch(`${targetUrl}/api/v1/public/careers`);
    assert(pubRes.status === 200, 'Public careers returns 200', `Got ${pubRes.status}`);

    console.log('\n9. Portal invalid token → 404:');
    const portalRes = await fetch(`${targetUrl}/api/v1/portal/not-a-real-token-xxxxxxxxxxxxxxxx`);
    assert(portalRes.status === 404, 'Invalid portal token returns 404', `Got ${portalRes.status}`);

    console.log('\n10. Role isolation (interviewer blocked from audit):');
    const ivDemoRes = await fetch(`${targetUrl}/api/v1/auth/demo-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'interviewer@hireflow.demo' }),
    });
    const ivCookie = (ivDemoRes.headers.get('set-cookie') || '').match(/hf_session=([^;]+)/)?.[1];
    const auditRes = await fetch(`${targetUrl}/api/v1/audit`, { headers: { Cookie: `hf_session=${ivCookie}` } });
    assert(auditRes.status === 403, 'Interviewer blocked from audit with 403', `Got ${auditRes.status}`);

    console.log(`\n========================================`);
    console.log(`Smoke Test Results: ${passed} passed, ${failed} failed.`);
    console.log(`========================================\n`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Smoke test unhandled exception:', err);
    process.exit(1);
  }
}

run();