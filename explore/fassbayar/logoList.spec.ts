import { test } from '@playwright/test';

// Which companies does the Upload Company Logo picker offer?
test('explore logo company list', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);
  await page.goto('/company/uploadCompanyLogo');

  const options = await page.locator('#snList option').evaluateAll((os) =>
    os.map((o) => `${(o as HTMLOptionElement).value}=${o.textContent!.trim()}`));
  console.log('TOTAL options:', options.length);
  for (const id of ['2083', '2084', '2085', '2086', '2087', '2088', '2089', '2100', '2103']) {
    console.log(id, options.find((o) => o.startsWith(`${id}=`)) ?? 'NOT IN LIST');
  }

  await page.goto('/company/removeCompanyLogo');
  const rm = await page.locator('select option').evaluateAll((os) =>
    os.map((o) => `${(o as HTMLOptionElement).value}=${o.textContent!.trim()}`));
  console.log('REMOVE page options:', rm.length, '| has 2089:', rm.some((o) => o.startsWith('2089=')));
});
