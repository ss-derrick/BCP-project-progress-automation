import fs from 'node:fs';
import { test } from '@playwright/test';
import { dumpPage } from './dump';

// Open an existing company's details page:  $env:ITEM_ID='2083'
test('explore company details', async ({ page }) => {
  page.on('dialog', async (d) => { console.log(`[dialog] ${d.type()}: ${d.message()}`); await d.dismiss(); });
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.goto(`/company/viewDetails?itemid=${process.env.ITEM_ID ?? '2083'}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await dumpPage(page, '09-company-details');

  // label -> value pairs (div.confirmLabel followed by div.confirmValue)
  const pairs = await page.locator('.confirmLabel').evaluateAll((labels) =>
    labels.map((l) => {
      const v = l.nextElementSibling;
      return `${l.textContent!.trim().replace(/\s+/g, ' ')} => ${
        v ? `[${v.className}] ${v.textContent!.trim().replace(/\s+/g, ' ')}` : '(none)'}`;
    }));
  const midBox = await page.locator('[onclick^="showMidSetting"]').first().innerHTML();
  fs.writeFileSync('explore/explore-dumps/09-pairs.txt', pairs.join('\n') + '\n\n' + midBox);
});
