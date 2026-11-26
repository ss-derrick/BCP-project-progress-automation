// READ-ONLY probe: Mobile User Summary date filter (is "to" inclusive? which date is filtered?)
import { test } from '@playwright/test';
import { Credentials, ENV_NAME } from '../../portals.config';
test(`mu date filter on ${ENV_NAME}`, async ({ page }) => {
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });
  const run = async (q: string) => {
    await page.goto(`/mobileUser/list?${q}`);
    const rows = await page.locator('#dataRow tr.dataListMid').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].slice(1, 5).map((td) => (td.textContent ?? '').trim()).join(' | ')));
    const total = (await page.locator('#rightMainContent').innerText()).match(/Total Records:?\s*\d+/)?.[0] ?? 'none';
    console.log(`PROBE ${q} -> ${total}; ${rows.slice(0, 3).join(' ;; ')}`);
  };
  await page.goto('/mobileUser/search?search=hhacs');
  console.log('PROBE hhacs row:', (await page.locator('#dataRow tr.dataListMid').first().innerText()).replace(/\s+/g, ' '));
  await run('mid=&status=&from=07+Mar+2023&to=07+Mar+2023');
  await run('mid=&status=&from=07+Mar+2023&to=08+Mar+2023');
  await run('mid=&status=&from=03+Jan+2023&to=03+Jan+2023');
  await run('mid=&status=&from=03+Jan+2023&to=04+Jan+2023');
  await run('mid=000458060000038&status=&from=01+Jan+2023&to=31+Mar+2023');
});
