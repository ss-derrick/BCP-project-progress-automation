// READ-ONLY exploration of Home (/console) for the HOME test cases (APH TC-APH-BP-HOME-003..005,
// Fassbayar TC-FB-BP-HOME-001..002): header (greeting, clock, last login), top menu, the Quicklinks panel by
// module, the Daily Transaction Snapshot (heading, chart slices, how the amounts are stored, View Details)
// and today's Transaction Summary totals by status. Clicks only links (no form is submitted).
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts home
// Output: explore/scan/results/home-<env>.json (local only), screenshots test-results/home-<env>/
import { test } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME } from '../../portals.config';

const env = ENV_NAME.toLowerCase();
const SHOTS = `test-results/home-${env}`;

test(`explore Home on ${ENV_NAME}`, async ({ page }) => {
  test.setTimeout(10 * 60_000);
  page.setDefaultTimeout(20_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/01-home.png`, fullPage: true });

  const out: Record<string, unknown> = { env: ENV_NAME, scannedAt: new Date().toISOString(), url: page.url(), docTitle: await page.title() };
  out.page = await page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    return {
      header: txt(document.querySelector('.loginInfo')) || txt(document.querySelector('#header')),
      headerHtml: (document.querySelector('.loginInfo')?.outerHTML ?? '').slice(0, 800),
      topMenu: Array.from(document.querySelectorAll('#topNavi a')).map((a) => ({ text: txt(a), href: a.getAttribute('href') })),
      mainText: txt(document.querySelector('#rightMainContent') ?? document.querySelector('#mainContent') ?? document.body).slice(0, 1500),
      // Quicklinks panel boxes: heading + links
      panels: Array.from(document.querySelectorAll('h1, h2, h3, .title, .boxTitle, .quickTitle, div[class*=title]')).filter(vis)
        .map((h) => ({ tag: h.tagName, cls: h.className, text: txt(h) })).filter((h) => h.text && h.text.length < 60).slice(0, 40),
      links: Array.from(document.querySelectorAll('a[href]')).filter(vis).map((a) => ({ text: txt(a), href: a.getAttribute('href'),
        box: txt(a.closest('div[class]')?.querySelector('h1, h2, h3, .title, [class*=itle]')) })),
      scripts: Array.from(document.scripts).map((s) => s.textContent ?? '').filter((t) => /chart|Chart|pie|series|data\s*[:=]/.test(t)).map((t) => t.replace(/\s+/g, ' ').slice(0, 3000)),
      scriptSrc: Array.from(document.scripts).map((s) => s.src).filter(Boolean),
      canvasOrSvg: Array.from(document.querySelectorAll('canvas, svg')).filter(vis).map((e) => ({ tag: e.tagName, id: e.id, cls: (e as HTMLElement).className?.toString?.() ?? '' })),
      snapshot: txt(Array.from(document.querySelectorAll('div, td')).find((d) => /Daily Transaction Snapshot/.test(d.textContent ?? '') && (d.textContent ?? '').length < 400) ?? null)
    };
  });
  // chart library data, if any (Highcharts / Chart.js / flot / jqplot)
  out.chartData = await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const res: Record<string, unknown> = {};
    try { if (w.Highcharts) res.highcharts = w.Highcharts.charts.filter(Boolean).map((c: any) => c.series.map((s: any) => s.data.map((p: any) => ({ name: p.name, y: p.y })))); } catch (e) { res.hcErr = String(e); }
    try { if (w.Chart && w.Chart.instances) res.chartjs = Object.values(w.Chart.instances).map((c: any) => ({ labels: c.data.labels, data: c.data.datasets.map((d: any) => d.data) })); } catch (e) { res.cjErr = String(e); }
    res.globals = Object.keys(w).filter((k) => /chart|pie|data|settle|void|amount/i.test(k)).slice(0, 30);
    return res;
  });
  // View Details target
  const vd = page.getByText('View Details', { exact: true }).first();
  if (await vd.count()) {
    await vd.click(); await page.waitForLoadState('load');
    out.viewDetails = { url: page.url(), title: await page.title(), text: (await page.locator('#rightMainContent').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600) };
    await page.screenshot({ path: `${SHOTS}/02-view-details.png`, fullPage: true });
  }
  // Transaction Summary today: total + statuses on page 1
  await page.goto('/transaction'); await page.waitForLoadState('load');
  out.transactionsToday = {
    url: page.url(),
    text: (await page.locator('#rightMainContent').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 1200),
    columns: await page.locator('#dataRow tr.dataTitleMid th').allInnerTexts().catch(() => []),
    firstRows: await page.locator('#dataRow tr.dataListMid').evaluateAll((trs) => trs.slice(0, 5).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim()))).catch(() => [])
  };
  // each Home panel link: where it lands (title)
  await page.goto('/console'); await page.waitForLoadState('load');
  const links = ((out.page as any).links as { text: string; href: string }[]).filter((l) => l.href && l.href.startsWith('/') && !/logout/i.test(l.href));
  const landed: unknown[] = [];
  for (const l of links) {
    await page.goto(l.href).catch(() => {});
    await page.waitForLoadState('load').catch(() => {});
    landed.push({ text: l.text, href: l.href, url: page.url().replace(/^https?:\/\/[^/]+/, ''), title: await page.title(), heading: (await page.locator('.barPaddTitle, .title24Black').first().innerText().catch(() => '')).trim() });
  }
  out.linkTargets = landed;
  fs.mkdirSync('explore/scan/results', { recursive: true });
  fs.writeFileSync(`explore/scan/results/home-${env}.json`, JSON.stringify(out, null, 2));
  console.log(`saved explore/scan/results/home-${env}.json: ${landed.length} links`);
});
