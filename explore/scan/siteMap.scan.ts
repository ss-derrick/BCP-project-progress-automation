// READ-ONLY site map of the System Portal of ENV_NAME: every top-menu module,
// every quicklink, and detail pages up to MAX_DEPTH (e.g. View Details).
// Only OPENS pages (GET via their link): never submits a form or clicks a button.
// Links that could change data (delete / settle / enable / reset / approve /
// logout / download ...) are recorded but never opened.
// Records per page: title, wizard steps, form fields, buttons, table columns, links.
// No row data is saved (only column names / counts), so the JSON is safe to commit.
//   $env:ENV_NAME='UAT-FASSBAYAR'; npx playwright test --config explore/scan/scan.config.ts siteMap
// Output: explore/scan/results/site-map-<env>.json, screenshots in test-results/site-map-<env>/
import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { BASE_URL, Credentials, ENV_NAME, PORTAL } from '../../portals.config';

const env = ENV_NAME.toLowerCase();
const MAX_DEPTH = 3;          // 0 = top menu, 1 = quicklinks, 2-3 = detail pages
const MAX_PAGES = 120;
const SHOTS = `test-results/site-map-${env}`;

// Never opened (judged by the link ADDRESS): links that act straight away on GET
// (delete / void / reset password / settle / enable / logout) or download a file
// (export / template / receipt / print). Pages that only SHOW a form are opened.
const UNSAFE = /logout|delete|void|refund|resetPassword|reset|settleCredit|approve|reject|resend|unlock|activate|deactivate|enable|disable|terminate|revoke|assign|export|Export|download|getTemplate|doPrint|getItemReceipt|exportError/i;

// Same page with another id = one pattern: /company/viewDetails?itemid=35 -> /company/viewDetails?itemid=#
const patternOf = (url: string): string => {
  const u = new URL(url);
  const params = [...u.searchParams.keys()].sort().map((k) => `${k}=#`).join('&');
  return u.pathname.replace(/\/\d+(?=\/|$)/g, '/#') + (params ? `?${params}` : '');
};

interface PageInfo {
  pattern: string; url: string; depth: number; from: string; via: string;
  title: string; headings: string[]; steps: string[]; quicklinks: { text: string; href: string }[];
  fields: { label: string; name: string; type: string; options?: string[]; required: boolean }[];
  buttons: string[]; tables: { columns: string[]; rows: number }[]; totalRecords: string;
  links: { text: string; href: string; unsafe: boolean }[]; messages: string[]; error?: string;
}

async function readPage(page: Page): Promise<Omit<PageInfo, 'pattern' | 'url' | 'depth' | 'from' | 'via'>> {
  return page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const main = document.querySelector('#rightMainContent') ?? document.querySelector('#mainContainer') ?? document.body;
    const labelOf = (el: HTMLElement): string => {
      const id = el.id && document.querySelector(`label[for="${el.id}"]`);
      if (id) return txt(id);
      const box = el.closest('.formInput, td, .formRow');
      let prev = box?.previousElementSibling;
      while (prev && !txt(prev)) prev = prev.previousElementSibling;
      const t = txt(prev) || txt(el.closest('label')) || (el as HTMLInputElement).placeholder || '';
      return t.slice(0, 60);
    };
    const fields = Array.from(main.querySelectorAll('input, select, textarea'))
      .filter((e) => { const i = e as HTMLInputElement; return i.type !== 'hidden' && i.type !== 'submit' && !i.classList.contains('hideBtn') && (vis(e) || i.tagName === 'SELECT'); })
      .map((e) => {
        const i = e as HTMLInputElement;
        const label = labelOf(i);
        return {
          label: label || i.name, name: i.name || i.id, type: i.tagName === 'SELECT' ? (i.multiple ? 'multi-select' : 'select') : i.type,
          options: i.tagName === 'SELECT' ? Array.from((i as unknown as HTMLSelectElement).options).map((o) => txt(o)).slice(0, 25) : undefined,
          required: /^\*/.test(label)
        };
      });
    const buttons = Array.from(main.querySelectorAll('a.button, a.btn, button, input[type=button], .btnL'))
      .filter(vis).map((b) => txt(b) || (b as HTMLInputElement).value).filter(Boolean);
    const tables = Array.from(main.querySelectorAll('table')).filter(vis).map((t) => ({
      columns: Array.from(t.querySelectorAll('tr.dataTitleMid th, thead th')).map(txt).filter(Boolean),
      rows: t.querySelectorAll('tr.dataListMid, tbody tr.dataListMid').length
    })).filter((t) => t.columns.length);
    const links = Array.from(main.querySelectorAll('a[href]')).filter(vis).map((a) => ({
      text: txt(a).slice(0, 50), href: (a as HTMLAnchorElement).href
    })).filter((l) => l.text && /^https?:/.test(l.href));
    return {
      title: txt(main.querySelector('.barPaddTitle')) || txt(main.querySelector('.title24Black')) || document.title,
      headings: Array.from(new Set(Array.from(main.querySelectorAll('.barPaddTitle, .title24Black, .txt20, h1, h2, h3, legend, .confirmTitle'))
        .filter(vis).map(txt).filter((t) => t && t.length < 80))).slice(0, 20),
      steps: Array.from(main.querySelectorAll('#steps li .s1, #steps li .s2, #steps li .s3, #steps li .s4, #steps li .s5, #steps li div')).map(txt).filter(Boolean),
      quicklinks: Array.from(document.querySelectorAll('#leftPanel a')).map((a) => ({ text: txt(a), href: (a as HTMLAnchorElement).href })),
      fields, buttons: Array.from(new Set(buttons)), tables,
      totalRecords: (main.textContent?.match(/Total Records:\s*\d+/) ?? [''])[0],
      links: links.map((l) => ({ ...l, unsafe: false })),
      messages: Array.from(main.querySelectorAll('.errorMsg, .txt20, .noRecord, [class*=error]')).filter(vis).map(txt).filter((t) => t && t.length < 150).slice(0, 5)
    };
  });
}

test(`site map of ${ENV_NAME}`, async ({ page }) => {
  test.setTimeout(30 * 60_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const origin = new URL(BASE_URL).origin;

  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });

  // top menu
  const topMenu = await page.locator('#topNavi a[href], #topNaviContainer a[href]').evaluateAll((as) =>
    as.map((a) => ({ text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), href: (a as HTMLAnchorElement).href }))
      .filter((a) => a.text));
  console.log('top menu:', topMenu.map((m) => m.text).join(' | '));

  const queue: { url: string; depth: number; from: string; via: string }[] =
    topMenu.map((m) => ({ url: m.href, depth: 0, from: 'top menu', via: m.text }));
  const seen = new Set<string>();
  const pages: PageInfo[] = [];
  const skipped: { href: string; text: string; on: string }[] = [];

  while (queue.length && pages.length < MAX_PAGES) {
    const item = queue.shift()!;
    if (!item.url.startsWith(origin)) continue;
    const pattern = patternOf(item.url);
    if (seen.has(pattern)) continue;
    seen.add(pattern);

    let info: PageInfo;
    try {
      await page.goto(item.url, { timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      if (/\/auth\/login/.test(page.url())) throw new Error(`logged out (${page.url()})`);
      info = { pattern, url: patternOf(page.url()), depth: item.depth, from: item.from, via: item.via, ...(await readPage(page)) };
      await page.screenshot({ path: `${SHOTS}/${String(pages.length + 1).padStart(3, '0')}-${pattern.replace(/[^a-z0-9]+/gi, '_').slice(0, 80)}.png`, fullPage: true }).catch(() => {});
    } catch (e) {
      info = { pattern, url: item.url, depth: item.depth, from: item.from, via: item.via, title: '', headings: [], steps: [], quicklinks: [],
        fields: [], buttons: [], tables: [], totalRecords: '', links: [], messages: [], error: (e as Error).message.split('\n')[0] };
      if (/logged out/.test(info.error!)) {
        pages.push(info);
        console.log('STOP: logged out (account used elsewhere?)');
        break;
      }
    }
    pages.push(info);
    console.log(`${String(pages.length).padStart(3)} d${item.depth} ${pattern}  "${info.title}"${info.error ? '  ERROR ' + info.error : ''}`);

    if (item.depth >= MAX_DEPTH) continue;
    const next = [
      ...info.quicklinks.map((l) => ({ ...l, kind: 'quicklink' })),
      ...info.links.map((l) => ({ ...l, kind: 'link' }))
    ];
    for (const l of next) {
      if (!l.href.startsWith(origin) || /javascript:|#$/.test(l.href)) continue;
      if (UNSAFE.test(new URL(l.href).pathname)) {
        const s = info.links.find((x) => x.href === l.href); if (s) s.unsafe = true;
        skipped.push({ href: patternOf(l.href), text: l.text, on: pattern });
        continue;
      }
      if (!seen.has(patternOf(l.href))) {
        queue.push({ url: l.href, depth: l.kind === 'quicklink' ? Math.max(1, item.depth) : item.depth + 1, from: pattern, via: l.text });
      }
    }
  }

  const out = { env: ENV_NAME, portal: PORTAL, scannedAt: new Date().toISOString(), topMenu: topMenu.map((m) => ({ text: m.text, href: patternOf(m.href) })),
    pages, notOpened: Array.from(new Map(skipped.map((s) => [s.href + s.text, s])).values()) };
  fs.mkdirSync('explore/scan/results', { recursive: true });
  fs.writeFileSync(`explore/scan/results/site-map-${env}.json`, JSON.stringify(out, null, 2));
  console.log(`saved explore/scan/results/site-map-${env}.json: ${pages.length} pages, ${out.notOpened.length} unsafe links not opened`);
});
