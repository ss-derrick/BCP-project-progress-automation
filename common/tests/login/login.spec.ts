import { test } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { TEST_ID_PREFIX } from '../../../portals.config';

// APH System Portal - Login
// Uses the account in .env. Positive path only: no wrong-password tests
// against this account, so it doesn't get locked.
test.describe('Login', () => {

  test(
    'Login with valid User ID and Password',
    testCase({
      id: `${TEST_ID_PREFIX}-001`, module: 'Login', priority: 'High',
      gaps: [{
        description: 'Only a valid login is tested. Wrong password, locked account, password expiry and the one-session-per-user logout are not automated.',
        impact: 'A login-error or lock-out defect would not be caught. Not automated on purpose: failed logins could lock the shared test account.'
      }]
    }),
    async ({ loginPage, consolePage }) => {

      await loginAs({ loginPage, consolePage });

      await test.step('Log out', async () => {
        await consolePage.logout();
        await loginPage.verifyLoginPage();
        await loginPage.captureScreen('Back on login page after logout');
      });
    }
  );
});
