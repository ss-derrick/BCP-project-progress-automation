// READ-ONLY exploration of the login / session / error pages for the AUTH cases (APH TC-APH-BP-AUTH-001..017,
// Fassbayar TC-FB-BP-AUTH-001..017): login page texts, blank-field handling, the unknown-user message (made-up
// user only: no real account's failed-attempt counter changes), the session-timeout script and dialog, logout +
// Back + pasted URL, error pages (/issue/401, /issue/notValidLink) and the reset-password page without a token.
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts auth
// Output: explore/scan/results/auth-<env>.json (local only), screenshots test-results/auth-<env>/
import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME } from '../../portals.config';

const env = ENV_NAME.toLowerCase();
const SHOTS = `test-results/auth-${env}`;
const UNKNOWN_USER = 'zz_no_user_99';

const visibleText = (page: Page) => page.evaluate(() => (document.body?.innerText ?? '').replace(/[ \t]+/g, ' ').trim());
const state = async (page: Page, label: string, n: number) => {
  await page.waitForLoadState('load').catch(() => {});
  await page.screenshot({ path: `${SHOTS}/${String(n).padStart(2, '0')}-${label}.png`, fullPage: true }).catch(() => {});
  return { label, url: page.url(), title: await page.title(), text: (await visibleText(page)).slice(0, 1500) };
};

test(`explore AUTH on ${ENV_NAME}`, async ({ page, browser }) => {
  test.setTimeout(10 * 60_000);
  page.setDefaultTimeout(20_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const out: Record<string, unknown> = { env: ENV_NAME, scannedAt: new Date().toISOString() };
  const steps: unknown[] = [];
  let n = 1;

  // 1. login page
  await page.goto('/auth/login');
  steps.push(await state(page, 'login-page', n++));
  out.loginPage = await page.evaluate(() => {
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    return {
      inputs: [...document.querySelectorAll('input')].map((i) => ({ id: i.id, name: i.name, type: i.type, maxlength: i.maxLength, placeholder: i.placeholder, autocomplete: i.autocomplete, visible: vis(i) })),
      links: [...document.querySelectorAll('a')].filter(vis).map((a) => ({ text: (a.textContent ?? '').trim(), href: a.getAttribute('href'), id: a.id })),
      forms: [...document.querySelectorAll('form')].map((f) => ({ action: f.getAttribute('action'), method: f.method, id: f.id })),
      scripts: [...document.querySelectorAll('script')].map((s) => s.src || (s.textContent ?? '').slice(0, 3000)),
      hidden: [...document.querySelectorAll('[style*="display: none"], .hidden, .error, .errorMsg, [class*="error"]')].map((e) => ({ cls: e.className, id: e.id, text: (e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) }))
    };
  });

  // 2. blank fields
  for (const [label, user, pass] of [['both-blank', '', ''], ['user-blank', '', 'x'], ['password-blank', UNKNOWN_USER, '']] as const) {
    await page.goto('/auth/login');
    await page.locator('#t_username').fill(user);
    await page.locator('#t_password').fill(pass);
    const reqs: string[] = [];
    const onReq = (r: { url(): string; method(): string }) => { if (r.method() === 'POST') reqs.push(r.url()); };
    page.on('request', onReq);
    await page.locator('#login_btn').click();
    await page.waitForTimeout(2500);
    page.off('request', onReq);
    steps.push({ ...(await state(page, label, n++)), posts: reqs });
  }

  // 3. unknown user (made up: no real account affected)
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(UNKNOWN_USER);
  await page.locator('#t_password').fill('Wrong-Password-1!');
  await page.locator('#login_btn').click();
  await page.waitForTimeout(2500);
  steps.push(await state(page, 'unknown-user', n++));

  // 4. log in (main user)
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });
  steps.push(await state(page, 'home', n++));
  out.session = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script')];
    const inline = scripts.map((s) => s.textContent ?? '').filter((t) => /session|expire|timeout|idle|keep me|sign me out|setTimeout|setInterval/i.test(t));
    const dialog = [...document.querySelectorAll('div, dialog, section')].filter((e) => /session is about to expire|keep me signed in|sign me out/i.test(e.textContent ?? '') && e.children.length < 40);
    return {
      scriptSrcs: scripts.map((s) => s.src).filter(Boolean),
      inline: inline.map((t) => t.slice(0, 4000)),
      dialogHtml: dialog.slice(-2).map((e) => e.outerHTML.slice(0, 3000)),
      logout: [...document.querySelectorAll('a, button')].filter((a) => /logout/i.test(a.textContent ?? '') || /logout/i.test(a.id + a.className)).map((a) => ({ text: (a.textContent ?? '').trim(), id: a.id, cls: a.className, href: a.getAttribute('href'), onclick: a.getAttribute('onclick') }))
    };
  });
  // external scripts that mention the timeout
  const srcs = ((out.session as { scriptSrcs: string[] }).scriptSrcs).filter((s) => !/jquery|bootstrap|highcharts|moment|datatables/i.test(s));
  const found: Record<string, string[]> = {};
  for (const src of srcs) {
    const body = await page.evaluate(async (u) => { try { return await (await fetch(u)).text(); } catch { return ''; } }, src);
    const hits = [...body.matchAll(/.{0,200}(session|expire|keep me signed|sign me out|idle|timeout).{0,300}/gi)].map((m) => m[0]).slice(0, 12);
    if (hits.length) found[src] = hits;
  }
  out.timeoutScripts = found;

  // 5. second browser: same user logs in again -> does browser A survive?
  const ctxB = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: new URL(page.url()).origin });
  const b = await ctxB.newPage();
  await b.goto('/auth/login');
  await b.locator('#t_username').fill(Credentials.username);
  await b.locator('#t_password').fill(Credentials.password);
  await b.locator('#login_btn').click();
  await b.waitForLoadState('load');
  await b.waitForTimeout(2000);
  steps.push({ ...(await state(b, 'browserB-login', n++)) });
  await page.goto('/company');
  steps.push(await state(page, 'browserA-after-B-login', n++));
  await ctxB.close();

  // 6. fresh login, error pages, reset page without token, logout + back + pasted URL
  if (!/\/console|\/company/.test(page.url()) || /login/.test(page.url())) {
    await page.goto('/auth/login');
    await page.locator('#t_username').fill(Credentials.username);
    await page.locator('#t_password').fill(Credentials.password);
    await page.locator('#login_btn').click();
    await page.waitForURL(/\/console/, { timeout: 60_000 });
  }
  for (const p of ['/issue/401', '/issue/notValidLink', '/admin/register']) {
    await page.goto(p);
    steps.push(await state(page, `page${p.replace(/\//g, '_')}`, n++));
  }
  await page.goto('/console');
  const logout = page.locator('a.btnLogout, #login_btn.btnLogout').first();
  await logout.click();
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  steps.push(await state(page, 'after-logout', n++));
  await page.goBack().catch(() => {});
  await page.waitForTimeout(1500);
  steps.push(await state(page, 'after-back', n++));
  await page.goto('/company');
  steps.push(await state(page, 'pasted-company-url', n++));
  await page.goto('/auth/resetPwd');
  steps.push(await state(page, 'resetPwd-no-token', n++));

  out.steps = steps;
  fs.mkdirSync('explore/scan/results', { recursive: true });
  fs.writeFileSync(`explore/scan/results/auth-${env}.json`, JSON.stringify(out, null, 2));
});
