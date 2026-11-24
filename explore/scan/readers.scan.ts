// READ-ONLY exploration of Manage Readers (APH or Fassbayar, from ENV_NAME), for the RDR test cases
// (TC-*-BP-RDR-001..016). Opens Reader Summary, every quicklink, the sheet's URLs, Reader Details and the
// Suspend / Reinstate FORMS of one reader per status, the Status History pop-up and the company view.
// Reads every field, dropdown and Quicklink list; downloads the reader CSV template.
// NEVER clicks Submit / Upload / Confirm (forms are only opened).
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts readers
// Output: explore/scan/results/readers-<env>.json (local only), screenshots test-results/readers-<env>/
import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME } from '../../portals.config';

const env = ENV_NAME.toLowerCase();
const SHOTS = `test-results/readers-${env}`;
const SHEET_URLS = ['/reader', '/reader/register', '/reader/replacement', '/reader/getReplacementReport', '/fasstap', '/fasstap/list'];

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
      docTitle: document.title,
      title: txt(main.querySelector('.barPaddTitle')) || txt(main.querySelector('.title24Black')) || document.title,
      headings: Array.from(new Set(Array.from(main.querySelectorAll('.barPaddTitle, .title24Black, .txt20, .confirmTitle, h2, h3')).filter(vis).map(txt).filter((t) => t && t.length < 90))),
      steps: Array.from(main.querySelectorAll('#steps li div')).map(txt).filter(Boolean),
      quicklinks: Array.from(document.querySelectorAll('#leftPanel a')).map((a) => ({ text: txt(a), href: a.getAttribute('href') })),
      fields: Array.from(main.querySelectorAll('input, select, textarea')).filter((e) => {
        const i = e as HTMLInputElement; return i.type !== 'hidden' && !i.classList.contains('hideBtn') && (vis(e) || i.tagName === 'SELECT' || i.type === 'file');
      }).map((e) => {
        const i = e as HTMLInputElement;
        return { label: labelOf(i), name: i.name, id: i.id, type: i.tagName === 'SELECT' ? 'select' : i.type, value: i.value,
          placeholder: i.placeholder ?? '', maxlength: i.getAttribute('maxlength') ?? '', readonly: i.readOnly, disabled: i.disabled,
          options: i.tagName === 'SELECT' ? Array.from((i as unknown as HTMLSelectElement).options).map((o) => txt(o)) : undefined };
      }),
      buttons: Array.from(main.querySelectorAll('a.button, button, input[type=button], input[type=submit], a[href*="getTemplate"]')).filter(vis).map((b) => ({
        text: txt(b) || (b as HTMLInputElement).value, href: b.getAttribute('href'), id: b.id, onclick: (b.getAttribute('onclick') ?? '').slice(0, 160) })),
      labels: Array.from(main.querySelectorAll('.formLabel, .label, td, .formInput, .txtLabel, p, span')).filter(vis).map(txt)
        .filter((t) => t && t.length < 120).filter((t, i, a) => a.indexOf(t) === i).slice(0, 80),
      tables: Array.from(main.querySelectorAll('table')).filter(vis).map((t) => ({
        columns: Array.from(t.querySelectorAll('tr.dataTitleMid th, thead th, tr.dataTitleMid td')).map(txt).filter(Boolean),
        rows: t.querySelectorAll('tr.dataListMid').length,
        sample: Array.from(t.querySelectorAll('tr.dataListMid')).slice(0, 3).map((r) => Array.from(r.querySelectorAll('td')).map(txt)) })).filter((t) => t.columns.length || t.rows),
      totalRecords: (main.textContent?.match(/Total Records:\s*\d+/) ?? [''])[0],
      messages: Array.from(main.querySelectorAll('.errorMsg, [class*=error], [class*=Error], .msg, .alert')).filter(vis).map(txt).filter((t) => t && t.length < 200).slice(0, 8),
      rules: Object.fromEntries(Object.keys(window).filter((k) => /^regex_/.test(k)).map((k) => [k, String((window as unknown as Record<string, unknown>)[k])]))
    };
  });
}

test(`explore Manage Readers on ${ENV_NAME}`, async ({ page }) => {
  test.setTimeout(20 * 60_000);
  page.setDefaultTimeout(20_000);                    // never hang on one element
  fs.mkdirSync(SHOTS, { recursive: true });
  let n = 0;
  const shot = (label: string) => page.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`, fullPage: true }).catch(() => {});

  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });

  const out: Record<string, unknown> = { env: ENV_NAME, account: Credentials.username, scannedAt: new Date().toISOString() };
  const pages: unknown[] = []; out.pages = pages;
  const open = async (url: string, via: string, label?: string) => {
    try {
      await page.goto(url, { timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const info = { via, requested: url, ...(await readPage(page)) };
      pages.push(info); await shot(label ?? info.title ?? url);
      console.log(`page ${url} -> ${info.url} "${info.title}" [${info.docTitle}] | ${info.fields.length} fields | ${info.totalRecords}`);
      return info;
    } catch (e) { pages.push({ via, requested: url, error: (e as Error).message.split('\n')[0] }); return null; }
  };

  // 1. Reader Summary, its quicklinks and the sheet's URLs
  const summary = await open('/reader', 'top menu Manage Readers');
  out.homeQuicklinks = await page.goto('/console').then(() => page.locator('#leftPanel a, .quicklinks a').evaluateAll((as) => as.map((a) => (a.textContent ?? '').trim()).filter(Boolean))).catch(() => []);
  for (const q of (summary?.quicklinks ?? []) as { text: string; href: string | null }[]) if (q.href && q.href.startsWith('/')) await open(q.href, `quicklink: ${q.text}`);
  for (const u of SHEET_URLS) await open(u, 'sheet URL');

  // 2. one reader per status: list row, its Quicklink options; each option opened with Go (details page,
  //    suspend / reinstate FORM - opened only), Status History pop-up on the details page
  const byStatus: Record<string, Record<string, unknown>> = {}; out.byStatus = byStatus;
  const filterStatus = async (status: string) => {
    await page.goto('/reader'); await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('select[name="status"]').first().selectOption({ label: status }).catch(() => {});
    await page.locator('#rightMainContent a.button').filter({ hasText: /^\s*Search\s*$/ }).last().click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    return page.locator('tr.dataListMid').first();
  };
  for (const status of ['Active', 'Suspended', 'Permanently Suspended']) {
    let row = await filterStatus(status);
    const total = (await page.locator('#rightMainContent').innerText().catch(() => '')).match(/Total Records:\s*\d+/)?.[0] ?? '';
    await shot(`filter status ${status}`);
    if (!(await row.count())) { byStatus[status] = { total, rows: 0 }; continue; }
    const cells = (await row.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
    const quick = (await row.locator('select option').allInnerTexts().catch(() => [] as string[])).map((q) => q.trim());
    const info: Record<string, unknown> = { total, firstRow: cells, quicklink: quick };
    byStatus[status] = info;
    for (const option of quick) {
      row = await filterStatus(status);
      await row.locator('select').first().selectOption({ label: option }).catch(() => {});
      await Promise.all([
        page.waitForURL((u) => !/\/reader\/list/.test(u.pathname), { timeout: 30_000 }).catch(() => {}),
        row.locator('#buttonGo, a').filter({ hasText: /^\s*Go\s*$/ }).first().click().catch(() => {})
      ]);
      await page.waitForLoadState('networkidle').catch(() => {});
      const pageInfo = { via: `${status} reader Quicklink ${option}`, ...(await readPage(page)) };
      pages.push(pageInfo); await shot(`${status} ${option}`);
      console.log(`${status} / ${option} -> ${pageInfo.url} "${pageInfo.title}" [${pageInfo.docTitle}] | ${pageInfo.fields.length} fields`);
      if (!/details/i.test(pageInfo.url)) continue;
      info.detailsButtons = (await page.locator('#rightMainContent a.button, #rightMainContent a').allInnerTexts().catch(() => [] as string[])).map((t) => t.trim()).filter(Boolean);
      const sh = page.locator('#rightMainContent a').filter({ hasText: /Status History/ }).first();
      if (await sh.count()) {
        await sh.click().catch(() => {});
        await page.waitForTimeout(2500);
        info.statusHistory = (await page.frameLocator('#fancybox-wrap iframe, .fancybox-wrap iframe, .fancybox-inner iframe').first().locator('body').innerText({ timeout: 8_000 }).catch(() => '')).replace(/\s+/g, ' ').slice(0, 1200);
        await shot(`${status} status history popup`);
        await page.keyboard.press('Escape').catch(() => {});
      }
    }
  }

  // 3. bypass serial 0000000000 must never be listed
  await page.goto('/reader');
  await page.locator('#search').fill('0000000000').catch(() => {});
  await page.locator('#rightMainContent a.button').filter({ hasText: /^\s*Search\s*$/ }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  out.bypassSerial = (await page.locator('#rightMainContent').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
  await shot('search bypass serial 0000000000');

  // 4. company view of readers (first company's "View Readers")
  await page.goto('/company'); await page.waitForLoadState('networkidle').catch(() => {});
  const viewReaders = await page.locator('tr.dataListMid').first().locator('select option').evaluateAll((os) =>
    os.map((o) => ({ t: (o.textContent ?? '').trim(), v: (o as HTMLOptionElement).value })).find((o) => /Readers/.test(o.t))).catch(() => null);
  if (viewReaders?.v?.startsWith('/')) await open(viewReaders.v, 'company Quicklink View Readers', 'company view readers');

  // 5. reader CSV template (download only)
  await page.goto('/reader/register').catch(() => {});
  const tpl = page.locator('a[href*="getTemplate"], a:has-text("download template")').first();
  if (await tpl.count()) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }).catch(() => null), tpl.click().catch(() => {})]);
    if (dl) {
      const file = `${SHOTS}/template-${dl.suggestedFilename()}`;
      await dl.saveAs(file).catch(() => {});
      out.template = { file, content: fs.existsSync(file) ? fs.readFileSync(file, 'utf8').slice(0, 1000) : '' };
      console.log(`template ${file}: ${JSON.stringify((out.template as { content: string }).content)}`);
    }
  }

  fs.mkdirSync('explore/scan/results', { recursive: true });
  fs.writeFileSync(`explore/scan/results/readers-${env}.json`, JSON.stringify(out, null, 2));
  console.log(`saved explore/scan/results/readers-${env}.json: ${pages.length} pages`);
});
