// Explore the APH login page: dump its elements. Browse only - no login.
//   npm run explore:aph -- explore/aph/login.explore.ts
// Output: test-results/explore-dumps/login-01.png + login-01.txt
import { test } from '@playwright/test';
import { LOGIN_PATH } from '../../common/config/testConfig';
import { dump } from './dump';

test('explore login page', async ({ page }) => {
  await page.goto(LOGIN_PATH);
  await page.waitForLoadState('networkidle').catch(() => {});
  await dump(page, 'login-01');
});
