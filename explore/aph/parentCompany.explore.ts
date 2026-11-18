// Explore "Parent Company Summary" (All Companies > Quicklinks >
// Parent Company Summary, /company/parentCompanyListing): list, search
// "test_kw_master", open its details. Read-only - nothing is changed.
//   npm run explore:aph -- explore/aph/parentCompany.explore.ts
import { test, Page } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { Credentials } from '../../common/config/testConfig';
import { dump, tryStep } from './dump';

const KEYWORD = 'test_kw_master';

async function describe(page: Page, label: string): Promise<void> {
  const info = await page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('#rightMainContent') ?? document.body;
    return {
      url: location.href,
      text: txt(root).slice(0, 1500),
      forms: Array.from(root.querySelectorAll('form')).map((f) =>
        `<form name=${f.getAttribute('name')} action=${f.getAttribute('action')} method=${f.getAttribute('method')}> ` +
        Array.from(f.querySelectorAll('input,select,a.button,button')).map((e) => {
          const el = e as HTMLInputElement;
          return `${el.tagName.toLowerCase()}#${el.id}[name=${el.name}][type=${el.type}][value=${(el.value ?? '').slice(0, 30)}]${el.tagName === 'A' || el.tagName === 'BUTTON' ? '"' + txt(el) + '"' : ''}${el.tagName === 'SELECT' ? '{' + Array.from((el as unknown as HTMLSelectElement).options).map((o) => o.value + '=' + txt(o)).join('|').slice(0, 300) + '}' : ''}`;
        }).join(' ')),
      tableHeader: txt(root.querySelector('#dataRow tr.dataTitleMid, table tr th')?.closest('tr')),
      firstRows: Array.from(root.querySelectorAll('#dataRow tr.dataListMid, table tr')).slice(0, 4).map((r) => (r as HTMLElement).outerHTML.replace(/\s+/g, ' ').slice(0, 900)),
      links: Array.from(root.querySelectorAll('a')).map((a) => `${txt(a)} -> ${a.getAttribute('href')}`).filter((s) => !s.startsWith(' ->')).slice(0, 30)
    };
  });
  console.log(`\n===== ${label}\nURL ${info.url}\nTEXT ${info.text}\nFORMS\n  ${info.forms.join('\n  ')}\nHEADER ${info.tableHeader}\nROWS\n  ${info.firstRows.join('\n  ')}\nLINKS\n  ${info.links.join('\n  ')}`);
}

test('explore Parent Company Summary', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login(Credentials.username, Credentials.password);
  await page.waitForURL(/\/console/);

  await page.locator('#topNavi a[href="/company"]').click();
  await page.locator('#leftPanel').getByRole('link', { name: 'Parent Company Summary' }).click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await describe(page, 'LIST');
  await dump(page, 'parent-01-list');

  // Search: try the page's search box (first text input in a search form)
  await tryStep(`search ${KEYWORD}`, async () => {
    const box = page.locator('#rightMainContent input[type="text"]').first();
    await box.click();
    await box.fill(KEYWORD);
    await page.locator('#rightMainContent form').first().locator('a.button, button, input[type="submit"]').first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
  });
  await describe(page, 'AFTER SEARCH');
  await dump(page, 'parent-02-search');

  // Details: only read-only options (View...) - never suspend/edit/delete
  const row = page.locator('#rightMainContent tr', { hasText: KEYWORD }).first();
  const quick = row.locator('select');
  if (await quick.count()) {
    const opts = await quick.first().locator('option').allInnerTexts();
    console.log('QUICKLINK OPTIONS: ' + JSON.stringify(opts.map((o) => o.trim())));
    const view = opts.map((o) => o.trim()).find((o) => /^view( details)?$/i.test(o)) ?? opts.map((o) => o.trim()).find((o) => /^view/i.test(o));
    if (view) {
      await tryStep(`quicklink ${view}`, async () => {
        await quick.first().selectOption({ label: view });
        await row.getByRole('link', { name: 'Go' }).click();
        await page.waitForLoadState('networkidle').catch(() => {});
      });
    }
  } else {
    const link = row.getByRole('link').filter({ hasText: /view|detail|test_kw_master/i }).first();
    await tryStep('open record link', () => link.click());
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  await describe(page, 'DETAILS');
  await dump(page, 'parent-03-details');
});
