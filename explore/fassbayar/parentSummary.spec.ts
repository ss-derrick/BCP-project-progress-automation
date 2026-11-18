import fs from 'node:fs';
import { test } from '@playwright/test';

test('explore Parent Company Summary + search', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.goto('/company/parentCompanyListing');
  fs.writeFileSync('explore-dumps/18-table.html',
    await page.locator('#dataRow').first().evaluate((t) => t.outerHTML));

  const rows = page.locator('#dataRow tr.dataListMid');
  const first = rows.first().locator('td');
  const name = (await first.nth(0).innerText()).trim();
  const authoriser = (await first.nth(1).innerText()).trim();
  console.log('FIRST ROW:', JSON.stringify({ name, authoriser }));

  const terms: [string, string][] = [
    ['name', name], ['authoriser', authoriser],
    ['partial-name', name.split(' ')[0]], ['company-page-name', name]
  ];
  for (const [label, term] of terms) {
    const listPage = label === 'company-page-name' ? '/company/list' : '/company/parentCompanyListing';
    await page.goto(listPage);
    await page.locator('#search').fill(term);
    await page.getByRole('link', { name: 'Search', exact: true }).first().click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const body = (await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '?')).replace(/\s+/g, ' ');
    console.log(`\nSEARCH ${label} "${term}" on ${listPage} -> ${page.url()}`);
    const i = body.indexOf('Search Results');
    console.log('  ' + body.slice(i >= 0 ? i : 0, (i >= 0 ? i : 0) + 400));
    await page.screenshot({ path: `explore-dumps/19-parent-search-${label}.png`, timeout: 10_000 }).catch(() => {});
  }
});
