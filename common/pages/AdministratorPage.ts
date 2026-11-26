import { Page, Locator, FrameLocator, expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import { BasePage } from './BasePage';
import { Timeouts } from '../../portals.config';
import { stopBeforeSaving } from '../utils/uatChanges';

// System Portal - Administrator (top menu "Administrator", /admin). SHARED page object for all its
// screens (read-only exploration 23 Nov 2026, explore/scan/administrator.scan.ts):
//   Manage Bank Users (/admin/list), Add a Bank User (/admin/register), Bank User Details (/admin/details),
//   Edit Bank User Details (/admin/updateDetails), Suspend / Reinstate (/admin/suspend, /admin/unsuspend),
//   System Error Log (/admin/errorLog) + Details, Audit Trail (/admin/auditTrail), IPP Plan code & Term
//   Summary (/admin/ippList) + Add / Details / Edit, Card Brand Settings (/admin/getCardBrandList) + Details /
//   Edit, Host Settings (/admin/getHostSettingDetails) + Edit.
// Which screens a portal has: portals.config.ts features (bankUsers, cardBrandSettings, hostSettings).
//
// How the screens work:
//   List rows: Quicklink = <select> + "Go" -> GET /admin/<action>?itemid=<row id>
//   Forms: Details -> [Submit] = validation / Review & Confirm -> [Confirm] SAVES. Tests only Submit and go Back.
//   Suspend / Reinstate: [Submit] saves at once -> tests call the page's own validateInput1() instead.
//   Pop-ups (fancybox iframe): Status History >>, Reset Password, Switch Bank User.

export const ADMIN_QUICKLINKS = ['Manage Bank Users', 'Add a Bank User', 'System Error Log', 'Audit Trail',
  'IPP Plan code & Term Summary', 'Add IPP Plan code & Term', 'Card Brand Settings', 'Host Settings'];

// "23 Nov 2026" in the portal's time zone, n months / years from today (date filter defaults)
export function portalDate(offset: { months?: number; years?: number } = {}): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
  if (offset.years) d.setFullYear(d.getFullYear() + offset.years);
  if (offset.months) d.setMonth(d.getMonth() + offset.months);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace('Sept', 'Sep');   // portal writes "Sep"
}

export class AdministratorPage extends BasePage {
  // Top menu of the module. ReadersPage reuses this page object with '/reader'.
  protected get menuPath(): string { return '/admin'; }
  get menuTab(): Locator { return this.page.locator(`#topNavi a[href="${this.menuPath}"]`); }
  readonly quicklinks = this.page.locator('#leftPanel a');
  readonly main = this.page.locator('#rightMainContent');
  readonly title = this.page.locator('.barPaddTitle').first();
  readonly filterForm = this.page.locator('form[name="filterForm"]');
  readonly searchBox = this.page.locator('#search');
  readonly rows = this.page.locator('#dataRow tr.dataListMid');
  readonly headers = this.page.locator('#dataRow tr.dataTitleMid th');
  readonly totalRecords = this.page.locator('#totalRecord .leftTR, .leftTR').first();
  readonly steps = this.page.locator('#steps li div');
  readonly noRecord = this.page.getByText(/No record found/);
  readonly errorPage = this.page.getByText(/An error has occurred|Page not found/);

  constructor(page: Page) {
    super(page);
  }

  // ---------- navigation ----------

  // Top menu Administrator, then a quicklink (as a user would)
  async openQuicklink(name: string): Promise<void> {
    const inModule = new RegExp(`^${this.menuPath}(/|$)`);
    if (!inModule.test(new URL(this.page.url()).pathname)) {
      await this.menuTab.click();
      await this.page.waitForURL((u) => inModule.test(u.pathname), { timeout: Timeouts.pageLoad });
    }
    await this.quicklinks.filter({ hasText: new RegExp(`^\\s*${name.replace(/[&]/g, '\\$&')}\\s*$`) }).first().click();
    await this.page.waitForLoadState('load');
    await this.captureStep(`Screen: ${await this.screenName()}`);
  }

  // Page title for step screenshots ("Add a Bank User", "Edit Card Brand Details", ...)
  async screenName(): Promise<string> {
    return (await this.title.innerText({ timeout: 2_000 }).catch(() => '')).trim() || this.page.url().replace(/^https?:\/\/[^/]+/, '');
  }

  // A row's Quicklink: choose the action, click Go (opens /admin/<action>?itemid=<id>)
  async quicklinkGo(row: Locator, action: string): Promise<void> {
    await row.locator('select.selectInTable').selectOption({ label: action });
    const before = this.page.url();
    await row.locator('#buttonGo, a').filter({ hasText: /^\s*Go\s*$/ }).first().click();
    // Go navigates a moment later (script): wait for the new page, else go on (pop-up actions stay)
    await this.page.waitForURL((u) => u.href !== before, { timeout: 10_000 }).catch(() => {});
    await this.page.waitForLoadState('load');
    await this.captureStep(`Screen: ${await this.screenName()} (Quicklink ${action})`);
  }

  async quicklinkOptions(row: Locator): Promise<string[]> {
    return (await row.locator('select.selectInTable option').allInnerTexts()).map((t) => t.trim());
  }

  async rowId(row: Locator): Promise<string> {
    return (await row.locator('input[name=itemid]').first().getAttribute('value')) ?? '';
  }

  // A button / link in the page body by its text, e.g. "Edit Bank User Details"
  button(text: string | RegExp): Locator {
    return this.main.locator('a.button, a, button').filter({ hasText: typeof text === 'string' ? new RegExp(`^\\s*${text}\\s*(>>)?\\s*$`) : text }).first();
  }

  async clickButton(text: string | RegExp): Promise<void> {
    await this.button(text).click();
    await this.page.waitForLoadState('load');
    await this.captureStep(`Screen: ${await this.screenName()}`);
  }

  // ---------- lists ----------

  async columns(): Promise<string[]> {
    return (await this.headers.allInnerTexts()).map((h) => h.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  // Column headers wrap with <br> ("Date/ Time", "User ID (Role)"): compare without spaces
  async expectColumns(expected: string[]): Promise<void> {
    const squash = (a: string[]) => a.map((c) => c.replace(/\s+/g, ''));
    expect(squash(await this.columns()), `columns ${expected.join(' | ')}`).toEqual(squash(expected));
  }

  // Put a long text in a box with a counter: fill, then a key so the page's keyup counter updates
  async fillCounted(name: string, text: string): Promise<void> {
    await this.input(name).fill(text);
    await this.input(name).press('End');
  }

  // Cell texts of every row on EVERY page ("Page 1 of 4" + page number links under the list)
  async allRowCells(): Promise<string[][]> {
    const read = () => this.rows.evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim())));
    const out = await read();
    // "Page&nbsp;1&nbsp;of&nbsp;4"; page links: <a id="page" href="...?page=2">
    const info = await this.page.locator('#pageInfo').first().innerText().catch(() => '');
    const pages = Number((info.match(/of\s*(\d+)/) ?? ['', '1'])[1]);
    for (let p = 2; p <= pages; p++) {
      await this.page.locator(`a[href*="page=${p}"]`).filter({ hasText: new RegExp(`^\\s*${p}\\s*$`) }).first().click();
      await this.page.waitForLoadState('load');
      out.push(...(await read()));
    }
    return out;
  }

  async totalCount(): Promise<number> {
    if (!(await this.totalRecords.isVisible().catch(() => false))) return 0;
    return Number(((await this.totalRecords.innerText()).match(/\d+/) ?? ['0'])[0]);
  }

  async options(name: string, scope: Locator = this.main): Promise<string[]> {
    return (await scope.locator(`select[name="${name}"] option`).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  // Step screenshot of a dropdown's choices. The portal hides the real <select> behind a styled box, and
  // a closed dropdown shows no choices, so a panel listing them is drawn under the box for the shot and
  // removed again. Choices not in `expected` (the sheet) are marked red "NOT IN SHEET".
  async captureOptions(name: string, label: string, expected: string[] = [], scope: Locator = this.main): Promise<void> {
    if (process.env.STEP_SCREENSHOTS === 'false') return;
    const select = scope.locator(`select[name="${name}"]`).first();
    const drawn = await select.evaluate((s, exp) => {
      const el = s as HTMLSelectElement;
      let anchor: HTMLElement = el;                                   // the visible box replacing the select
      while (anchor.parentElement && anchor.getBoundingClientRect().width === 0) anchor = anchor.parentElement;
      anchor.scrollIntoView({ block: 'center' });
      const r = anchor.getBoundingClientRect();
      const panel = document.createElement('div');
      panel.id = 'qa-options-panel';
      panel.style.cssText = `position:absolute;left:${r.left + window.scrollX}px;top:${r.bottom + window.scrollY + 4}px;` +
        'z-index:99999;background:#fff;border:3px solid #1565c0;padding:6px 10px;font:14px Arial;box-shadow:0 4px 12px rgba(0,0,0,.3);min-width:240px';
      const rows = [...el.options].map((o) => {
        const t = (o.textContent ?? '').replace(/\s+/g, ' ').trim();
        const extra = exp.length > 0 && !exp.includes(t);
        return `<div style="padding:2px 0;${extra ? 'color:#c62828;font-weight:bold' : ''}">${t}${extra ? '  &larr; NOT IN SHEET' : ''}</div>`;
      });
      panel.innerHTML = `<div style="color:#1565c0;font-weight:bold;margin-bottom:4px">Dropdown choices (${el.options.length})</div>${rows.join('')}`;
      document.body.appendChild(panel);
      return true;
    }, expected).catch(() => false);
    if (!drawn) return;
    await this.captureStep(`Dropdown choices: ${label}`);
    await this.page.evaluate(() => document.getElementById('qa-options-panel')?.remove()).catch(() => {});
  }

  async selected(name: string, scope: Locator = this.main): Promise<string> {
    return scope.locator(`select[name="${name}"]`).evaluate((s) => ((s as HTMLSelectElement).selectedOptions[0]?.textContent ?? '').trim());
  }

  input(name: string, scope: Locator = this.main): Locator {
    return scope.locator(`[name="${name}"]`).first();
  }

  // Filter form: fields by name, then its Search button
  async filter(values: Record<string, string>): Promise<void> {
    for (const [name, v] of Object.entries(values)) {
      const el = this.input(name, this.filterForm);
      if (await el.evaluate((e) => e.tagName === 'SELECT')) await el.selectOption({ label: v });
      else await this.typeInto(el, v);
    }
    // big lists (Fassbayar error log ~1.3 M rows) can still be loading the previous search
    await this.page.waitForLoadState('load');
    await this.filterForm.locator('a.button').filter({ hasText: /^\s*Search\s*$/ }).first().click({ timeout: 45_000 });
    await this.page.waitForLoadState('load', { timeout: Timeouts.pageLoad });
  }

  // Search box at the top (search form)
  async search(text: string): Promise<void> {
    await this.searchBox.click();
    await this.searchBox.fill(text);
    await this.searchBox.press('Enter');
    await this.page.waitForLoadState('load');
  }

  // Date fields are read-only (picker only); set one like the picker would (for range checks)
  async setDate(name: string, value: string): Promise<void> {
    await this.input(name, this.filterForm).evaluate((e, v) => { (e as HTMLInputElement).value = v; }, value);
  }

  // ---------- forms ----------

  async fill(values: Record<string, string>): Promise<void> {
    for (const [name, v] of Object.entries(values)) {
      const el = this.input(name);
      if (await el.evaluate((e) => e.tagName === 'SELECT')) await el.selectOption({ label: v });
      else await this.typeInto(el, v, { pressTab: true });
    }
  }

  async clear(names: string[]): Promise<void> {
    for (const n of names) { await this.input(n).fill(''); await this.input(n).press('Tab'); }
  }

  // Submit = validation; with valid data it slides to Review & Confirm (nothing saved before Confirm)
  async submit(): Promise<void> {
    await this.main.locator('a').filter({ hasText: /^\s*Submit\s*$/ }).first().click();
    await this.page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await this.page.waitForTimeout(800);
    // step screenshot named after what Submit did: Review reached, error messages, or nothing
    let outcome = 'no error shown';
    for (let i = 0; i < 4; i++) {
      const errors = Object.values(await this.visibleErrors().catch(() => ({}))).filter(Boolean);
      if (errors.length) { outcome = `errors: ${errors.join('; ')}`; break; }
      if (await this.confirmInView()) { outcome = 'went to Review & Confirm'; break; }
      await this.page.waitForTimeout(500);
    }
    await this.captureStep(`After Submit (${await this.screenName()}): ${outcome}`);
  }

  private confirmInView(): Promise<boolean> {
    return this.confirmButton.evaluate((b) => {
      const r = (b as HTMLElement).getBoundingClientRect();
      return (b as HTMLElement).offsetWidth > 0 && r.left >= 0 && r.right <= window.innerWidth;
    }).catch(() => false);
  }

  readonly confirmButton = this.main.locator('a').filter({ hasText: /^\s*Confirm\s*$/ }).first();
  readonly backButton = this.main.locator('a').filter({ hasText: /^\s*Back\s*$/ }).first();

  // Review & Confirm visible? Step 2 SLIDES into view after a valid Submit: wait up to 3 s for it
  async reviewShown(): Promise<boolean> {
    const inView = () => this.confirmButton.evaluate((b) => {
      const r = (b as HTMLElement).getBoundingClientRect();
      return (b as HTMLElement).offsetWidth > 0 && r.left >= 0 && r.right <= window.innerWidth;
    }).catch(() => false);
    for (let i = 0; i < 6; i++) {
      if (await inView()) return true;
      if (Object.keys(await this.visibleErrors()).length) return false;    // stayed on Details with errors
      await this.page.waitForTimeout(500);
    }
    return inView();
  }

  // Leave the Review step without saving
  async backFromReview(): Promise<void> {
    if (await this.reviewShown()) await this.backButton.click();
  }

  // Confirm = SAVES (only in tests that are allowed to change UAT data).
  // Preview (ADM_PREVIEW_CHANGES=true): screenshot of Review & Confirm, then the test stops; nothing saved.
  async confirm(): Promise<void> {
    await stopBeforeSaving(this, `Confirm on "${(await this.title.innerText().catch(() => '')).trim()}"`);
    await this.confirmButton.scrollIntoViewIfNeeded();
    await this.confirmButton.click();
    await this.page.waitForLoadState('load');
  }

  // Field error box, e.g. error('userIdError') -> "Please enter valid User ID"
  error(id: string): Locator {
    return this.page.locator(`#${id}`);
  }

  async visibleErrors(): Promise<Record<string, string>> {
    return this.page.evaluate(() => {
      const out: Record<string, string> = {};
      for (const e of Array.from(document.querySelectorAll('[id$="Error"]'))) {
        if ((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight) out[e.id] = (e.textContent ?? '').replace(/\s+/g, ' ').trim();
      }
      return out;
    });
  }

  // Suspend / Reinstate: run the page's own check (validateInput1) WITHOUT submitting
  async validateWithoutSubmit(): Promise<boolean> {
    return this.page.evaluate(() => {
      const f = (window as unknown as { validateInput1?: () => boolean }).validateInput1;
      return f ? Boolean(f()) : true;
    });
  }

  // "Max characters: 250 [n] remaining"
  async remaining(): Promise<string> {
    return this.input('countdown').inputValue();
  }

  // ---------- pop-ups (fancybox iframe) ----------

  async openPopup(trigger: string): Promise<FrameLocator> {
    await this.button(trigger).click();
    const frame = this.page.frameLocator('#fancybox-wrap iframe, .fancybox-wrap iframe, .fancybox-inner iframe').first();
    await expect(frame.locator('body')).not.toBeEmpty({ timeout: Timeouts.expect });
    await this.page.waitForTimeout(500);                       // pop-up opening animation
    await this.captureStep(`Pop-up: ${trigger}`);
    return frame;
  }

  async popupText(frame: FrameLocator): Promise<string> {
    return (await frame.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  }

  // Close without choosing anything (never "Continue" / "Yes")
  async closePopup(): Promise<void> {
    await this.page.locator('#fancybox-close, .fancybox-close, .fancybox-item.fancybox-close').first().click({ timeout: 3_000 }).catch(() => {});
    await this.page.keyboard.press('Escape').catch(() => {});
  }

  // ---------- shared by Readers and Mobile Users ----------

  // Status History pop-up rows (newest last, as on screen) as { column: text }
  async statusHistory(): Promise<{ columns: string[]; rows: Record<string, string>[] }> {
    const frame = await this.openPopup('Status History >>');
    // div "table": #tblHeaderMid .col (header, "User ID<br>(Role)"), one div#tblWhiteMid per entry (oldest first)
    const norm = (t: string) => t.replace(/\s+/g, ' ').replace(/\s*\(\s*/g, ' (').trim();
    const columns = (await frame.locator('#tblHeaderMid .col').allInnerTexts()).map(norm).filter(Boolean);
    const rows: Record<string, string>[] = [];
    // entries alternate div#tblWhiteMid / div#tbl...Mid (row colours): every *Mid div except the header
    for (const tr of await frame.locator('#barPadding > div[id^="tbl"][id$="Mid"]:not(#tblHeaderMid)').all()) {
      const cells = (await tr.locator('.col').allInnerTexts()).map(norm);
      if (cells.join('')) rows.push(Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? ''])));
    }
    await this.closePopup();
    return { columns, rows };
  }

  // Export to CSV of the current list (download); returns the file text
  async exportCsv(): Promise<string> {
    const [dl] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 60_000 }),
      this.button('Export to CSV').click()
    ]);
    const file = test.info().outputPath(`export-${dl.suggestedFilename()}`);
    await dl.saveAs(file);
    return fs.readFileSync(file, 'utf8');
  }
}
