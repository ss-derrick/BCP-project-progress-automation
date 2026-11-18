// DRY RUN of "Add a Company" with ONE MID PER HOST that APH offers
// (common/hosts/hosts.ts): fills the whole form with the shared page,
// clicks Submit, checks Review & Confirm and STOPS. Confirm is never
// clicked, so no company is created.
//   npm run explore:aph -- explore/aph/addCompanyDryRun.explore.ts
// One host only:  $env:HOSTS='GP'; npx playwright test ...
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { AllCompaniesPage } from '../../aph/pages/AllCompaniesPage';
import { AddCompanyPage } from '../../common/pages/company/AddCompanyPage';
import { Credentials } from '../../common/config/testConfig';
import { createCompanyData } from '../../aph/testdata/addCompanyData';
import { addCompany } from '../../common/flows/addCompanyFlow';
import { hostsFor, type HostCode } from '../../common/hosts/hosts';

test('dry run Add a Company - one MID per host (no Confirm)', async ({ page }) => {
  test.setTimeout(600_000);
  const hosts = (process.env.HOSTS?.split(',') as HostCode[] | undefined) ?? hostsFor('aph');
  const data = createCompanyData({ hosts });
  const login = new LoginPage(page);
  const all = new AllCompaniesPage(page);
  const add = new AddCompanyPage(page);

  await login.open();
  await login.login(Credentials.username, Credentials.password);
  await page.waitForURL(/\/console/);
  await all.open();
  await add.open();

  // Before Submit the Confirm button must NOT be in view (it is in the slider)
  await expect(add.confirmButton).not.toBeInViewport();

  await addCompany(add, data, { confirm: false });
  console.log(`APH dry run OK - hosts: ${hosts.join(', ')}; MIDs: ${data.mids.map((m) => m.mid).join(', ')}`);
  await page.screenshot({ path: 'explore/explore-dumps/add-company-dry-review.png', fullPage: true });
});
