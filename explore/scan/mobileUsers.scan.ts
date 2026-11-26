// READ-ONLY exploration of Manage Mobile Users for the MU cases (APH TC-APH-BP-MU-001..029 rows 119-146,
// Fassbayar TC-FB-BP-MU-001..029 rows 134-159): Mobile User Summary (filters, columns, Quicklink, searches),
// company view, Add a Mobile User (company search, registration form, blank Submit errors; never Confirm),
// a company with no Available TID, Mobile User Details (labels, flags, buttons, Status / Sync History pop-ups,
// Reset PIN and Revoke SSO pop-ups opened and CANCELLED), Edit Mobile User Details (opened, blank Submit, Cancel)
// and the Suspend / Reinstate forms (opened only, never submitted).
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts mobileUsers
// Output: explore/scan/results/mobileUsers-<env>.json (local only), screenshots test-results/mobileUsers-<env>/
import { test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME } from '../../portals.config';

const env = ENV_NAME.toLowerCase();
const SHOTS = `test-results/mobileUsers-${env}`;
// Test Data sheet: TD-06 reference company (read only), TD-07 working company
const TD = ENV_NAME.includes('APH')
  ? { ref: 'onn parent company', work: 'testcreate888' }
  : { ref: 'SS FP TEST', work: 'TEST COMPANY AUTOMATION 1' };

let n = 1;
const shot = async (page: Page, label: string) =>
  page.screenshot({ path: `${SHOTS}/${String(n++).padStart(2, '0')}-${label.replace(/[^\w-]+/g, '_').slice(0, 60)}.png`, fullPage: true }).catch(() => {});

// Everything a test needs from one screen
async function dump(page: Page) {
  await page.waitForLoadState('load').catch(() => {});
  return page.evaluate(() => {
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const txt = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const main = document.querySelector('#rightMainContent') ?? document.body;
    return {
      url: location.pathname + location.search,
      title: document.title,
      headings: [...main.querySelectorAll('h1,h2,h3,h4,.barPaddTitle,.title24Black,.title18Black,.font22PinkB,.sectionTitle,legend')].filter(vis).map(txt).filter(Boolean),
      fields: [...main.querySelectorAll('input,select,textarea')].filter((e) => (e as HTMLInputElement).type !== 'hidden').map((e) => {
        const i = e as HTMLInputElement;
        const label = i.id ? txt(document.querySelector(`label[for="${i.id}"]`)) : '';
        return { tag: e.tagName, name: i.name, id: i.id, type: i.type, maxlength: i.maxLength, placeholder: i.placeholder, value: i.value,
          checked: i.checked, readonly: i.readOnly, disabled: i.disabled, visible: vis(e), label,
          options: e.tagName === 'SELECT' ? [...(e as HTMLSelectElement).options].map((o) => o.text.trim()) : undefined };
      }),
      columns: [...main.querySelectorAll('table th, thead td')].filter(vis).map(txt).filter(Boolean),
      rows: [...main.querySelectorAll('table tbody tr')].filter(vis).slice(0, 6).map((r) => [...r.querySelectorAll('td')].map(txt)),
      links: [...main.querySelectorAll('a,button,input[type=button],input[type=submit]')].filter(vis)
        .map((a) => ({ text: txt(a) || (a as HTMLInputElement).value, href: a.getAttribute('href'), id: a.id, onclick: (a.getAttribute('onclick') ?? '').slice(0, 120) }))
        .filter((a) => a.text),
      leftPanel: [...document.querySelectorAll('.quicklinkBox a, #leftPanel a, .leftNav a, .sideBar a')].filter(vis).map(txt),
      errors: [...main.querySelectorAll('[id$="Error"], .error, .errorMsg, .errormsg, .fieldError')].filter(vis).map((e) => ({ id: e.id, text: txt(e) })).filter((e) => e.text),
      text: (main as HTMLElement).innerText.replace(/[ \t]+/g, ' ').slice(0, 4000)
    };
  });
}

test(`explore Manage Mobile Users on ${ENV_NAME}`, async ({ page }) => {
  test.setTimeout(15 * 60_000);
  page.setDefaultTimeout(20_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const out: Record<string, unknown> = { env: ENV_NAME, scannedAt: new Date().toISOString(), td: TD };
  const safe = async (key: string, fn: () => Promise<unknown>) => { try { out[key] = await fn(); } catch (e) { out[key] = { error: String(e).slice(0, 300) }; } };
  const dialogs: string[] = [];
  out.dialogs = dialogs;
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });

  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });

  // 1. Mobile User Summary
  await page.goto('/mobileUser');
  await shot(page, 'summary');
  await safe('summary', () => dump(page));
  await safe('quicklinkOptions', () => page.locator('#dataRow tr.dataListMid select').first().evaluate((s) => [...(s as HTMLSelectElement).options].map((o) => o.text.trim())));

  // 2. searches (by the first row's Mobile User ID, by its TID, MID filter, Suspended)
  await safe('searches', async () => {
    const first = (await page.locator('#dataRow tr.dataListMid').first().locator('td').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const res: Record<string, unknown> = { firstRow: first };
    const runSearch = async (label: string, value: string) => {
      await page.goto('/mobileUser');
      await page.locator('#search').fill(value);
      await page.locator('#search').press('Enter');
      await page.waitForLoadState('load');
      await shot(page, `search-${label}`);
      const d = await dump(page);
      res[label] = { value, url: d.url, rows: d.rows, total: (d.text.match(/Total Records:?\s*\d+/) ?? [''])[0] };
    };
    if (first[1]) await runSearch('muid', first[1]);
    if (first[2]) await runSearch('tid', first[2].split(/[ ,]/)[0]);
    return res;
  });
  await safe('filterSuspended', async () => {
    await page.goto('/mobileUser');
    await page.locator('select[name="status"]').first().selectOption({ label: 'Suspended' });
    await page.locator('#rightMainContent a, #rightMainContent button').filter({ hasText: /^\s*Search\s*$/ }).last().click();
    await page.waitForLoadState('load');
    await shot(page, 'filter-suspended');
    const d = await dump(page); return { url: d.url, rows: d.rows, total: (d.text.match(/Total Records:?\s*\d+/) ?? [''])[0] };
  });

  // 3. company view of the reference company (TD-06): All Companies -> details -> mobile users link
  await safe('companyView', async () => {
    await page.goto('/company');
    await page.locator('#search').fill(TD.ref);
    await page.locator('#search').press('Enter');
    await page.waitForLoadState('load');
    const row = page.locator('#dataRow tr.dataListMid').first();
    const sel = row.locator('select');
    const opts = await sel.evaluate((s) => [...(s as HTMLSelectElement).options].map((o) => o.text.trim()));
    const mu = opts.find((o) => /mobile user/i.test(o));
    const res: Record<string, unknown> = { companyRow: await row.innerText(), quicklinks: opts };
    if (mu) {
      await sel.selectOption({ label: mu });
      await row.locator('a, button, input[type=button]').filter({ hasText: /^\s*Go\s*$/ }).first().click();
      await page.waitForLoadState('load');
      await shot(page, 'company-view');
      res.view = await dump(page);
    }
    return res;
  });

  // 4. Add a Mobile User: company search, then the working company's form; blank Submit (never Confirm)
  await safe('registerSearch', async () => {
    await page.goto('/mobileUser/registerSearch');
    await shot(page, 'register-search');
    const before = await dump(page);
    await page.locator('#search').fill(TD.work);
    await page.locator('#search').press('Enter');
    await page.waitForLoadState('load');
    await shot(page, 'register-search-result');
    return { before, result: await dump(page) };
  });
  await safe('registerForm', async () => {
    await page.locator('#dataRow a[href*="register?itemid"]').first().click();
    await page.waitForLoadState('load');
    await shot(page, 'register-form');
    const form = await dump(page);
    const hints = await page.locator('#rightMainContent').evaluate((m) => [...m.querySelectorAll('*')].filter((e) => e.children.length === 0)
      .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).filter((t) => /Between|characters|digits|Max|e\.g\.|\(.*\)/.test(t)).slice(0, 40));
    // blank Submit
    const submit = page.locator('#rightMainContent a, #rightMainContent button, #rightMainContent input[type=button]').filter({ hasText: /^\s*Submit\s*$/ }).first();
    let blank: unknown = null;
    if (await submit.count()) {
      await submit.click();
      await page.waitForTimeout(1500);
      await shot(page, 'register-blank-submit');
      blank = await dump(page);
    }
    return { form, hints, blank };
  });

  // 5. a company with no Available TID: open the register form of each company on the first result pages
  await safe('noTid', async () => {
    const hrefs: string[] = [];
    for (const term of ['', 'test', 'qa']) {
      await page.goto(`/mobileUser/registerSearch?search=${term}&action=search`);
      await page.waitForLoadState('load');
      for (const h of await page.locator('#dataRow a[href*="register?itemid"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? '')))
        if (!hrefs.includes(h)) hrefs.push(h);
    }
    const tried: string[] = [];
    for (const h of hrefs.slice(0, 40)) {
      await page.goto(`/mobileUser/${h}`);
      await page.waitForLoadState('load');
      tried.push(h);
      const t = await page.locator('#rightMainContent').innerText();
      if (/ran out of Terminal ID/i.test(t)) { await shot(page, 'no-tid'); return { href: h, page: await dump(page), tried: tried.length }; }
    }
    return { found: false, tried };
  });

  // 6. Mobile User Details of the first listed mobile user of the reference company
  let detailsUrl = '';
  await safe('details', async () => {
    await page.goto('/mobileUser');
    const row = page.locator('#dataRow tr.dataListMid').first();
    const sel = row.locator('select');
    await sel.selectOption({ label: 'View Details' });
    await row.locator('a, button, input[type=button]').filter({ hasText: /^\s*Go\s*$/ }).first().click();
    await page.waitForLoadState('load');
    detailsUrl = page.url();
    await shot(page, 'details');
    return dump(page);
  });
  const popup = async (trigger: RegExp, label: string, cancel = true) => {
    await page.goto(detailsUrl);
    const link = page.locator('#rightMainContent a, #rightMainContent button').filter({ hasText: trigger }).first();
    if (!(await link.count())) return { missing: String(trigger) };
    await link.click();
    await page.waitForTimeout(2500);
    await shot(page, label);
    const frame = page.frameLocator('#fancybox-wrap iframe, .fancybox-wrap iframe, .fancybox-inner iframe').first();
    const text = await frame.locator('body').innerText({ timeout: 8000 }).catch(async () =>
      (await page.locator('#fancybox-wrap, .fancybox-wrap, .ui-dialog, .modal').first().innerText().catch(() => '')));
    const buttons = await frame.locator('a, button, input[type=button]').allInnerTexts().catch(() => []);
    if (cancel) {
      const c = frame.locator('a, button, input[type=button]').filter({ hasText: /^\s*(Cancel|Close)\s*$/i }).first();
      if (await c.count()) await c.click().catch(() => {}); else await page.keyboard.press('Escape');
    }
    return { text: text.replace(/\s+/g, ' ').trim().slice(0, 1500), buttons, url: page.url() };
  };
  await safe('statusHistory', () => popup(/Status History/, 'status-history'));
  await safe('syncHistory', () => popup(/Sync History/, 'sync-history'));
  await safe('resetPinPopup', () => popup(/^\s*Reset User PIN\s*$/, 'reset-pin-popup'));
  await safe('revokeSsoPopup', () => popup(/^\s*Revoke SSO Token\s*$/, 'revoke-sso-popup'));

  // 7. Edit Mobile User Details: open, blank Submit, never Confirm
  await safe('edit', async () => {
    await page.goto(detailsUrl);
    await page.locator('#rightMainContent a, #rightMainContent button').filter({ hasText: /Edit Mobile User Details/ }).first().click();
    await page.waitForLoadState('load');
    await shot(page, 'edit');
    const form = await dump(page);
    for (const id of ['name', 'contact_prefix', 'contact_body', 'email']) await page.locator(`#rightMainContent #${id}`).fill('').catch(() => {});
    await page.locator('#rightMainContent a, #rightMainContent button').filter({ hasText: /^\s*Submit\s*$/ }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, 'edit-blank-submit');
    return { form, blank: await dump(page) };
  });

  // 8. Suspend form (open only) and the Reinstate form of a suspended user, if the list has one
  await safe('suspendForm', async () => {
    await page.goto(detailsUrl);
    await page.locator('#rightMainContent a, #rightMainContent button').filter({ hasText: /Suspend Mobile User Access/ }).first().click();
    await page.waitForLoadState('load');
    await shot(page, 'suspend-form');
    const d = await dump(page);
    await page.locator('#rightMainContent textarea').first().fill('abcdefghij').catch(() => {});
    const counter = await page.locator('#rightMainContent').innerText();
    return { form: d, counterAfter10: (counter.match(/Max characters:?\s*\d+\s*remaining/i) ?? [''])[0] };
  });
  await safe('reinstateForm', async () => {
    await page.goto('/mobileUser');
    await page.locator('select[name="status"]').first().selectOption({ label: 'Suspended' });
    await page.locator('#rightMainContent a, #rightMainContent button').filter({ hasText: /^\s*Search\s*$/ }).last().click();
    await page.waitForLoadState('load');
    const row = page.locator('#dataRow tr.dataListMid').first();
    const sel = row.locator('select');
    const opts = await sel.evaluate((s) => [...(s as HTMLSelectElement).options].map((o) => o.text.trim())).catch(() => []);
    const r = opts.find((o) => /Reinstate/.test(o));
    if (!r) return { none: true, opts };
    await sel.selectOption({ label: r });
    await row.locator('a, button, input[type=button]').filter({ hasText: /^\s*Go\s*$/ }).first().click();
    await page.waitForLoadState('load');
    await shot(page, 'reinstate-form');
    return { quicklinks: opts, form: await dump(page) };
  });

  fs.mkdirSync('explore/scan/results', { recursive: true });
  fs.writeFileSync(`explore/scan/results/mobileUsers-${env}.json`, JSON.stringify(out, null, 2));
});
