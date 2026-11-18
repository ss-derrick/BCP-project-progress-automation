import fs from 'node:fs';
import { test } from '@playwright/test';
import { dumpPage } from './dump';

test('explore All Companies search -> View Details', async ({ page }) => {
  page.on('dialog', async (d) => { console.log(`[dialog] ${d.type()}: ${d.message()}`); await d.dismiss(); });
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.locator('a[href="/company"]').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await dumpPage(page, '10-company-list');

  // Search box: first visible text input on the page
  const search = page.locator('input[type="text"]').filter({ visible: true }).first();
  await search.fill('000452839489382');
  await page.getByRole('button', { name: 'Search' }).or(page.getByRole('link', { name: 'Search' })).first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await dumpPage(page, '11-search-results');

  const row = await page.locator('table').last().evaluate((t) => t.outerHTML).catch((e) => `ERR ${e}`);
  fs.writeFileSync('explore-dumps/11-table.html', row);
});
