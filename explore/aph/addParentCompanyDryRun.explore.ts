// DRY RUN of "Add a Parent Company" for both Merchant Types with the shared
// page + flow: fills the form, Submit, checks Review & Confirm and STOPS.
// Confirm is never clicked, so no parent company is created.
//   npm run explore:aph -- explore/aph/addParentCompanyDryRun.explore.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { AllCompaniesPage } from '../../aph/pages/AllCompaniesPage';
import { AddParentCompanyPage, type MerchantType } from '../../common/pages/company/AddParentCompanyPage';
import { Credentials } from '../../common/config/testConfig';
import { createParentCompany } from '../../aph/testdata/addParentCompanyData';
import { addParentCompany } from '../../common/flows/addParentCompanyFlow';

test('dry run Add a Parent Company - both Merchant Types (no Confirm)', async ({ page }) => {
  const login = new LoginPage(page);
  const all = new AllCompaniesPage(page);
  const add = new AddParentCompanyPage(page);

  await login.open();
  await login.login(Credentials.username, Credentials.password);
  await page.waitForURL(/\/console/);

  for (const type of ['Master Merchant', 'HQ Merchant'] as MerchantType[]) {
    await all.open();
    await add.open();
    await addParentCompany(add, createParentCompany(type), { confirm: false });
    console.log(`APH parent dry run OK - ${type}`);
  }
});
