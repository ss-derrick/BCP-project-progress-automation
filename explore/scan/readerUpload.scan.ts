// Probe of Register New Readers with files that CANNOT create a reader (wrong file type, header only,
// unknown MID, invalid serial). Records the exact messages / result page per portal for RDR-004.
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts readerUpload
// Output: explore/scan/results/readerUpload-<env>.json, screenshots test-results/readerUpload-<env>/
import { test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Credentials, ENV_NAME } from '../../portals.config';

const env = ENV_NAME.toLowerCase();
const DIR = `test-results/readerUpload-${env}`;
const HEADER = 'Reader Serial No.;MID;ServiceProvider';

const FILES: { name: string; content: string }[] = [
  { name: 'not-a-csv.xlsx', content: 'PK\u0003\u0004 not really a spreadsheet' },
  { name: 'header-only.csv', content: `${HEADER}\r\n` },
  { name: 'unknown-mid.csv', content: `${HEADER}\r\nQAPROBE0000001;999999999999999;ACS\r\n` },
  { name: 'invalid-serial.csv', content: `${HEADER}\r\nQA PROBE#!;999999999999999;ACS\r\n` },
  { name: 'empty.csv', content: '' }
];

test(`probe reader upload messages on ${ENV_NAME}`, async ({ page }) => {
  test.setTimeout(10 * 60_000);
  page.setDefaultTimeout(20_000);
  fs.mkdirSync(DIR, { recursive: true });
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });

  const results: unknown[] = [];
  for (const [i, f] of FILES.entries()) {
    const file = path.resolve(DIR, f.name);
    fs.writeFileSync(file, f.content);
    await page.goto('/reader/register');
    await page.locator('#realupload').setInputFiles(file);
    await page.waitForTimeout(500);
    const fake = await page.locator('#fakeupload').inputValue().catch(() => '');
    let dialog = '';
    page.once('dialog', async (d) => { dialog = d.message(); await d.dismiss(); });
    await page.locator('#upload').click();
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const main = (await page.locator('#rightMainContent').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const tables = await page.locator('#rightMainContent table').evaluateAll((ts) => ts.map((t) =>
      Array.from(t.querySelectorAll('tr')).slice(0, 6).map((r) => Array.from(r.querySelectorAll('th,td')).map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())))).catch(() => []);
    await page.screenshot({ path: `${DIR}/${i + 1}-${f.name}.png`, fullPage: true });
    results.push({ file: f.name, fakeupload: fake, dialog, url: page.url().replace(/^https?:\/\/[^/]+/, ''), main: main.slice(0, 700), tables });
    console.log(`${f.name}: dialog="${dialog}" url=${page.url()} | ${main.slice(0, 300)}`);
  }
  fs.mkdirSync('explore/scan/results', { recursive: true });
  fs.writeFileSync(`explore/scan/results/readerUpload-${env}.json`, JSON.stringify(results, null, 2));
});
