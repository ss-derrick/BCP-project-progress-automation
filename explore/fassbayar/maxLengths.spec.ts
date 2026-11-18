import { test } from '@playwright/test';

// Print maxlength of every text input on the Add Company / Add Parent Company forms
test('explore input maxlength', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  for (const path of ['/company/register', '/company/registerMasterMerchant']) {
    await page.goto(path);
    const rows = await page.locator('input[type="text"]').evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => `${e.getAttribute('name')}: maxlength=${e.getAttribute('maxlength') ?? '-'}`));
    console.log(`== ${path}\n${rows.join('\n')}`);
  }
});
