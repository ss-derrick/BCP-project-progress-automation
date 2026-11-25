// READ-ONLY probe: what does GET /auth/logout do (used by the session-timeout dialog's "No, sign me out" and by
// the idle timeout), compared with the LOGOUT button (POST logoutForm)? Also the real idle dialog click.
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts authLogout
import { test } from '@playwright/test';
import { Credentials, ENV_NAME } from '../../portals.config';

test(`probe /auth/logout on ${ENV_NAME}`, async ({ page }) => {
  const login = async () => {
    await page.goto('/auth/login');
    await page.locator('#t_username').fill(Credentials.username);
    await page.locator('#t_password').fill(Credentials.password);
    await page.locator('#login_btn').click();
    await page.waitForURL(/\/console/, { timeout: 60_000 });
  };
  const nav: string[] = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) nav.push(f.url()); });
  await login();
  console.log('PROBE logoutForm', await page.evaluate(() => { const f = document.forms.namedItem('logoutForm'); return f ? `${f.method} ${f.getAttribute('action')}` : 'none'; }));
  nav.length = 0;
  const r = await page.goto('/auth/logout');
  console.log('PROBE GET /auth/logout status', r?.status(), 'chain', nav.join(' -> '));
  await page.goto('/company');
  console.log('PROBE then /company ->', new URL(page.url()).pathname, '| logged in:', await page.locator('a.btnLogout').isVisible());
  // the dialog's "No" with the real handlers (dialog opened by script, no clock)
  await page.goto('/console');
  nav.length = 0;
  await page.evaluate(() => (window as any).$('#dialog').dialog('open'));
  await page.locator('.btnNo').click();
  await page.waitForTimeout(4000);
  console.log('PROBE after No:', nav.join(' -> '), '| now', new URL(page.url()).pathname, '| logged in:', await page.locator('a.btnLogout').isVisible());
  await page.goto('/company');
  console.log('PROBE then /company ->', new URL(page.url()).pathname, '| logged in:', await page.locator('a.btnLogout').isVisible());
});
