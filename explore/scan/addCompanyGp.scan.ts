// DRY RUN of the shared "Add a company with Global Payment" on the portal of
// ENV_NAME: same page objects and data as common/tests/addCompany.spec.ts,
// fills the form, Submits, checks the review - and STOPS. Confirm is NEVER
// clicked, nothing is created.
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts explore/scan/addCompanyGp.scan.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { HomePage } from '../../common/pages/HomePage';
import { AphAddCompanyFormPage } from '../../aph/pages/AphAddCompanyFormPage';
import { FassbayarAddCompanyFormPage } from '../../fassbayar/pages/FassbayarAddCompanyFormPage';
import { Credentials, ENV_NAME, PORTAL, hostsFor } from '../../portals.config';
import { createCompanyForHost } from '../../common/creation/hostCompanyData';

test(`dry run Add a Company with Global Payment on ${ENV_NAME} (no Confirm)`, async ({ page }) => {
  const host = hostsFor().find((h) => h.code === 'GP')!;
  const data = createCompanyForHost(host);
  const form = PORTAL === 'fassbayar' ? new FassbayarAddCompanyFormPage(page) : new AphAddCompanyFormPage(page);
  console.log(`${ENV_NAME}: host=${host.name} schemes=${data.cardSchemes} payment=${data.paymentTypes} business="${data.business.businessName}" MID=${data.mid}`);

  const login = new LoginPage(page);
  await login.goto();
  await login.login(Credentials.username, Credentials.password);
  await login.verifyLoggedIn();

  await new HomePage(page).openAllCompanies();
  await form.open();
  await form.fillCompany(data);
  try {
    await form.submit();
    await form.verifyReview(data);
    console.log(`${ENV_NAME}: REVIEW OK - Global Payment, MID ${data.mid}, ${data.cardSchemes.join(', ')}`);
  } finally {
    console.log(`${ENV_NAME}: errors on form: ${JSON.stringify(await form.visibleErrors())}`);
    console.log(`${ENV_NAME}: REVIEW TEXT: ` + (await form.step2.innerText()).replace(/\s+/g, ' ').slice(0, 700));
    await page.screenshot({ path: `test-results/scan/add-company-gp-dryrun-${ENV_NAME.toLowerCase()}.png`, fullPage: true });
  }
  // Confirm intentionally NOT clicked
});
