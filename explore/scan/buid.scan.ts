// READ-ONLY probe for TC-ADM-003: which User ID lengths does Add a Bank User accept? Submit = validation / Review
// only; Back is clicked, Confirm never. Also prints the page's own User ID rule.
//   $env:ENV_NAME='UAT-FASSBAYAR'; npx playwright test --config explore/scan/scan.config.ts buid
import { test } from '@playwright/test';
import { Credentials, ENV_NAME } from '../../portals.config';

test(`probe bank User ID length on ${ENV_NAME}`, async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });
  await page.goto('/admin/register');
  const rule = await page.evaluate(() => [...document.querySelectorAll('script')].map((s) => s.textContent ?? '')
    .join('\n').split('\n').filter((l) => /userId|regex_buid|buid/i.test(l)).slice(0, 12).join('\n'));
  console.log('PROBE page rule lines:\n' + rule);
  const r = Math.random().toString(36).slice(2, 6);
  for (const id of ['abc', 'xyz', 'qa7', `q${r.slice(0, 2)}`, `qa${r.slice(0, 2)}`, `qaz${r.slice(0, 2)}`]) {
    await page.goto('/admin/register');
    await page.locator('#userId').fill(id);
    await page.locator('#name').fill('QA Probe');
    await page.locator('#email').fill('qa.probe@example.com');
    await page.locator('a.button, button', { hasText: /^\s*Submit\s*$/ }).first().click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
    const err = (await page.locator('#userIdError').innerText().catch(() => '')).trim();
    const review = await page.getByText('Confirm', { exact: true }).isVisible().catch(() => false);
    console.log(`PROBE "${id}" (${id.length}) -> ${err || (review ? 'accepted (Review page)' : 'no error')}`);
  }
});
