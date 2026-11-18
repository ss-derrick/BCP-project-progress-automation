import { test } from '@playwright/test';
import { dumpPage } from './dump';

test('explore Add a Parent Company form', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.locator('a[href="/company"]').first().click();
  await page.locator('a[href="/company/registerMasterMerchant"]').filter({ visible: true }).first().click();
  await page.waitForURL(/registerMasterMerchant/);
  await dumpPage(page, '17-add-parent-company');
});
