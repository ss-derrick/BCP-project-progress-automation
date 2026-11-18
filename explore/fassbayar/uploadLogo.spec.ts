import fs from 'node:fs';
import { test } from '@playwright/test';
import { dumpPage } from './dump';

test('explore Upload Company Logo', async ({ page, browser }) => {
  test.setTimeout(240_000);

  // Make a 400x180 PNG
  const gen = await browser.newPage();
  await gen.setContent(`<div id="logo" style="width:400px;height:180px;display:flex;align-items:center;
    justify-content:center;background:linear-gradient(135deg,#2a7,#147);color:#fff;font:bold 36px Arial">QA LOGO</div>`);
  await gen.locator('#logo').screenshot({ path: 'explore-dumps/logo.png' });
  await gen.close();

  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.locator('a[href="/company"]').first().click();
  await page.locator('a[href="/company/uploadCompanyLogo"]').filter({ visible: true }).first().click();
  await page.waitForURL(/uploadCompanyLogo/);
  await dumpPage(page, '20-logo-step1');

  await page.locator('input[type="file"]').first().setInputFiles('explore-dumps/logo.png');
  await page.waitForTimeout(1000);
  await dumpPage(page, '21-logo-chosen');
  await page.getByRole('link', { name: 'Next', exact: true }).filter({ visible: true }).first().click();
  await page.waitForTimeout(2000);
  await dumpPage(page, '22-logo-step2-company');

  // The company picker: print its HTML structure (trimmed)
  const html = await page.locator('body').innerHTML();
  const i = html.search(/Char Kuey Teow Corner 7F1E85/);
  console.log('URL', page.url(), 'picker snippet:\n', i >= 0 ? html.slice(Math.max(0, i - 1500), i + 300) : 'company not found in page');
  fs.writeFileSync('explore-dumps/22-body.html', html);

  // Move buttons of the two-list widget
  const ms = await page.locator('.ms2side__options, .ms2side__select, [class*=ms2side]').evaluateAll((els) =>
    els.map((e) => `${e.tagName}.${e.className} title=${e.getAttribute('title')} text=${(e.textContent ?? '').trim().slice(0, 30)}`));
  console.log('MS2SIDE:\n' + ms.join('\n'));

  await page.locator('#selectedSnms2side__sx').selectOption('2089');
  await page.locator('.ms2side__options .AddOne').click();
  console.log('RIGHT LIST:', await page.locator('#selectedSnms2side__dx option').allInnerTexts());
  await dumpPage(page, '23-logo-company-moved');

  await page.locator('a.next[id="2"]').click();
  await page.waitForTimeout(2000);
  await dumpPage(page, '24-logo-review');
  const review = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const r = review.indexOf('Selected Company Logo');
  console.log('REVIEW TEXT:', review.slice(r, r + 600));

  await page.locator('#submitThis').filter({ visible: true }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await dumpPage(page, '25-logo-complete');
  const done = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const d = done.indexOf('Uploaded Company Logo');
  console.log('COMPLETE URL', page.url(), '\n', done.slice(d, d + 300));
});
