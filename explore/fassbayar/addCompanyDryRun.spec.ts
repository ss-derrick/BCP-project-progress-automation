// DRY RUN of "Add a Company" with ONE MID PER HOST that FassBayar offers
// (common/hosts/hosts.ts): fills the whole form with the shared page,
// clicks Submit, checks Review & Confirm and STOPS. Confirm is never
// clicked, so no company is created.
//   npm run explore:fassbayar -- explore/fassbayar/addCompanyDryRun.spec.ts
// One host only:  $env:HOSTS='GP'; npx playwright test ...
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { HomePage } from '../../fassbayar/pages/HomePage';
import { AddCompanyPage } from '../../common/pages/company/AddCompanyPage';
import { loginAsAdmin } from '../../fassbayar/flows/loginFlow';
import { createCompanyData } from '../../fassbayar/testdata/companyData';
import { addCompany } from '../../common/flows/addCompanyFlow';
import { hostsFor, type HostCode } from '../../common/hosts/hosts';

test('dry run Add a Company - one MID per host (no Confirm)', async ({ page }) => {
  test.setTimeout(600_000);
  const hosts = (process.env.HOSTS?.split(',') as HostCode[] | undefined) ?? hostsFor('fassbayar');
  const data = createCompanyData({ hosts });
  const add = new AddCompanyPage(page);

  await loginAsAdmin(new LoginPage(page));
  await new HomePage(page).openAddCompany();

  // Before Submit the Confirm button must NOT be in view (it is in the slider)
  await expect(add.confirmButton).not.toBeInViewport();

  await addCompany(add, data, { confirm: false });
  console.log(`FassBayar dry run OK - hosts: ${hosts.join(', ')}; MIDs: ${data.mids.map((m) => m.mid).join(', ')}`);
  await page.screenshot({ path: 'explore/explore-dumps/add-company-dry-review.png', fullPage: true });
});
