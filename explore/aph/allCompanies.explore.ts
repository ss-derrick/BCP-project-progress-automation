// Explore the APH "All Companies" module (top menu "All Companies",
// /company/list). Browse and search only - nothing is created or changed.
//   npm run explore:aph -- explore/aph/allCompanies.explore.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { Credentials } from '../../common/config/testConfig';
import { dump, tryStep } from './dump';

test('explore All Companies', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login(Credentials.username, Credentials.password);
  await page.waitForURL(/\/console/);

  await page.locator('#topNavi a[href="/company"]').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await dump(page, 'company-01');

  // Details the dump does not show: top menu label, status options,
  // quicklink options, header + first row cells, search box placeholder
  const info = await page.evaluate(() => {
    const txt = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const table = document.querySelector('#dataRow');
    const firstRow = table?.querySelectorAll('tr')[1];
    return {
      topMenu: Array.from(document.querySelectorAll('#topNavi > li')).map((li) => `${txt(li)} | class=${li.className}`),
      heading: Array.from(document.querySelectorAll('h1,h2,h3,.title, #rightMainContent [class*=title]')).map(txt).filter(Boolean),
      statusOptions: Array.from(document.querySelectorAll('select[name="status"] option')).map((o) => `${(o as HTMLOptionElement).value}=${txt(o)}`),
      quicklinkOptions: Array.from(document.querySelectorAll('select.selectInTable'))[0]
        ? Array.from(document.querySelectorAll('select.selectInTable')[0].querySelectorAll('option')).map((o) => `${(o as HTMLOptionElement).value}=${txt(o)}`)
        : [],
      headerHtml: table?.querySelectorAll('tr')[0]?.outerHTML.replace(/\s+/g, ' ').slice(0, 900),
      firstRowHtml: firstRow?.outerHTML.replace(/\s+/g, ' ').slice(0, 1500),
      rowCount: table ? table.querySelectorAll('tr').length : 0,
      totalRecord: txt(document.querySelector('#totalRecord')),
      searchForm: document.querySelector('form[name="searchForm"]')?.outerHTML.replace(/\s+/g, ' ').slice(0, 1200),
      filterFormAction: document.querySelector('form[name="filterForm"]')?.getAttribute('action')
    };
  });
  console.log(JSON.stringify(info, null, 2));

  // Search for a business name seen on page 1 (read-only)
  await tryStep('search testcreate888', async () => {
    const box = page.locator('#search');
    await box.click();
    await box.fill('testcreate888');
    await page.locator('form[name="searchForm"] a.button').click();
    await page.waitForLoadState('networkidle');
  });
  console.log('after search URL:', page.url());
  console.log('after search rows:', await page.locator('#dataRow tr').count(),
    '|', (await page.locator('#totalRecord').innerText().catch(() => '')).replace(/\s+/g, ' '));
  await dump(page, 'company-02-search');

  // Search for something that does not exist
  await tryStep('search no match', async () => {
    const box = page.locator('#search');
    await box.fill('zzzz-no-such-company-zzzz');
    await page.locator('form[name="searchForm"] a.button').click();
    await page.waitForLoadState('networkidle');
  });
  console.log('no-match URL:', page.url());
  console.log('no-match text:', (await page.locator('#rightMainContent').innerText()).replace(/\s+/g, ' ').slice(0, 600));
  await dump(page, 'company-03-nomatch');
});
