// READ-ONLY scan of "Manage Credit Settlements" on the portal of ENV_NAME.
// Maps every screen of the module: list + filters, batch search, View Details,
// "View all credit settlements", Schedule Force Settlement.
// Only opens pages and runs SEARCHES. Buttons that change data (Submit /
// Schedule / Settle / Save ...) are recorded, NEVER clicked.
// Output: explore/scan/results/credit-settlement-<env>.json + screenshots
//   $env:ENV_NAME='UAT-FASSBAYAR'; npx playwright test --config explore/scan/scan.config.ts creditSettlement
import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME, PORTAL } from '../../portals.config';

const OUT_DIR = 'explore/scan/results';
const env = ENV_NAME.toLowerCase();
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT_DIR}/credit-settlement-${env}-${name}.png`, fullPage: true });

// Everything visible on the current page that a user can see / use
async function dumpPage(page: Page) {
  return page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const main = document.querySelector('#content, #mainContent, .content, main') ?? document.body;
    const fields = Array.from(main.querySelectorAll('input, select, textarea'))
      .filter((e) => (e as HTMLInputElement).type !== 'hidden')
      .map((e) => {
        const el = e as HTMLInputElement;
        const row = el.closest('tr, .formRow, .row, li, div');
        return {
          name: el.name, id: el.id, tag: el.tagName.toLowerCase(), type: el.type, value: el.value,
          placeholder: el.placeholder, maxlength: el.getAttribute('maxlength') ?? '', readonly: el.readOnly,
          disabled: el.disabled, visible: vis(el), cls: el.className,
          label: txt(row?.querySelector('label, th, .label, .formLabel')) || txt(el.previousElementSibling),
          options: el.tagName === 'SELECT'
            ? Array.from((el as unknown as HTMLSelectElement).options).map((o) => `${o.value}=${txt(o)}`) : undefined
        };
      });
    const buttons = Array.from(main.querySelectorAll('button, input[type=submit], input[type=button], a.btn, a.button, a[class*=btn], a[id*=btn], a[onclick]'))
      .filter(vis).map((b) => ({ text: txt(b) || (b as HTMLInputElement).value, id: b.id, cls: b.className,
        href: b.getAttribute('href'), onclick: b.getAttribute('onclick') }));
    const links = Array.from(main.querySelectorAll('a[href]')).filter(vis)
      .map((a) => ({ text: txt(a), href: a.getAttribute('href') }))
      .filter((l) => l.text && !/^(#|javascript:void)/.test(l.href ?? ''));
    const tables = Array.from(main.querySelectorAll('table')).filter(vis).map((t) => ({
      id: t.id, cls: t.className,
      headers: Array.from(t.querySelectorAll('thead th, tr:first-child th')).map(txt),
      rows: Array.from(t.querySelectorAll('tbody tr')).slice(0, 5).map((r) => Array.from(r.querySelectorAll('td')).map(txt))
    }));
    const forms = Array.from(document.querySelectorAll('form')).map((f) => ({
      id: f.id, name: f.getAttribute('name'), action: f.getAttribute('action'), method: f.getAttribute('method')
    }));
    const headings = Array.from(main.querySelectorAll('h1, h2, h3, h4, .title, .barPaddTitle, .txt18, legend'))
      .filter(vis).map(txt).filter((t) => t && t.length < 80);
    const messages = Array.from(main.querySelectorAll('.error, .alert, .msg, .message, .notice, [class*=error], [class*=success]'))
      .filter(vis).map(txt).filter(Boolean);
    const quicklinks = Array.from(document.querySelectorAll('#leftPanel a')).map((a) => ({ text: txt(a), href: a.getAttribute('href') }));
    const w = window as unknown as Record<string, unknown>;
    const rules: Record<string, string> = {};
    for (const k of Object.keys(w).filter((k) => /^regex_/.test(k)).sort()) rules[k] = String(w[k]);
    return {
      url: location.pathname + location.search, title: document.title, headings: Array.from(new Set(headings)),
      quicklinks, fields, buttons, links: links.slice(0, 60), tables, forms, messages,
      bodyText: txt(main).slice(0, 3000), rules
    };
  });
}

// Run a search and record what the server was asked + what came back
async function search(page: Page, label: string, act: () => Promise<void>) {
  const requests: string[] = [];
  const onReq = (r: { method(): string; url(): string; postData(): string | null; resourceType(): string }) => {
    if (['document', 'xhr', 'fetch'].includes(r.resourceType())) {
      requests.push(`${r.method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}${r.postData() ? ' BODY ' + r.postData()!.slice(0, 300) : ''}`);
    }
  };
  page.on('request', onReq);
  try {
    await act();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1_000);
  } catch (e) {
    requests.push(`ERROR ${(e as Error).message.split('\n')[0]}`);
  }
  page.off('request', onReq);
  const result = await page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const total = (document.body.innerText.match(/Total Records:\s*\d+/) ?? [''])[0];
    const pageOf = (document.body.innerText.match(/Page \d+ of \d+/) ?? [''])[0];
    const msgs = Array.from(document.querySelectorAll('.error, .alert, .msg, .message, .notice, [class*=error], [class*=noRecord], [class*=empty]'))
      .filter((e) => (e as HTMLElement).offsetWidth).map(txt).filter(Boolean);
    return { url: location.pathname + location.search, total, pageOf, msgs };
  });
  console.log(`[search] ${label}: ${result.total || '-'} ${result.pageOf} ${result.url}`);
  return { label, requests, ...result };
}

test(`scan Credit Settlement on ${ENV_NAME}`, async ({ page }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out: Record<string, unknown> = { env: ENV_NAME, portal: PORTAL, scannedAt: new Date().toISOString() };

  // login
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });

  // top menu entry for the module
  out.topMenu = await page.locator('#topNavi a, #topMenu a, nav a').evaluateAll((as) =>
    as.map((a) => ({ text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') }))
      .filter((a) => /settle/i.test(a.text + a.href)));

  // 1. list page
  await page.goto('/creditSettlement/list');
  await page.waitForLoadState('networkidle').catch(() => {});
  out.list = await dumpPage(page);
  await shot(page, '01-list');

  // first rows: a real batch no / TID / mobile user to search with
  const list = out.list as Awaited<ReturnType<typeof dumpPage>>;
  const firstRow = list.tables.find((t) => t.rows.length)?.rows[0] ?? [];
  console.log('first row:', JSON.stringify(firstRow));
  const batchNo = firstRow.find((c) => /^\d{1,6}$/.test(c)) ?? '';
  const tid = (firstRow.find((c) => /^\d{8}\s*\(/.test(c)) ?? '').slice(0, 8);
  const mobileUser = (firstRow.find((c) => /\(.+\)/.test(c) && !/^\d{8}/.test(c)) ?? '').split(/\s*\(/)[0];
  out.sample = { batchNo, tid, mobileUser, firstRow };

  // 2. searches (read-only)
  const searches = [];
  const batchBox = page.getByPlaceholder(/Batch No/i).first();
  if (batchNo && await batchBox.count()) {
    searches.push(await search(page, `batch no = ${batchNo} (existing)`, async () => {
      await batchBox.fill(batchNo);
      await batchBox.press('Enter');
    }));
    await shot(page, '02-batch-search');
    out.batchSearchResult = await dumpPage(page);
    await page.goto('/creditSettlement/list');
    searches.push(await search(page, 'batch no = 999999999 (not existing)', async () => {
      await batchBox.fill('999999999');
      await page.getByRole('button', { name: 'Search' }).or(page.locator('a, input').filter({ hasText: 'Search' })).first().click();
    }));
    await shot(page, '03-batch-search-none');
    searches.push(await search(page, 'batch no = abc (letters)', async () => {
      await page.goto('/creditSettlement/list');
      await batchBox.fill('abc');
      await batchBox.press('Enter');
    }));
    searches.push(await search(page, 'batch no empty + Search', async () => {
      await page.goto('/creditSettlement/list');
      await batchBox.fill('');
      await batchBox.press('Enter');
    }));
  }

  // filter form: find its inputs by label text
  await page.goto('/creditSettlement/list');
  await page.waitForLoadState('networkidle').catch(() => {});
  const filters = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const el of Array.from(document.querySelectorAll('input:not([type=hidden]), select'))) {
      const e = el as HTMLInputElement;
      const row = e.closest('tr, div, li');
      const label = (row?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      out[e.name || e.id] = label;
    }
    return out;
  });
  out.filterLabels = filters;
  console.log('filter fields:', JSON.stringify(filters));

  const statusSelect = page.locator('select').filter({ has: page.locator('option', { hasText: /Select One/ }) }).first();
  if (await statusSelect.count()) {
    const opts = await statusSelect.locator('option').evaluateAll((os) => os.map((o) => ({ v: (o as HTMLOptionElement).value, t: (o.textContent ?? '').trim() })));
    for (const o of opts.filter((o) => o.v)) {
      searches.push(await search(page, `status = ${o.t}`, async () => {
        await page.goto('/creditSettlement/list');
        await statusSelect.selectOption(o.v);
        await page.locator('a, button, input[type=submit], input[type=button]').filter({ hasText: /^\s*Search\s*$/ }).last().click();
      }));
    }
    await shot(page, '04-status-filter');
  }

  // filter by TID and by mobile user (inputs whose row says so)
  const inputNear = (re: RegExp) => page.locator('tr, div').filter({ hasText: re }).locator('input[type=text], input:not([type])').first();
  const searchBtn = () => page.locator('a, button, input[type=submit], input[type=button]').filter({ hasText: /^\s*Search\s*$/ }).last();
  if (tid) {
    searches.push(await search(page, `TID = ${tid}`, async () => {
      await page.goto('/creditSettlement/list');
      await inputNear(/Terminal ID/).fill(tid);
      await searchBtn().click();
    }));
    await shot(page, '05-tid-filter');
  }
  if (mobileUser) {
    searches.push(await search(page, `Mobile User ID = ${mobileUser}`, async () => {
      await page.goto('/creditSettlement/list');
      await inputNear(/Mobile User ID/).fill(mobileUser);
      await searchBtn().click();
    }));
  }
  // date picker: what the date box is + one earlier day
  const dateBox = page.locator('tr, div').filter({ hasText: /^\s*Date/ }).locator('input').first();
  out.dateBox = await dateBox.evaluate((e) => ({ name: (e as HTMLInputElement).name, id: e.id, value: (e as HTMLInputElement).value,
    readonly: (e as HTMLInputElement).readOnly, cls: e.className })).catch(() => null);
  await dateBox.click().catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, '06-datepicker');
  out.datepicker = await page.evaluate(() => {
    const dp = document.querySelector('.ui-datepicker, .datepicker, .daterangepicker, [class*=calendar]');
    return dp ? { cls: dp.className, text: (dp.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) } : null;
  });
  await page.keyboard.press('Escape');
  out.searches = searches;

  // pagination
  out.pagination = await page.evaluate(() => Array.from(document.querySelectorAll('a, span, button'))
    .filter((e) => /Page \d+ of|^\s*[<>‹›]\s*$|next|prev/i.test((e.textContent ?? '') + e.className))
    .map((e) => ({ tag: e.tagName, text: (e.textContent ?? '').trim(), cls: e.className, href: e.getAttribute('href') })).slice(0, 10));

  // 3. View Details of the first row
  await page.goto('/creditSettlement/list');
  await page.waitForLoadState('networkidle').catch(() => {});
  const viewDetails = page.getByText('View Details', { exact: true }).first();
  if (await viewDetails.count()) {
    out.viewDetailsLink = await viewDetails.evaluate((e) => ({ href: e.closest('a')?.getAttribute('href'), onclick: e.closest('a')?.getAttribute('onclick') }));
    await viewDetails.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    out.details = await dumpPage(page);
    await shot(page, '07-details');
    console.log('details url:', page.url());
  }

  // 4. "View all credit settlements" (per TID)
  await page.goto('/creditSettlement/list');
  await page.waitForLoadState('networkidle').catch(() => {});
  const viewAll = page.getByText('View all credit settlements').first();
  if (await viewAll.count()) {
    out.viewAllLink = await viewAll.evaluate((e) => ({ href: e.closest('a')?.getAttribute('href') }));
    await viewAll.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    out.viewAll = await dumpPage(page);
    await shot(page, '08-view-all-for-tid');
    console.log('view all url:', page.url());
  }

  // 5. Schedule Force Settlement (open + record only, NOTHING submitted)
  await page.goto('/creditSettlement/list');
  const force = page.locator('#leftPanel a').filter({ hasText: /Schedule Force Settlement/ }).first();
  if (await force.count()) {
    await force.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    out.forceSettlement = await dumpPage(page);
    await shot(page, '09-schedule-force-settlement');
    console.log('force settlement url:', page.url());
  }

  const file = `${OUT_DIR}/credit-settlement-${env}.json`;
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`saved ${file}`);
});
