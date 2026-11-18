import { expect, type Locator } from '@playwright/test';
import { AddCompanyFormPage } from '../../common/pages/AddCompanyFormPage';
import type { NewHostCompany } from '../../common/creation/hostCompanyData';

// Fassbayar version of "Add a Company": only what Fassbayar has on top of the shared form.
//   Business Details: SST, TIN
//   Bank Details: bank name, account no, account holder name
//   Merchant Category Code (MCC)
//   Special Fields: Reference 1-5
//   MID row: "DBA" (required on Fassbayar, max 25)
// All optional on Fassbayar except DBA; filled with random data (data.extras)
// so every run covers them. Transaction limits keep the form's defaults.
export class FassbayarAddCompanyFormPage extends AddCompanyFormPage {

  protected override async fillPortalCompanyFields(data: NewHostCompany): Promise<void> {
    const x = data.extras;
    await this.typeInto(this.page.locator('#businessSST'), x.sst, { pressTab: true });
    await this.typeInto(this.page.locator('#businessTIN'), x.tin, { pressTab: true });

    await this.page.locator('#businessBankName').selectOption(x.bankName);
    await this.typeInto(this.page.locator('#businessBankAccountNo'), x.bankAccountNo, { pressTab: true });
    await this.typeInto(this.page.locator('#businessBankAccountHolderName'), x.bankAccountHolder, { pressTab: true });

    await this.page.locator('#merchantCategoryCode').selectOption(x.mcc);

    for (const [i, ref] of x.references.entries()) {
      await this.typeInto(this.page.locator(`#specialField${i + 1}Value`), ref, { pressTab: true });
    }
  }

  protected override async verifyPortalReview(data: NewHostCompany): Promise<void> {
    const x = data.extras;
    for (const value of [x.sst, x.tin, x.bankName, x.bankAccountNo, x.bankAccountHolder, x.mcc, ...x.references]) {
      await expect(this.step2, `Review shows "${value}"`).toContainText(value);
    }
  }

  protected override async fillPortalMidFields(row: Locator, n: number, data: NewHostCompany): Promise<void> {
    await this.typeInto(row.locator(`[name="dba${n}"]`), data.dba, { pressTab: true });
  }
}
