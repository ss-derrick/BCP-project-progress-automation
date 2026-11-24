// READ-ONLY exploration of Administrator (APH or Fassbayar, from ENV_NAME), for the ADM test cases.
// Opens every Administrator page reachable with the .env account, every quicklink, one detail page per
// list, and the pages named in the baseline sheet (bank users, card brands, host settings, plan codes).
// Opens POP-UPS (links/buttons that show a dialog) and dropdowns to record them, then closes them with
// Cancel / No / close. NEVER clicks Submit / Confirm / Save / Delete / Suspend / Reinstate / Reset / Yes.
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts administrator
// Output: explore/scan/results/administrator-<env>.json (local only), screenshots test-results/admin-<env>/
import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME } from '../../portals.config';

const env = ENV_NAME.toLowerCase();
const SHOTS = `test-results/admin-${env}`;
const NEVER = /submit|confirm|save|delete|remove|suspend|reinstate|unsuspend|reset|yes|continue|upload|export|download/i;

// Pages the baseline sheet names for ADM (tried directly; some may need a role the account lacks)
const SHEET_URLS = ['/admin', '/admin/register', '/admin/errorLog', '/admin/auditTrail', '/admin/ippList',
  '/admin/getIppRegister', '/admin/getCardBrandList', '/admin/getHostSettingDetails'];

async function readPage(page: Page) {
  return page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const main = document.querySelector('#rightMainContent') ?? document.body;
    const labelOf = (el: HTMLElement) => {
      const box = el.closest('.formInput, td'); let p = box?.previousElementSibling;
      while (p && !txt(p)) p = p.previousElementSibling;
      return (txt(p) || (el as HTMLInputElement).placeholder || '').slice(0, 70);
    };
    return {
      url: location.pathname + location.search,
      title: txt(main.querySelector('.barPaddTitle')) || txt(main.querySelector('.title24Black')) || document.title,
      headings: Array.from(new Set(Array.from(main.querySelectorAll('.barPaddTitle, .title24Black, .txt20, .confirmTitle, h2, h3')).filter(vis).map(txt).filter((t) => t && t.length < 90))),
      steps: Array.from(main.querySelectorAll('#steps li div')).map(txt).filter(Boolean),
      quicklinks: Array.from(document.querySelectorAll('#leftPanel a')).map((a) => ({ text: txt(a), href: a.getAttribute('href') })),
      fields: Array.from(main.querySelectorAll('input, select, textarea')).filter((e) => {
        const i = e as HTMLInputElement; return i.type !== 'hidden' && !i.classList.contains('hideBtn') && (vis(e) || i.tagName === 'SELECT');
      }).map((e) => {
        const i = e as HTMLInputElement;
        return { label: labelOf(i), name: i.name, id: i.id, type: i.tagName === 'SELECT' ? 'select' : i.type, value: i.value,
          maxlength: i.getAttribute('maxlength') ?? '', readonly: i.readOnly, disabled: i.disabled,
          options: i.tagName === 'SELECT' ? Array.from((i as unknown as HTMLSelectElement).options).map((o) => txt(o)) : undefined };
      }),
      buttons: Array.from(main.querySelectorAll('a.button, button, input[type=button]')).filter(vis).map((b) => ({
        text: txt(b) || (b as HTMLInputElement).value, href: b.getAttribute('href'), cls: b.className, onclick: (b.getAttribute('onclick') ?? '').slice(0, 120) })),
      popupLinks: Array.from(main.querySelectorAll('a.fancybox, a[data-fancybox], a[href*="statusHistory"], a[onclick*="dialog"], a[onclick*="confirm"], a[onclick*="popup"]'))
        .filter(vis).map((a) => ({ text: txt(a) || a.getAttribute('title'), href: a.getAttribute('href'), cls: a.className })),
      tables: Array.from(main.querySelectorAll('table')).filter(vis).map((t) => ({
        columns: Array.from(t.querySelectorAll('tr.dataTitleMid th, thead th')).map(txt).filter(Boolean),
        rows: t.querySelectorAll('tr.dataListMid').length })).filter((t) => t.columns.length),
      totalRecords: (main.textContent?.match(/Total Records:\s*\d+/) ?? [''])[0],
      messages: Array.from(main.querySelectorAll('.errorMsg, .txt20, [class*=error]')).filter(vis).map(txt).filter((t) => t && t.length < 200).slice(0, 6),
      rules: Object.fromEntries(Object.keys(window).filter((k) => /^regex_/.test(k)).map((k) => [k, String((window as unknown as Record<string, unknown>)[k])]))
    };
  });
}

test(`explore Administrator on ${ENV_NAME}`, async ({ page }) => {
  test.setTimeout(20 * 60_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  let n = 0;
  const shot = (label: string) => page.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`, fullPage: true }).catch(() => {});

  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });
  const greeting = await page.locator('.loginInfo').innerText().catch(() => '');

  const out: Record<string, unknown> = { env: ENV_NAME, account: Credentials.username, greeting: greeting.replace(/\s+/g, ' '), scannedAt: new Date().toISOString(), pages: [] as unknown[], popups: [] as unknown[] };
  const pages = out.pages as unknown[]; const popups = out.popups as unknown[];
  const seen = new Set<string>();

  const visit = async (url: string, via: string) => {
    const key = url.replace(/=\d+/g, '=#');
    if (seen.has(key)) return null;
    seen.add(key);
    try {
      await page.goto(url, { timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const info = { via, requested: url, ...(await readPage(page)) };
      pages.push(info); await shot(info.title || url);
      console.log(`page ${url} -> ${info.url} "${info.title}" | ${info.fields.length} fields, ${info.buttons.length} buttons, ${info.popupLinks.length} popup links`);
      return info;
    } catch (e) { pages.push({ via, requested: url, error: (e as Error).message.split('\n')[0] }); return null; }
  };

  // 1. Administrator top menu + every quicklink + the sheet's URLs
  const home = await visit('/admin', 'top menu');
  const quick = ((home?.quicklinks ?? []) as { text: string; href: string | null }[]).filter((q) => q.href && !NEVER.test(q.href));
  for (const q of quick) await visit(new URL(q.href!, page.url()).pathname + new URL(q.href!, page.url()).search, `quicklink: ${q.text}`);
  for (const u of SHEET_URLS) await visit(u, 'sheet URL');

  // 2. one detail page per list (View Details / first row link) and its buttons
  for (const p of [...pages] as { url?: string; title?: string }[]) {
    if (!p.url) continue;
    await page.goto(p.url).catch(() => {});
    const links = await page.locator('#dataRow tr.dataListMid').first().locator('a[href]').evaluateAll((as) =>
      as.map((a) => ({ text: (a.textContent ?? '').trim(), href: a.getAttribute('href') ?? '' }))).catch(() => []);
    for (const l of links) {
      if (!l.href || l.href.startsWith('javascript') || NEVER.test(l.href) || NEVER.test(l.text)) continue;
      const abs = new URL(l.href, page.url()); await visit(abs.pathname + abs.search, `${p.title}: ${l.text}`);
    }
  }

  // 3. pop-ups: on every page, open each popup link / dialog button, record, close (never confirm)
  for (const p of [...pages] as { url?: string; title?: string; popupLinks?: { text: string; href: string }[]; buttons?: { text: string; href: string | null; onclick: string }[] }[]) {
    if (!p.url) continue;
    const triggers = [
      ...(p.popupLinks ?? []).map((l) => l.text),
      ...(p.buttons ?? []).filter((b) => /dialog|popup|fancybox|confirm\(/i.test(b.onclick) || /javascript/i.test(b.href ?? '')).map((b) => b.text)
    ].filter((t) => t && !/^Search$/i.test(t));
    for (const t of Array.from(new Set(triggers))) {
      await page.goto(p.url).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const el = page.locator('#rightMainContent').getByText(t, { exact: true }).first();
      if (!(await el.count())) continue;
      let dialogText = '';
      page.once('dialog', async (d) => { dialogText = `[browser ${d.type()}] ${d.message()}`; await d.dismiss(); });   // never accept
      await el.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const pop = await page.evaluate(() => {
        const txt = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const box = Array.from(document.querySelectorAll('.ui-dialog, .fancybox-wrap, #fancybox-wrap, .fancybox-skin, .modal, [role=dialog]'))
          .find((e) => (e as HTMLElement).offsetWidth > 0);
        const iframe = box?.querySelector('iframe') as HTMLIFrameElement | null;
        return box ? { text: txt(box).slice(0, 600), buttons: Array.from(box.querySelectorAll('button, a.button, input[type=button]')).map(txt).filter(Boolean), iframe: iframe?.src ?? '' } : null;
      });
      let frameText = '';
      if (pop?.iframe) frameText = await page.frameLocator('iframe').first().locator('body').innerText({ timeout: 5_000 }).catch(() => '');
      if (pop || dialogText || page.url().replace(/[?#].*/, '') !== new URL(p.url, page.url()).href.replace(/[?#].*/, '')) {
        popups.push({ page: p.url, trigger: t, dialog: dialogText, popup: pop, frameText: frameText.replace(/\s+/g, ' ').slice(0, 600), landedOn: page.url().replace(/^https?:\/\/[^/]+/, '') });
        await shot(`popup ${t}`);
        console.log(`popup on ${p.url}: "${t}" -> ${dialogText || pop?.text.slice(0, 100) || 'navigated to ' + page.url()}`);
      }
      // close without confirming
      for (const c of ['No', 'Cancel', 'Close', 'No, sign me out']) {
        if (c === 'No, sign me out') break;
        const b = page.locator('.ui-dialog, .fancybox-wrap, #fancybox-wrap, [role=dialog]').getByText(c, { exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; }
      }
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  fs.mkdirSync('explore/scan/results', { recursive: true });
  fs.writeFileSync(`explore/scan/results/administrator-${env}.json`, JSON.stringify(out, null, 2));
  console.log(`saved explore/scan/results/administrator-${env}.json: ${pages.length} pages, ${popups.length} popups; account ${Credentials.username}; ${out.greeting}`);
});
