// READ-ONLY: what does the portal do with a MID that already exists?
// Fills Add a Company with an existing MID, watches the MID field after
// leaving it, then Submit (Submit only validates / shows the review).
// Confirm is NEVER clicked: nothing can be created.
//   $env:ENV_NAME='UAT-APH'; $env:EXISTING_MID='...'; npx playwright test --config explore/scan/scan.config.ts explore/scan/duplicateMid.scan.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { HomePage } from '../../common/pages/HomePage';
import { AphAddCompanyFormPage } from '../../aph/pages/AphAddCompanyFormPage';
import { FassbayarAddCompanyFormPage } from '../../fassbayar/pages/FassbayarAddCompanyFormPage';
import { Credentials, ENV_NAME, PORTAL, hostsFor } from '../../portals.config';
import { createCompanyForHost } from '../../common/creation/hostCompanyData';

test(`duplicate MID behaviour on ${ENV_NAME} (no Confirm)`, async ({ page }) => {
  const existing = process.env.EXISTING_MID ?? '';
  test.skip(!existing, 'set EXISTING_MID');
  const host = hostsFor().find((h) => h.code === 'GP')!;
  const data = { ...createCompanyForHost(host), mid: existing };
  const form = PORTAL === 'fassbayar' ? new FassbayarAddCompanyFormPage(page) : new AphAddCompanyFormPage(page);

  // record every request the page makes, to see when the MID is checked
  const calls: string[] = [];
  page.on('request', (r) => { if (!/\.(js|css|png|gif|jpg|woff2?)(\?|$)/.test(r.url())) calls.push(`${r.method()} ${r.url().replace(/^https:\/\/[^/]+/, '')}`); });

  const login = new LoginPage(page);
  await login.goto();
  await login.login(Credentials.username, Credentials.password);
  await login.verifyLoggedIn();
  await new HomePage(page).openAllCompanies();
  await form.open();

  // 1) the MID field alone, then leave it
  calls.length = 0;
  const midBox = form.midRow(0).locator('[name="mid0"]');
  await midBox.click(); await midBox.fill(existing); await midBox.press('Tab');
  await page.waitForTimeout(2500);
  const nearMid = (await form.midRow(0).innerText()).replace(/\s+/g, ' ').slice(0, 300);
  console.log('AFTER LEAVING MID FIELD - requests:', JSON.stringify(calls));
  console.log('AFTER LEAVING MID FIELD - errors:', JSON.stringify(await form.visibleErrors()));
  console.log('AFTER LEAVING MID FIELD - MID row text:', nearMid);

  // 2) whole form + Submit
  calls.length = 0;
  await form.fillCompany(data);
  await form.submitButton.click();
  await page.waitForTimeout(3000);
  const reviewInView = await form.confirmButton.evaluate((el) => {
    const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 0;
  });
  const dialogs = await page.locator('.fancybox-wrap:visible, .ui-dialog:visible, [role="dialog"]:visible').allInnerTexts();
  const pageMsgs = await page.getByText(/exist|duplicate|already|used/i).allInnerTexts();
  console.log('AFTER SUBMIT - requests:', JSON.stringify(calls));
  console.log('AFTER SUBMIT - errors:', JSON.stringify(await form.visibleErrors()));
  console.log('AFTER SUBMIT - dialogs:', JSON.stringify(dialogs.map((d) => d.replace(/\s+/g, ' ').slice(0, 200))));
  console.log('AFTER SUBMIT - texts mentioning exist/duplicate/already/used:', JSON.stringify(pageMsgs.map((t) => t.replace(/\s+/g, ' ').slice(0, 200))));
  console.log('AFTER SUBMIT - reached review step (Confirm in view):', reviewInView, '| URL:', page.url());
  await page.screenshot({ path: `test-results/scan/duplicate-mid-${ENV_NAME.toLowerCase()}.png`, fullPage: true });
  // Confirm intentionally NOT clicked
});
