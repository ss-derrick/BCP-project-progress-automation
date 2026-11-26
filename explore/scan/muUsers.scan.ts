// READ-ONLY: mobile users of the Test Data companies (TD-06 / TD-07) via the Mobile User Summary MID filter.
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts muUsers
import { test } from '@playwright/test';
import { Credentials, ENV_NAME } from '../../portals.config';
const MIDS: Record<string, string[]> = { 'UAT-APH': ['202610011060002', '048800001853662'], 'UAT-FASSBAYAR': ['098821328347823', '201805230000001'] };
test(`mobile users of TD companies on ${ENV_NAME}`, async ({ page }) => {
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });
  for (const mid of MIDS[ENV_NAME]) {
    await page.goto(`/mobileUser/list?mid=${mid}&status=&from=26+Nov+2016&to=26+Nov+2026`);
    const rows = await page.locator('#dataRow tr.dataListMid').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].slice(0, 5).map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | ')));
    const total = (await page.locator('#rightMainContent').innerText()).match(/Total Records:?\s*\d+/)?.[0];
    console.log(`MU ${mid}: ${total}\n  ${rows.slice(0, 8).join('\n  ')}`);
  }
});
