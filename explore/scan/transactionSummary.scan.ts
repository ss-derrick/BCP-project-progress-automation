// READ-ONLY scan of Manage Transactions > Transaction Summary on the portal of ENV_NAME.
// Logs in, opens the page from the top menu, records its controls and table,
// searches the environment's known trxID, records the result row, then opens
// that transaction's details ONLY through a "View Details"-type link/option.
// Never clicks void / refund / settle / reverse / suspend / export.
// Output: explore/scan/results/transaction-summary-<env>-*.json / .png
import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME, PORTAL } from '../../portals.config';
import { knownTransactionFor } from '../../common/testdata/knownTransactions';

const OUT = 'explore/scan/results';
const env = ENV_NAME.toLowerCase();
const DANGER = /void|refund|reverse|settle|suspend|cancel|delete|export|adjust|approve|reject|resend/i;

async function dump(page: Page, name: string): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {});
  const data = await page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const controls = Array.from(document.querySelectorAll('input, select, textarea, button, a'))
      .filter((e) => vis(e) && (e as HTMLInputElement).type !== 'hidden')
      .map((e) => {
        const el = e as HTMLInputElement;
        return {
          tag: el.tagName.toLowerCase(), id: el.id, name: el.getAttribute('name') ?? '', type: el.getAttribute('type') ?? '',
          cls: el.className?.toString().slice(0, 60), href: el.getAttribute('href') ?? '', onclick: (el.getAttribute('onclick') ?? '').slice(0, 80),
          value: el.tagName === 'SELECT' ? '' : (el.value ?? '').slice(0, 40), text: txt(el).slice(0, 60),
          form: el.form?.getAttribute('name') ?? el.closest('form')?.getAttribute('name') ?? '',
          options: el.tagName === 'SELECT'
            ? Array.from((el as unknown as HTMLSelectElement).options).map((o) => `${o.value}=${txt(o)}`) : undefined
        };
      });
    const tables = Array.from(document.querySelectorAll('table')).filter(vis).map((t) => ({
      id: t.id, cls: t.className,
      headers: Array.from(t.querySelectorAll('th')).map(txt).filter(Boolean),
      rows: Array.from(t.querySelectorAll('tr')).slice(0, 8).map((r) => ({
        cls: r.className, cells: Array.from(r.querySelectorAll('td')).map((c) => txt(c).slice(0, 80))
      })).filter((r) => r.cells.some(Boolean))
    }));
    const labels = Array.from(document.querySelectorAll('#rightMainContent *'))
      .filter((e) => e.children.length === 0 && vis(e)).map(txt).filter((t) => t && t.length < 80);
    return { url: location.href, title: document.title, controls, tables, texts: Array.from(new Set(labels)).slice(0, 200) };
  });
  fs.writeFileSync(`${OUT}/transaction-summary-${env}-${name}.json`, JSON.stringify({ env: ENV_NAME, portal: PORTAL, ...data }, null, 2));
  await page.screenshot({ path: `${OUT}/transaction-summary-${env}-${name}.png`, fullPage: true });
  console.log(`[${name}] ${data.url} | ${data.title} | ${data.controls.length} controls, ${data.tables.length} tables`);
}

test(`scan Transaction Summary on ${ENV_NAME}`, async ({ page }) => {
  const trx = knownTransactionFor(ENV_NAME);
  fs.mkdirSync(OUT, { recursive: true });

  // login
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });

  // top menu: Manage Transactions
  const menu = page.locator('#topNavi a').filter({ hasText: /Manage\s*Transactions/i }).first();
  console.log('menu href:', await menu.getAttribute('href'));
  await menu.click();
  await page.waitForLoadState('domcontentloaded');
  await dump(page, '1-menu');

  // left panel / quicklink: Transaction Summary (if not already there)
  const summaryLink = page.getByRole('link', { name: /Transaction Summary/i }).first();
  if (await summaryLink.isVisible().catch(() => false)) {
    console.log('summary href:', await summaryLink.getAttribute('href'));
    await summaryLink.click();
    await page.waitForLoadState('domcontentloaded');
  }
  await dump(page, '2-summary');

  if (!trx) { console.log('no known trxID for this environment'); return; }

  // search: the first visible text box in a form that has a "Search" link/button
  const box = page.locator('#search').or(page.locator('form:has(a:text-is("Search")) input[type="text"]')).first();
  await box.click();
  await box.fill(trx.trxId);
  const searchBtn = page.locator('form', { has: box }).getByRole('link', { name: 'Search', exact: true })
    .or(page.locator('form', { has: box }).getByRole('button', { name: /Search/i })).first();
  await searchBtn.click();
  await page.waitForLoadState('domcontentloaded');
  await dump(page, '3-search');

  // details: only a View Details option / a link on the trxID itself
  const row = page.locator('tr').filter({ hasText: trx.trxId }).last();
  if (!(await row.count())) { console.log('trxID row not found'); return; }
  const select = row.locator('select').first();
  if (await select.count()) {
    const options = await select.locator('option').allTextContents();
    console.log('row quicklink options:', options.map((o) => o.trim()).join(' | '));
    const view = options.map((o) => o.trim()).find((o) => /view.*detail|detail/i.test(o) && !DANGER.test(o));
    if (!view) { console.log('no View Details option - stop'); return; }
    await select.selectOption({ label: view });
    await row.getByRole('link', { name: 'Go' }).click();
  } else {
    const link = row.locator('a').filter({ hasText: new RegExp(`${trx.trxId}|detail`, 'i') }).first();
    if (!(await link.count()) || DANGER.test(await link.innerText())) { console.log('no safe details link - stop'); return; }
    await link.click();
  }
  await page.waitForLoadState('domcontentloaded');
  await dump(page, '4-details');
  // nothing else is clicked
});
