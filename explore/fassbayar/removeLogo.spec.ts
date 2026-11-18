import { test } from '@playwright/test';
import { dumpPage } from './dump';

test('explore Remove Company Logo (no submit)', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.locator('a[href="/company"]').first().click();
  await page.locator('a[href="/company/removeCompanyLogo"]').filter({ visible: true }).first().click();
  await page.waitForURL(/removeCompanyLogo/);
  await dumpPage(page, '26-remove-logo');
  console.log('LEFT:', await page.locator('[id$="ms2side__sx"] option').allInnerTexts());
  console.log('RIGHT:', await page.locator('[id$="ms2side__dx"] option').allInnerTexts());
  console.log('PRESELECTED:', await page.locator('[id$="ms2side__sx"]').evaluate((s) =>
    Array.from((s as HTMLSelectElement).selectedOptions).map((o) => o.textContent)));
});
