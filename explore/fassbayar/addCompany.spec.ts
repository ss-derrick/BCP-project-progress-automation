import { test } from '@playwright/test';
import { dumpPage } from './dump';

test('explore login -> All Companies -> Add a Company', async ({ page }) => {
  page.on('dialog', async (d) => { console.log(`[dialog] ${d.type()}: ${d.message()}`); await d.accept(); });

  await page.goto('/');
  await page.locator('#t_username').fill(process.env.APP_USER!);
  await page.locator('#t_password').fill(process.env.APP_PASSWORD!);
  await page.locator('#login_btn').click();
  await page.waitForURL(/console/);

  await page.getByRole('link', { name: 'Add a Company' }).first().click();
  await page.waitForURL(/company\/register/);

  const stamp = Date.now().toString().slice(-6);
  const mid = `9${Date.now().toString().padStart(14, '0').slice(-14)}`;
  console.log('stamp', stamp, 'mid', mid);

  await page.locator('#businessName').fill(`Chicken Rice ${stamp}`);
  await page.locator('#businessShortName').fill('Chic Ric');
  await page.locator('#businessRegistrationNo').fill('12345678910');
  await page.locator('#businessSST').fill('3232234');
  await page.locator('#businessTIN').fill('32434132');
  await page.locator('#address1').fill('Jalan Kiamat');
  await page.locator('#address2').fill('Taman Menyala');
  await page.locator('#postcode').fill('51000');
  await page.locator('#city').fill('Kuala Lumpur');
  await page.locator('#state').selectOption('Kuala Lumpur');
  await page.locator('#businessContact').fill('0367891627');

  await page.locator('#salutation').selectOption('Mr.');
  await page.locator('#fullName').fill('Derrick TestOne');
  await page.locator('#contact_prefix').fill('017');
  await page.locator('#contact_body').fill('3218948');
  await page.locator('#email').fill('derrick.abbasy@softspace.com.my');
  await page.locator('#partnerPrefix').fill('hbk');

  await page.locator('#businessBankName').selectOption('CIMB Bank Berhad');
  await page.locator('#businessBankAccountNo').fill('872198379821739');
  await page.locator('#businessBankAccountHolderName').fill('Wakanda Tester');
  await page.locator('#merchantCategoryCode').selectOption('2741');

  await page.locator('input[name="mid0"]').fill(mid);
  await page.locator('select[name="serviceProvider0"]').selectOption('TPA');
  await page.locator('input[name="dba0"]').fill('Test');
  // chosen.js multi-select
  await page.locator('.chosen-search-input').first().click();
  await page.waitForTimeout(500);
  await dumpPage(page, '05-chosen-open');
  await page.locator('.chosen-results li', { hasText: /^VISA$/ }).first().click();
  await page.locator('.chosen-search-input').first().click();
  await page.locator('.chosen-results li', { hasText: /^MasterCard$/ }).first().click();
  await page.locator('input[name="tpaCheckbox0"]').check();
  await page.locator('input[name="preAuthCheckbox0"]').check();

  await page.locator('#enableContaclessSupport').check();
  await page.locator('#optInMccsCheckbox').check();
  await page.locator('#enableBillPayment').check();
  await page.locator('#byPassVoid').check();
  await page.waitForTimeout(500);
  await page.locator('#byPassSettlement').check();

  await dumpPage(page, '06-filled');
  await page.locator('a.next').click();
  await page.waitForTimeout(3000);
  await dumpPage(page, '07-review');

  await page.locator('#submitThis').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await dumpPage(page, '08-after-confirm');
});


