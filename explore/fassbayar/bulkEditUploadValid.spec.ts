import fs from 'node:fs';
import { test } from '@playwright/test';
import { dumpPage } from './dump';

// Upload a VALID edit CSV for a company created by the automation (itemid 2089)
test('explore Bulk Company Upload (Edit) - valid row', async ({ page }) => {
  page.on('dialog', async (d) => { console.log(`[dialog] ${d.type()}: ${d.message()}`); await d.accept(); });
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  const file = 'explore-dumps/edit-valid.csv';
  fs.writeFileSync(file,
    'CompanyID;Business Name;Reference1;Reference2;Reference3;Reference4;Reference5\n' +
    '2089;Char Kuey Teow Corner 7F1E85;EXP-R1;EXP-R2;EXP-R3;EXP-R4;EXP-R5\n');

  await page.goto('/company/bulkEditUpload');
  await page.locator('#realupload').setInputFiles(file);
  await page.getByRole('link', { name: 'Upload', exact: true }).click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await dumpPage(page, '15-bulk-edit-valid-result');
  console.log('RESULT URL', page.url());
  const apply = page.getByText('Apply Changes', { exact: true });
  console.log('APPLY', await apply.evaluate((e) => e.outerHTML));
  await apply.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await dumpPage(page, '16-bulk-edit-applied');
  console.log('APPLIED URL', page.url());

  await page.goto('/company/viewDetails?itemid=2089');
  const refs = await page.locator('.confirmLabel').evaluateAll((ls) => ls
    .filter((l) => /Reference/.test(l.textContent!))
    .map((l) => `${l.textContent!.trim()} = ${l.nextElementSibling?.textContent!.trim()}`));
  console.log(refs.join('\n'));
});
