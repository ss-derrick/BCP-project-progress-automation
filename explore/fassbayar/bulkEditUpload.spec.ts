import fs from 'node:fs';
import { test } from '@playwright/test';
import { dumpPage } from './dump';

test('explore Bulk Company Upload (Edit) + download template', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.locator('a[href="/company"]').first().click();
  await page.locator('a[href="/company/bulkEditUpload"]').filter({ visible: true }).first().click();
  await page.waitForURL(/bulkEditUpload/);
  await dumpPage(page, '13-bulk-edit-upload');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('download template').click()
  ]);
  const file = 'explore-dumps/edit-' + download.suggestedFilename();
  await download.saveAs(file);
  console.log('downloaded', download.suggestedFilename(), download.url());
  console.log(fs.readFileSync(file, 'utf8'));

  page.on('dialog', async (d) => { console.log(`[dialog] ${d.type()}: ${d.message()}`); await d.accept(); });
  await page.locator('#realupload').setInputFiles(file);
  await page.getByRole('link', { name: 'Upload', exact: true }).click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await dumpPage(page, '14-bulk-edit-result');
  const main = await page.locator('h1, h2, h3, p, .title, [class*=title], [class*=Title]').filter({ visible: true })
    .allInnerTexts();
  console.log('RESULT URL', page.url());
  console.log(main.filter((t) => t.trim()).slice(0, 15).join('\n---\n'));
});
