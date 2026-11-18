// Explore the APH page shown right after login: dump its elements.
// Logs in ONCE with the .env account, changes nothing.
//   npm run explore:aph -- explore/aph/afterLogin.explore.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { Credentials } from '../../common/config/testConfig';
import { dump } from './dump';

test('explore page after login', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login(Credentials.username, Credentials.password);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await dump(page, 'after-login-01');
});
