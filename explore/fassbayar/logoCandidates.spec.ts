import { test } from '@playwright/test';
import { isAutomationCompanyName } from '../../fassbayar/testdata/companyData';

// Which automation-created companies are offered in Upload / Remove Company Logo?
test('explore logo candidates', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  for (const path of ['/company/uploadCompanyLogo', '/company/removeCompanyLogo']) {
    await page.goto(path);
    const options = await page.locator('#snList option').evaluateAll((os) =>
      os.map((o) => ({ id: (o as HTMLOptionElement).value, name: (o.textContent ?? '').trim() })));
    const ours = options.filter((o) => isAutomationCompanyName(o.name));
    const recent = options.filter((o) => Number(o.id) >= 2083).map((o) => `${o.id}=${o.name}`);
    console.log(`\n${path}: total ${options.length}, automation-named ${ours.length}`);
    console.log('  ids >= 2083:', recent.join(' | ') || '(none)');
  }
});
