import { expect, Locator } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import type { BusinessAndAuthoriser, CompanyData, CompanySettings } from '../testdata/companyData';
import { Hosts } from '../../common/hosts/hosts';

// Company Details page (/company/viewDetails?itemid=...)
// Values are shown as <div class="confirmLabel">Label</div><div class="confirmValue">Value</div>
export class CompanyDetailsPage extends BasePage {
  readonly activationDate = this.page.locator('#detailBox .title24Black');
  readonly midStatus = this.page.locator('#statusPass').first();
  readonly suspendCompanyButton = this.page.getByRole('link', { name: 'Suspend Company Access' });
  readonly suspendAuthoriserButton = this.page.getByRole('link', { name: 'Suspend Authoriser' });

  async goto(itemId: string): Promise<void> {
    await this.page.goto(`/company/viewDetails?itemid=${itemId}`);
  }

  // Value next to a label. Labels are matched ignoring spaces and a
  // trailing ":" (e.g. "Status :" / "Maximum Charged Amountper Day").
  value(label: string): Locator {
    const norm = label.replace(/\s+/g, '').replace(/:$/, '');
    return this.page.locator(
      `xpath=//div[contains(@class,"confirmLabel")][translate(translate(normalize-space(.)," ",""),":","")="${norm}"]` +
      `/following-sibling::div[1]`
    ).first();
  }

  protected async expectValue(label: string, expected: string | RegExp): Promise<void> {
    await expect.soft(this.value(label), `Company details: "${label}"`).toHaveText(expected);
  }

  // Every value entered on the form must be shown on the details page.
  // Soft checks: all mismatches are listed, not only the first.
  async verifyDetails(data: CompanyData, userId: string): Promise<void> {
    await this.verifyBusinessAndAuthoriser(data, userId);

    if (data.bank) {
      await this.expectValue('Business Bank Name', data.bank.name);
      await this.expectValue('Business Bank Account No.', data.bank.accountNo);
      await this.expectValue('Business Bank Account Holder Name', data.bank.holderName);
    }

    if (data.mcc) {
      await this.expectValue('Merchant Category Code (MCC)', new RegExp(`^${data.mcc} - `));
    }

    if (data.limits) {
      await this.expectValue('Maximum Charged Amount per Transaction', `RM ${data.limits.perTransaction}`);
      await this.expectValue('Maximum Charged Amount per Day', `RM ${data.limits.perDay}`);
      await this.expectValue('Maximum Charged Amount per Month', `RM ${data.limits.perMonth}`);
    }

    for (const [i, ref] of (data.references ?? []).entries()) {
      await this.expectValue(`Reference ${i + 1}`, ref);
    }

    // First MID (the details page shows one MID block per MID)
    const mid = data.mids[0];
    const host = Hosts[mid.host];
    await this.expectValue('Merchant ID (MID)', mid.mid);
    if (mid.dba !== undefined) await this.expectValue('DBA', mid.dba);
    await this.expectValue('Service Provider', new RegExp(`^(${host.code}|${host.name})$`, 'i'));
    await this.expectValue('Payment Type', mid.paymentTypes.join(', '));
    await this.expectValue('Card Scheme', mid.cardSchemes.join(', '));

    if (data.settings) await this.verifySettings(data.settings);
    await this.captureScreen('Company details');
  }

  // Business Details + Authoriser Details (same on company and parent company)
  async verifyBusinessAndAuthoriser(data: BusinessAndAuthoriser, userId: string): Promise<void> {
    await this.expectValue('Business Name', data.businessName);
    await this.expectValue('Business Short Name', data.businessShortName);
    await this.expectValue('Business Registration Number (BRN)', data.brn);
    if (data.sst !== undefined) await this.expectValue('Sales and Services Tax (SST)', data.sst);
    if (data.tin !== undefined) await this.expectValue('Tax Identification Number (TIN)', data.tin);
    await this.expectValue('Business Registration Address', data.address1);
    if (data.address2) {
      await expect.soft(
        this.page.locator('.confirmValue', { hasText: data.address2 }).first(),
        'Company details: address line 2'
      ).toBeVisible();
    }
    await this.expectValue('Postcode', data.postcode);
    await this.expectValue('City', data.city);
    await this.expectValue('Region / State', data.state);
    await this.expectValue('Business Contact No.', data.businessContact);

    await this.expectValue('User ID', userId);
    await this.expectValue('Salutation', data.salutation);
    await this.expectValue('Name', data.fullName);
    await this.expectValue('Contact No.', `+6 ${data.mobilePrefix}-${data.mobileBody}`);
    await this.expectValue('Email Address', data.email);
  }

  // Only the settings the test set are checked
  async verifySettings(settings: CompanySettings): Promise<void> {
    const box = (id: string) => this.page.locator(`#${id}`);
    const checks: [string, boolean | undefined][] = [
      ['canSupportContactlessPayment', settings.contactless],
      ['canOptInMccs', settings.mccsOptIn],
      ['canEnableBillPayment', settings.billPayment],
      ['canDisableBypassLoginVoid', settings.bypassVoid],
      ['canDisableBypassLoginSettlement', settings.bypassSettlement]
    ];
    for (const [id, checked] of checks) {
      if (checked === undefined) continue;
      await expect.soft(box(id), `Setting ${id}`).toBeChecked({ checked });
    }
    const values: [string, string | undefined][] = [
      ['setUnattendedScheduleTime', settings.unattendedScheduleTime],
      ['changeApplicationIdentifier', settings.applicationIdentifier],
      ['changeQRScanType', settings.qrScanType]
    ];
    for (const [id, value] of values) {
      if (value !== undefined) await expect.soft(box(id), `Setting ${id}`).toHaveValue(value);
    }
  }

  // Special Fields: Reference 1..5 values as shown
  async references(): Promise<string[]> {
    const values: string[] = [];
    for (let n = 1; n <= 5; n++) {
      values.push((await this.value(`Reference ${n}`).innerText()).trim());
    }
    return values;
  }

  async verifyReferences(expected: string[]): Promise<void> {
    for (const [i, value] of expected.entries()) {
      await expect.soft(this.value(`Reference ${i + 1}`), `Reference ${i + 1}`).toHaveText(value);
    }
    await this.captureFullBox(this.value('Reference 1').locator('xpath=..'), 'Special fields');
  }

  // Details page is open and belongs to the company with this MID
  // (a company can have several MIDs - one MID block per MID)
  async verifyOpenedFor(mid: string, businessName?: string): Promise<void> {
    await this.page.waitForURL(/viewDetails\?itemid=\d+/);
    await expect(this.page).toHaveTitle(/Company Details/);
    await expect(
      this.page.locator('.confirmValue_po', { hasText: mid }).first(),
      `Company details should list MID ${mid}`
    ).toBeAttached();
    if (businessName) {
      await expect(this.value('Business Name')).toHaveText(businessName);
    }
    await this.captureScreen('Company details');
  }

  // The new company is enabled: MID status Active, activation date set,
  // and the "Suspend ..." actions are offered (i.e. it is not suspended)
  async verifyEnabled(): Promise<void> {
    await expect(this.midStatus).toHaveText('Active');
    await expect(this.activationDate).not.toBeEmpty();
    await expect(this.suspendCompanyButton).toBeVisible();
    await expect(this.suspendAuthoriserButton).toBeVisible();
    await this.captureFullBox(this.page.locator('[onclick^="showMidSetting"]').first(), 'MID settings - Active');
  }
}
