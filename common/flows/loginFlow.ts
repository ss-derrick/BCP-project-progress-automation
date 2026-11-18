import { test } from '@playwright/test';
import type { LoginPage } from '../pages/LoginPage';
import type { ConsolePage } from '../pages/ConsolePage';
import { Credentials, ENV_NAME } from '../../portals.config';

// Flows = multi-page journeys that many specs share. Each flow wraps its
// page calls in test.step() so the report shows readable steps.
// Both log in with the account of the environment chosen by ENV_NAME (.env).

// (APH) Log in and land on the Console
export async function loginAs(
  pages: { loginPage: LoginPage; consolePage: ConsolePage },
  username: string = Credentials.username,
  password: string = Credentials.password
): Promise<void> {
  requireAccount(username, password);

  await test.step(`Log in as ${username}`, async () => {
    await pages.loginPage.open();
    await pages.loginPage.verifyLoginPage();
    await pages.loginPage.login(username, password);
    await pages.consolePage.verifyLoggedIn();
  });
}

// (Fassbayar team) Open the portal and log in as the admin user
export async function loginAsAdmin(loginPage: LoginPage): Promise<void> {
  requireAccount(Credentials.username, Credentials.password);

  await test.step('Login to admin portal', async () => {
    await loginPage.goto();
    await loginPage.login(Credentials.username, Credentials.password);
    await loginPage.verifyLoggedIn();
  });
}

function requireAccount(username: string, password: string): void {
  if (!username || !password) {
    throw new Error(
      `HUMAN ACTION REQUIRED: no login account for ${ENV_NAME}. Fill in its ` +
      'USERNAME and PASSWORD lines in the .env file (see .env.example).'
    );
  }
}
