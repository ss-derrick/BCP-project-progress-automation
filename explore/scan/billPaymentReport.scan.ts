// READ-ONLY scan of Manage Transactions > Bill Payment Report (FASSBAYAR ONLY).
// Opens the page and records its fields (pass 1). The search + View Details
// pass is added once the fields are known. Never clicks export / void / delete.
// Output: explore/scan/results/bill-payment-<env>-*.json / .png
import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME, PORTAL } from '../../portals.config';

const OUT = 'explore/scan/results';
const env = ENV_NAME.toLowerCase();

export async function dump(page: Page, name: string): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {});
  const data = await page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const main = document.querySelector('#rightMainContent') ?? document.body;
    const controls = Array.from(main.querySelectorAll('input, select, textarea, button, a'))
      .filter((e) => (e as HTMLInputElement).type !== 'hidden')
      .map((e) => {
        const el = e as HTMLInputElement;
        return {
          tag: el.tagName.toLowerCase(), id: el.id, name: el.getAttribute('name') ?? '', type: el.getAttribute('type') ?? '',
          cls: el.className?.toString().slice(0, 60), href: el.getAttribute('href') ?? '', onclick: (el.getAttribute('onclick') ?? '').slice(0, 100),
          value: el.tagName === 'SELECT' ? '' : (el.value ?? '').slice(0, 40), text: txt(el).slice(0, 60), visible: vis(el),
          readonly: el.readOnly ?? false, form: el.form?.getAttribute('name') ?? '',
          label: txt(el.closest('td, div')?.previousElementSibling).slice(0, 40),
          options: el.tagName === 'SELECT'
            ? Array.from((el as unknown as HTMLSelectElement).options).map((o) => `${o.value}=${txt(o)}`).slice(0, 30) : undefined
        };
      });
    const forms = Array.from(main.querySelectorAll('form')).map((f) => ({
      name: f.getAttribute('name'), id: f.id, action: f.getAttribute('action'), method: f.getAttribute('method')
    }));
    const tables = Array.from(main.querySelectorAll('table')).filter(vis).map((t) => ({
      id: t.id, cls: t.className,
      headers: Array.from(t.querySelectorAll('th')).map(txt).filter(Boolean),
      rows: Array.from(t.querySelectorAll('tr')).slice(0, 8).map((r) => ({
        cls: r.className, cells: Array.from(r.querySelectorAll('td')).map((c) => txt(c).slice(0, 80))
      })).filter((r) => r.cells.some(Boolean))
    }));
    const texts = Array.from(main.querySelectorAll('*'))
      .filter((e) => e.children.length === 0 && vis(e)).map(txt).filter((t) => t && t.length < 80);
    const w = window as unknown as { $?: unknown };
    return { url: location.href, title: document.title, jquery: !!w.$, forms, controls, tables, texts: Array.from(new Set(texts)).slice(0, 200) };
  });
  fs.writeFileSync(`${OUT}/bill-payment-${env}-${name}.json`, JSON.stringify({ env: ENV_NAME, portal: PORTAL, ...data }, null, 2));
  await page.screenshot({ path: `${OUT}/bill-payment-${env}-${name}.png`, fullPage: true });
  console.log(`[${name}] ${data.url} | ${data.title} | ${data.controls.length} controls, ${data.tables.length} tables`);
}

test(`scan Bill Payment Report on ${ENV_NAME}`, async ({ page }) => {
  test.skip(PORTAL !== 'fassbayar', 'Bill Payment Report exists on Fassbayar only');
  fs.mkdirSync(OUT, { recursive: true });

  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });

  await page.locator('#topNavi a[href="/transaction"]').click();
  await page.waitForLoadState('domcontentloaded');
  const link = page.getByRole('link', { name: 'Bill Payment Report', exact: true }).first();
  console.log('link href:', await link.getAttribute('href'));
  await link.click();
  await page.waitForLoadState('domcontentloaded');
  await dump(page, '1-page');

  // pass 2: Business Name + date range (read-only jQuery UI date pickers)
  const form = page.locator('form[name="filterForm"]');
  await form.locator('input[name="businessName"]').fill('Harris_LH');
  await page.waitForLoadState('load');
  for (const [id, value] of [['#fromdate3', '01 Oct 2026'], ['#todate3', '01 Nov 2026']] as const) {
    const box = page.locator(id);
    console.log(`${id} before: "${await box.inputValue()}"`);
    await box.evaluate((el, v) => {
      const jq = (window as unknown as { $: (e: Element) => { datepicker: (c: string, v: string) => void } }).$(el);
      jq.datepicker('setDate', v);
    }, value);
    console.log(`${id} after:  "${await box.inputValue()}"`);
  }
  await form.getByRole('link', { name: 'Search', exact: true }).click();
  await page.waitForLoadState('domcontentloaded');
  await dump(page, '2-search');

  // View Details on the Harris_LH row only
  const row = page.locator('tr').filter({ hasText: 'Harris_LH' }).first();
  if (!(await row.count())) { console.log('Harris_LH row not found - stop'); return; }
  const links = await row.locator('a, select').evaluateAll((els) => els.map((e) => `${e.tagName}:${(e.textContent ?? '').trim()}:${e.getAttribute('href') ?? ''}`));
  console.log('row links:', links.join(' | '));
  const view = row.getByRole('link', { name: /View Details/i }).first();
  if (!(await view.count())) { console.log('no View Details link - stop'); return; }
  await view.click();
  await page.waitForLoadState('domcontentloaded');
  await dump(page, '3-details');
});
