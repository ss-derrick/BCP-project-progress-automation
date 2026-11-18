import { Locator, expect } from '@playwright/test';
import { CommonCompanyFormPage } from './CompanyFormPage';
import { ParentSettingField, type ParentSettingKey } from '../../config/portals';
import type { ParentCompanyData, MerchantType } from '../../creation/parentCompanyData';

// ============================================================
// All Companies > Add a Parent Company (/company/registerMasterMerchant) -
// EVERY portal. Business + Authoriser fields and the wizard (Submit ->
// Review & Confirm -> Confirm -> Complete) come from CommonCompanyFormPage,
// shared with Add a Company. Here only what the parent form adds:
//   Merchant Type   (o) Master Merchant #referralCheckbox  ( ) HQ Merchant #pfgpCheckbox
//   Settings        API Authentication (every portal), SSO (FassBayar only -
//                   see parentSettings in common/config/portals.ts)
// No MID Settings: the Complete page shows MID "N/A".
// ============================================================
export class CommonAddParentCompanyPage extends CommonCompanyFormPage {

  get quicklink(): Locator {
    return this.page.locator('a[href="/company/registerMasterMerchant"]').filter({ visible: true }).first();
  }

  merchantTypeRadio(type: MerchantType): Locator {
    return this.step1.locator(`input[name="merchantType"][value="${type}"]`);
  }

  setting(key: ParentSettingKey): Locator {
    return this.page.locator(ParentSettingField[key]);
  }

  // Quicklinks > "Add a Parent Company" (from any All Companies page)
  async open(): Promise<void> {
    await this.quicklink.click();
    await this.page.waitForURL(/\/company\/registerMasterMerchant/, { timeout: this.pageLoadTimeout });
    await expect(this.businessName).toBeVisible();
    await this.captureScreen('Add a Parent Company - empty form');
  }

  async selectMerchantType(type: MerchantType): Promise<void> {
    const radio = this.merchantTypeRadio(type);
    await this.scrollToElement(radio);
    await radio.check();
    await expect(radio).toBeChecked();
  }

  // Only the settings the data has; one the portal lacks fails clearly
  async fillParentSettings(data: ParentCompanyData): Promise<void> {
    for (const key of Object.keys(ParentSettingField) as ParentSettingKey[]) {
      const value = data[key];
      if (value === undefined) continue;
      this.requireSection(this.portal.parentSettings.includes(key), `Setting "${key}"`);
      await this.setting(key).setChecked(value);
    }
  }

  // ---------- Step 1: whole form ----------

  async fillParentCompanyDetails(data: ParentCompanyData): Promise<void> {
    await this.fillBusinessDetails(data);
    await this.captureScreen('Parent company - business details');

    await this.fillAuthoriserDetails(data);
    await this.fillParentSettings(data);
    await this.selectMerchantType(data.merchantType);

    await this.captureScreen(`Parent company - authoriser, settings, ${data.merchantType}`);
  }

  // ---------- Step 2: Review & Confirm ----------

  // Shows the business, the authoriser, the Merchant Type, and each setting
  // as "Enable ..." / "Disable ..."
  async verifyParentReview(data: ParentCompanyData): Promise<void> {
    const state = (on: boolean) => (on ? 'Enable' : 'Disable');
    await this.verifyReview([
      data.businessName, data.brn, data.fullName, data.email, data.merchantType,
      ...(data.apiAuthentication === undefined ? [] :
        [`${state(data.apiAuthentication)} API Authentication Setting`]),
      ...(data.sso === undefined ? [] :
        [`${state(data.sso)} login via Single Sign On (SSO)`])
    ]);
  }
}

export { CommonAddParentCompanyPage as AddParentCompanyPage };
export type { MerchantType } from '../../creation/parentCompanyData';
