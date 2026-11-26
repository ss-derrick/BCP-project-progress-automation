import { expect, type Locator } from '@playwright/test';
import { AdministratorPage } from './AdministratorPage';

// Manage Mobile Users (same screens on APH and Fassbayar; APH adds the Secondary Terminal (Failover-Capable) tables
// and Fassbayar Sync Status, Fassbayar adds Counter No, Enable Fasstap and Coupon acceptance):
//   Mobile User Summary (/mobileUser/list), company view (/mobileUser/company?itemid=), Add a Mobile User
//   (/mobileUser/registerSearch -> /mobileUser/register?itemid=<company>), Mobile User Details (/mobileUser/details),
//   Edit Mobile User Details (/mobileUser/updateDetails), Suspend / Reinstate (/mobileUser/suspend, /unsuspend),
//   pop-ups Status History >>, View Sync History >> (APH), Reset User PIN, Revoke SSO Token.
// Reuses the list / Quicklink / form / pop-up helpers of AdministratorPage (every screen gets a step screenshot).
// Register and Edit: Submit = validation / Review & Confirm; Confirm SAVES (only in cases allowed to change UAT data).

export const MU_COLUMNS = ['MID(Business Name)', 'Mobile User ID', 'TID', 'Status', 'Created Date', 'Quicklink'];
export const MU_COMPANY_VIEW_COLUMNS = ['Mobile User ID', 'TID', 'Status', 'Activation Date/Suspended Date', 'Quicklink'];
export const MU_STATUSES = ['Select One', 'Active', 'Suspended'];
export const MU_STEPS = ['Select Company', 'Details', 'Review & Confirm', 'Complete'];
export const RUN_OUT = /The Company\s+(\d+)\s+has ran out of Terminal ID \(TID\)/;

export class MobileUsersPage extends AdministratorPage {
  protected override get menuPath(): string { return '/mobileUser'; }

  readonly midRows = this.main.locator('input[name="selectMid"]');

  // ---------- Mobile User Summary ----------

  async openSummary(): Promise<void> {
    await this.openQuicklink('Mobile User Summary');
  }

  // Left-panel screens opened by their address with a long load allowance: the full Fassbayar list
  // (200+ pages, last 10 years by default) can take well over the normal page-load time
  override async openQuicklink(name: string): Promise<void> {
    const url: Record<string, string> = { 'Mobile User Summary': '/mobileUser', 'Add a Mobile User': '/mobileUser/registerSearch' };
    if (!url[name]) return super.openQuicklink(name);
    await this.page.goto(url[name], { timeout: 120_000, waitUntil: 'load' });
    await this.captureStep(`Screen: ${await this.screenName()}`);
  }

  // Summary row of one Mobile User ID (exact match on the 2nd cell)
  userRow(muid: string): Locator {
    return this.rows.filter({ has: this.page.locator('td:nth-child(2)', { hasText: new RegExp(`^\\s*${muid}\\s*$`, 'i') }) }).first();
  }

  // Search result page of one Mobile User ID (direct: the full Fassbayar list is slow to load first)
  async findUser(muid: string): Promise<Locator> {
    await this.page.goto(`/mobileUser/search?search=${encodeURIComponent(muid)}`);
    await this.page.waitForLoadState('load');
    await this.captureStep(`Mobile User Summary: search "${muid}"`);
    return this.userRow(muid);
  }

  // { column: text } of a Summary row
  async rowCells(row: Locator): Promise<Record<string, string>> {
    const cells = (await row.locator('td').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    return Object.fromEntries(MU_COLUMNS.map((c, i) => [c, cells[i] ?? '']));
  }

  // Mobile users (Summary rows) of a company MID, first page
  async usersOf(mid: string, status = ''): Promise<Record<string, string>[]> {
    await this.openSummary();
    await this.filter(status ? { mid, status } : { mid });
    const rows: Record<string, string>[] = [];
    for (const r of await this.rows.all()) rows.push(await this.rowCells(r));
    return rows;
  }

  async statusOf(muid: string): Promise<string> {
    return (await this.rowCells(await this.findUser(muid)))['Status'] ?? '';
  }

  async openDetails(muid: string): Promise<void> {
    await this.quicklinkGo(await this.findUser(muid), 'View Details');
  }

  // ---------- Add a Mobile User ----------

  // Add a Mobile User > search the company by name / MID > its "Add a Mobile User" link
  async openRegister(company: string): Promise<void> {
    await this.openQuicklink('Add a Mobile User');
    await this.search(company);
    await this.captureStep(`Add a Mobile User: company search "${company}"`);
    await this.main.locator('#dataRow a[href*="register?itemid"]').first().click();
    await this.page.waitForLoadState('load');
    await this.captureStep(`Add a Mobile User: form of ${company}`);
  }

  // Register links of the company search results for a term (read only)
  async registerLinks(term: string): Promise<{ href: string; company: string }[]> {
    await this.page.goto(`/mobileUser/registerSearch?search=${encodeURIComponent(term)}&action=search`);
    await this.page.waitForLoadState('load');
    return this.main.locator('#dataRow tr.dataListMid').evaluateAll((trs) => trs.map((tr) => ({
      href: tr.querySelector('a[href*="register?itemid"]')?.getAttribute('href') ?? '',
      company: (tr.querySelector('td')?.textContent ?? '').replace(/\s+/g, ' ').trim()
    })).filter((r) => r.href));
  }

  // First company (of the search results) whose register form has / has not an Available TID. Read only:
  // the form is only opened. `preferred` (a Test Data company) is tried first.
  async findCompany(want: 'free TID' | 'no free TID', preferred: string[] = [], terms = ['', 'test', 'qa', 'sdn']): Promise<{ href: string; company: string } | null> {
    const candidates: { href: string; company: string }[] = [];
    for (const p of preferred) candidates.push(...(await this.registerLinks(p)).slice(0, 1));
    for (const t of terms) for (const c of await this.registerLinks(t)) if (!candidates.some((x) => x.href === c.href)) candidates.push(c);
    for (const c of candidates.slice(0, 50)) {
      await this.page.goto(`/mobileUser/${c.href}`);
      await this.page.waitForLoadState('load');
      const runOut = RUN_OUT.test(await this.main.innerText());
      const freeTid = !runOut && (await this.main.locator('select[id^="selectTID"] option').count()) > 1;
      if ((want === 'free TID' && freeTid) || (want === 'no free TID' && runOut)) {
        await this.captureStep(`Company with ${want}: ${c.company}`);
        return c;
      }
    }
    return null;
  }

  // Tick the first MID row and choose its first Available TID
  async pickFirstMidTid(): Promise<string> {
    await this.midRows.first().check({ force: true });
    const select = this.main.locator('select[id^="selectTID"]').first();
    const tid = (await select.locator('option').nth(1).innerText()).trim();
    await select.selectOption({ label: tid });
    return tid;
  }

  // Fill the register / edit text fields (only the ones given)
  async fillUser(v: { mobileUserId?: string; name?: string; prefix?: string; body?: string; email?: string; counterNo?: string }): Promise<void> {
    const map: Record<string, string | undefined> = { mobileUserId: v.mobileUserId, name: v.name, contact_prefix: v.prefix, contact_body: v.body, email: v.email, counterNo: v.counterNo };
    for (const [id, value] of Object.entries(map)) {
      if (value === undefined) continue;
      const box = this.main.locator(`#${id}`);
      await box.fill('');
      if (value) await box.pressSequentially(value);   // typed, so maxlength applies as for a user
      await box.press('Tab');
    }
  }

  async valueOf(id: string): Promise<string> {
    return this.main.locator(`#${id}`).inputValue();
  }

  // Flags (checkboxes) by id: { canVoidCheckbox: true, ... }
  async flags(ids: string[]): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const id of ids) {
      const box = this.main.locator(`#${id}`);
      if (await box.count()) out[id] = await box.isChecked();
    }
    return out;
  }

  async setFlags(values: Record<string, boolean>): Promise<void> {
    for (const [id, on] of Object.entries(values)) {
      const box = this.main.locator(`#${id}`);
      if (!(await box.count())) continue;
      if ((await box.isChecked()) !== on) await box.setChecked(on, { force: true });
    }
  }

  // Submit; returns the visible field errors (empty = Review & Confirm reached)
  async submitForm(label: string): Promise<Record<string, string>> {
    await this.captureStep(`${label}: before Submit`);
    await this.submit();
    return this.visibleErrors();
  }

  async expectNoErrorPage(): Promise<void> {
    await expect(this.errorPage, 'no error page').toHaveCount(0);
  }
}
