import fs from 'node:fs';
import { test } from '@playwright/test';
import { dumpPage } from './dump';

test('explore Bulk Company Upload (Create) + download template', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.locator('a[href="/company"]').first().click();
  await page.locator('a[href="/company/bulkupload"]').filter({ visible: true }).first().click();
  await page.waitForURL(/bulkupload/);
  await dumpPage(page, '12-bulk-upload');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('download template').click()
  ]);
  const file = 'explore-dumps/' + download.suggestedFilename();
  await download.saveAs(file);
  console.log('downloaded', download.suggestedFilename(), download.url());
  console.log(fs.readFileSync(file, 'utf8').slice(0, 1500));
});
