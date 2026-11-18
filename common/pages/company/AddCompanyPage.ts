import { test, expect, Locator } from '@playwright/test';
import { CommonCompanyFormPage } from './CompanyFormPage';
import { SettingField, type SettingKey } from '../../config/portals';
import { Hosts, type Host } from '../../hosts/hosts';
import { PaymentTypeCheckbox, QrWalletCheckbox, ALL_PAYMENT_TYPES } from '../../hosts/paymentTypes';
import type { CompanyData, MidSetting, CompanySettings } from '../../creation/companyData';

// ============================================================
// All Companies > Add a Company (/company/register) - EVERY portal.
// ONE place for the locators and steps of this form. A portal has
// nothing to add: the portal of the run (ENV_NAME) is picked up from
// portals.config.ts. A portal folder only extends this if its screen
// BEHAVES differently.
//
// A section is filled only when the test data has it; data for a section
// the portal does not have fails with a clear message.
//
// MID Settings: one block per MID, #paymentOption0, #paymentOption1, ...
// ("Add another MID" adds the next). Field names end with the row number:
// mid0, serviceProvider0, dba0, cardScheme0, retailCheckbox0, ...
// ============================================================
export class CommonAddCompanyPage extends CommonCompanyFormPage {

  // ---- Bank Details (FassBayar)
  get bankName(): Locator { return this.page.locator('#businessBankName'); }
  get bankAccountNo(): Locator { return this.page.locator('#businessBankAccountNo'); }
  get bankAccountHolderName(): Locator { return this.page.locator('#businessBankAccountHolderName'); }

  // ---- MCC (FassBayar) + Transactions Limit
  get mcc(): Locator { return this.page.locator('#merchantCategoryCode'); }
  get maxPerTransaction(): Locator { return this.page.locator('#maxAmountPerTransac'); }
  get maxPerDay(): Locator { return this.page.locator('#maxAmountPerDay'); }
  get maxPerMonth(): Locator { return this.page.locator('#maxAmountPerMonth'); }

  // ---- Special Fields (FassBayar)
  reference(n: number): Locator { return this.page.locator(`#specialField${n}Value`); }

  // ---- MID Settings
  get quicklink(): Locator { return this.page.locator('a[href="/company/register"]').filter({ visible: true }).first(); }
  get addAnotherMidLink(): Locator { return this.step1.getByText('Add another MID', { exact: true }); }
  get midError(): Locator { return this.step1.getByText('Please enter valid MID').filter({ visible: true }); }

  // The block of MID row <n>
  midRow(n: number): Locator { return this.step1.locator(`#paymentOption${n}`); }
  midInput(n: number): Locator { return this.midRow(n).locator(`[name="mid${n}"]`); }
  serviceProvider(n: number): Locator { return this.midRow(n).locator(`select[name="serviceProvider${n}"]`); }
  dba(n: number): Locator { return this.midRow(n).locator(`[name="dba${n}"]`); }
  cardSchemeSelect(n: number): Locator { return this.midRow(n).locator(`select[name="cardScheme${n}"]`); }
  hostSwingPriority(n: number): Locator { return this.midRow(n).locator(`[name="hostSwingPriority${n}"]`); }
  paymentTypeCheckbox(n: number, type: keyof typeof PaymentTypeCheckbox): Locator {
    return this.midRow(n).locator(`input[name="${PaymentTypeCheckbox[type]}${n}"]`);
  }

  // ---------- navigation ----------

  // Quicklinks > "Add a Company" (from any All Companies page)
  async open(): Promise<void> {
    await this.quicklink.click();
    await this.page.waitForURL(/\/company\/register/, { timeout: this.pageLoadTimeout });
    await expect(this.businessName).toBeVisible();
    await this.captureScreen('Add a Company - empty form');
  }

  // ---------- Step 1: whole form ----------

  async fillCompanyDetails(data: CompanyData): Promise<void> {
    await this.fillBusinessDetails(data);
    await this.fillAuthoriserDetails(data);

    if (data.bank) {
      this.requireSection(this.portal.bankDetails, 'Bank Details');
      await this.bankName.selectOption(data.bank.name);
      await this.fill(this.bankAccountNo, data.bank.accountNo);
      await this.fill(this.bankAccountHolderName, data.bank.holderName);
    }

    if (data.mcc) {
      this.requireSection(this.portal.mcc, 'Merchant Category Code');
      await this.mcc.selectOption(data.mcc);
    }

    if (data.limits) {
      await this.fill(this.maxPerTransaction, data.limits.perTransaction);
      await this.fill(this.maxPerDay, data.limits.perDay);
      await this.fill(this.maxPerMonth, data.limits.perMonth);
    }

    if (data.references) {
      this.requireSection(this.portal.specialFields, 'Special Fields');
      for (const [i, value] of data.references.entries()) {
        await this.fill(this.reference(i + 1), value);
      }
    }

    await this.captureScreen('Company details - business, authoriser');

    for (const [n, mid] of data.mids.entries()) {
      await test.step(`MID ${n + 1}: ${mid.mid} - ${Hosts[mid.host].name}`, () => this.fillMid(n, mid));
    }

    if (data.settings) await this.fillSettings(data.settings);

    await this.captureScreen('Company details - MID and settings');
  }

  // ---------- MID Settings ----------

  // Fill MID row <n>. Row 0 is already on the page; for n > 0 the row is
  // added with "Add another MID" first.
  async fillMid(n: number, m: MidSetting): Promise<void> {
    // The link sometimes ignores a click (page still busy after the
    // previous row): click again until the new block is there. Only clicks
    // while the block is missing, so it never adds two.
    if (n > 0) {
      await expect(async () => {
        if ((await this.midRow(n).count()) === 0) {
          await this.addAnotherMidLink.scrollIntoViewIfNeeded();
          await this.addAnotherMidLink.click();
        }
        await expect(this.midRow(n)).toBeAttached({ timeout: 3_000 });
      }, `"Add another MID" should add MID block ${n + 1}`).toPass({ timeout: 30_000 });
    }

    await this.fill(this.midInput(n), m.mid);
    if (m.dba !== undefined) {
      this.requireSection(this.portal.dba, 'DBA');
      await this.fill(this.dba(n), m.dba);
    }
    await this.selectHost(n, m);

    for (const scheme of m.cardSchemes) {
      await this.chooseCardScheme(n, scheme);
    }

    await this.setPaymentTypes(n, m);

    // Host Swing Priority: shown only for some hosts / portals
    if (await this.hostSwingPriority(n).isVisible()) {
      await this.fill(this.hostSwingPriority(n), String(m.hostSwingPriority ?? n + 1));
    }

    await this.scrollToElement(this.midRow(n));
    await this.captureScreen(`MID ${n + 1}: ${m.mid} (${Hosts[m.host].name})`);
  }

  // Choosing a host reloads the Card Scheme list and enables its Payment
  // Types in the background. That reload sometimes never happens (host
  // shows as selected, list stays empty) - then pick another host and this
  // one again to trigger it once more.
  private async selectHost(n: number, m: MidSetting): Promise<void> {
    const host = Hosts[m.host];
    let attempt = 0;

    await expect(async () => {
      attempt++;
      if (attempt > 1) {
        const note = `Card Scheme list did not load for ${host.name} (MID ${n + 1}) - ` +
          `re-selecting the Service Provider (attempt ${attempt})`;
        console.log(note);
        test.info().annotations.push({ type: 'note', description: note });
        await this.serviceProvider(n).selectOption({ index: 0 });
        await this.page.waitForTimeout(1_000);
      }
      await this.serviceProvider(n).selectOption(host.code);

      for (const scheme of m.cardSchemes) {
        await expect(
          this.cardSchemeSelect(n).locator('option').filter({ hasText: exact(scheme) }),
          `Card Scheme "${scheme}" should be offered for ${host.name}`
        ).toHaveCount(1, { timeout: 15_000 });
      }
      for (const type of m.paymentTypes) {
        await expect(this.paymentTypeCheckbox(n, type),
          `Payment Type "${type}" should be enabled for ${host.name}`).toBeEnabled({ timeout: 5_000 });
      }
    }).toPass({ timeout: this.pageLoadTimeout * 2 });
  }

  // Card Scheme is a jQuery "chosen" multi-select: open it, click the
  // option, then check the real <select> of this row has it selected.
  private async chooseCardScheme(n: number, scheme: string): Promise<void> {
    const chosen = this.midRow(n).locator('.chosen-container').first();
    await expect(chosen, `MID ${n + 1} has no Card Scheme field for this host - ` +
      'set its cardSchemes to [] in common/hosts/hosts.ts').toBeVisible({ timeout: 10_000 });
    await chosen.locator('input').first().click({ timeout: 15_000 });
    await chosen.locator('.chosen-results li').filter({ hasText: exact(scheme) }).first().click({ timeout: 15_000 });

    await expect(
      this.cardSchemeSelect(n).locator('option:checked').filter({ hasText: exact(scheme) }),
      `Card Scheme "${scheme}" selected in MID ${n + 1}`
    ).toHaveCount(1);
  }

  // Untick every enabled Payment Type that is not wanted (some hosts tick
  // boxes by default), then tick the wanted ones, then check the result:
  // some types are linked per host (AmBank: Retail + MyDebit) and the page
  // ticks / unticks them together.
  private async setPaymentTypes(n: number, m: MidSetting): Promise<void> {
    const host = Hosts[m.host].name;
    const isOn = async (box: Locator) =>
      (await box.isVisible()) && (await box.isEnabled()) && (await box.isChecked());

    for (const type of ALL_PAYMENT_TYPES) {
      const box = this.paymentTypeCheckbox(n, type);
      if (!m.paymentTypes.includes(type) && (await isOn(box))) {
        await box.uncheck().catch(() => { /* reported below */ });
      }
    }
    for (const type of m.paymentTypes) {
      const box = this.paymentTypeCheckbox(n, type);
      await expect(box, `Payment Type "${type}" is not on the ${this.portal.name} form`).toBeVisible();
      await box.check();
    }

    const ticked: string[] = [];
    for (const type of ALL_PAYMENT_TYPES) {
      if (await isOn(this.paymentTypeCheckbox(n, type))) ticked.push(type);
    }
    expect(ticked.sort(),
      `Payment Types of MID ${n + 1} (${host}): the page links some types for this host - ` +
      'put exactly what the page keeps ticked in common/hosts/hosts.ts').toEqual([...m.paymentTypes].sort());

    // QR wallet list (opens with Fasspay Wallet / QR): at least one needed
    for (const wallet of m.qrWallets ?? []) {
      await this.midRow(n).locator(`input[name="${QrWalletCheckbox[wallet]}${n}"]`).check();
    }

    // "Pre-auth Type" radios appear once PreAuth is ticked
    if (m.paymentTypes.includes('PreAuth') && m.preAuthType) {
      await this.midRow(n)
        .locator(`input[type="radio"][name^="preAuthType"][value="${m.preAuthType}"]`)
        .check();
    }
  }

  // ---------- Settings ----------

  async fillSettings(settings: CompanySettings): Promise<void> {
    for (const [key, value] of Object.entries(settings) as [SettingKey, boolean | string | undefined][]) {
      if (value === undefined) continue;
      this.requireSection(this.portal.settings.includes(key), `Setting "${key}"`);
      const field = this.page.locator(SettingField[key]);
      if (typeof value === 'boolean') await field.setChecked(value);
      else await field.selectOption(value);
    }
  }

  // ---------- Step 1 -> 2 ----------

  // + no MID was rejected
  override async submitCompanyDetails(): Promise<void> {
    await super.submitCompanyDetails();
    await expect(this.midError, 'MID was rejected').toHaveCount(0);
  }

  // Review & Confirm shows the business, the authoriser and one line per
  // MID, e.g.
  //   "Merchant ID (MID) : 261117140331002 Service Provider : Hong Leong Bank
  //    [DBA : Roti Canai 7XC9UK] Status : Enabled Card Scheme : HLB VISA"
  async verifyCompanyReview(data: CompanyData): Promise<void> {
    await this.verifyReview([
      data.businessName,
      data.brn,
      data.fullName,
      data.email,
      ...data.mids.map((m) => new RegExp(
        `Merchant ID \\(MID\\)\\s*:\\s*${m.mid}\\s*` +
        `Service Provider\\s*:\\s*${escapeRegex(Hosts[m.host].name)}\\s*` +
        (m.dba ? `DBA\\s*:\\s*${escapeRegex(m.dba)}\\s*` : '') +
        'Status\\s*:\\s*Enabled\\s*' +
        (m.cardSchemes.length && (Hosts[m.host] as Host).schemeOnReview !== false
          ? `Card Scheme\\s*:\\s*${m.cardSchemes.map(escapeRegex).join('[\\s,]*')}\\s*Payment Type`
          : ''),
        'i'))
    ]);
  }
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = (s: string): RegExp => new RegExp(`^\\s*${escapeRegex(s)}\\s*$`);

export { CommonAddCompanyPage as AddCompanyPage };
export type { CreatedCompany } from './CompanyFormPage';
