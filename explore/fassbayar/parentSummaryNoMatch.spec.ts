import { test } from '@playwright/test';

// Does Parent Company search fail only when there ARE matches?
test('explore parent search with no matches', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  const responses: string[] = [];
  page.on('response', (r) => { if (/search|issue/i.test(r.url())) responses.push(`${r.status()} ${r.url()}`); });

  for (const term of ['ZZZNOMATCH12345', 'Roti Canai House ALGE6D']) {
    responses.length = 0;
    await page.goto('/company/parentCompanyListing');
    await page.locator('#search').fill(term);
    await page.getByRole('link', { name: 'Search', exact: true }).first().click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`\n"${term}" -> ${page.url()}`);
    console.log('  responses:', responses.join(' | '));
    console.log('  error page:', body.includes('An error has occurred'),
      '| total:', body.match(/Total Records:\s*\d+/)?.[0] ?? '-');
  }
});
