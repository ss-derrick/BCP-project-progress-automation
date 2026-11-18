// DRY RUN of "Add a Parent Company" for both Merchant Types with the shared
// page + flow: fills the form, Submit, checks Review & Confirm and STOPS.
// Confirm is never clicked, so no parent company is created.
//   npm run explore:fassbayar -- explore/fassbayar/addParentCompanyDryRun.spec.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { HomePage } from '../../fassbayar/pages/HomePage';
import { AddParentCompanyPage } from '../../common/pages/company/AddParentCompanyPage';
import { loginAsAdmin } from '../../fassbayar/flows/loginFlow';
import { createParentCompanyData, type MerchantType } from '../../fassbayar/testdata/parentCompanyData';
import { addParentCompany } from '../../common/flows/addParentCompanyFlow';

test('dry run Add a Parent Company - both Merchant Types (no Confirm)', async ({ page }) => {
  test.setTimeout(300_000);
  const home = new HomePage(page);
  const add = new AddParentCompanyPage(page);

  await loginAsAdmin(new LoginPage(page));

  for (const merchantType of ['Master Merchant', 'HQ Merchant'] as MerchantType[]) {
    await home.openAllCompanies();
    await add.open();
    await addParentCompany(add, createParentCompanyData({ merchantType }), { confirm: false });
    console.log(`FassBayar parent dry run OK - ${merchantType}`);
  }
});
