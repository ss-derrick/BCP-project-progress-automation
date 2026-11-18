import { test } from '@playwright/test';

// Was the parent company from a timed-out run created anyway?  $env:FIND='Banana Leaf House 33JRWO'
test('explore parent company summary search', async ({ page }) => {
  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);
  await page.goto('/company/parentCompanyListing');
  const name = process.env.FIND ?? '';
  const text = await page.locator('body').innerText();
  console.log('FOUND ON PAGE 1:', text.includes(name));
  const search = page.locator('#search');
  if (await search.count()) {
    await search.fill(name);
    await page.getByRole('link', { name: 'Search', exact: true }).first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
    console.log('AFTER SEARCH URL', page.url());
    console.log('FOUND AFTER SEARCH:', (await page.locator('body').innerText()).includes(name));
  }
});
