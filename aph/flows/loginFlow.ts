import { test } from '@playwright/test';
import type { LoginPage } from '../../common/pages/LoginPage';
import type { ConsolePage } from '../pages/ConsolePage';
import { Credentials, ENV_NAME } from '../../common/config/testConfig';

// Flows = multi-page journeys that many specs share. Each flow wraps its
// page calls in test.step() so the report shows readable steps.

// Log in with the .env account (or the one given) and land on the Console
export async function loginAs(
  pages: { loginPage: LoginPage; consolePage: ConsolePage },
  username: string = Credentials.username,
  password: string = Credentials.password
): Promise<void> {
  if (!username || !password) {
    throw new Error(
      `HUMAN ACTION REQUIRED: no login account for ${ENV_NAME}. Fill in its ` +
      'USERNAME and PASSWORD lines in the .env file (see .env.example).'
    );
  }

  await test.step(`Log in as ${username}`, async () => {
    await pages.loginPage.open();
    await pages.loginPage.verifyLoginPage();
    await pages.loginPage.login(username, password);
    await pages.consolePage.verifyLoggedIn();
  });
}
