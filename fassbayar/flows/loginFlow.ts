import { test } from '@playwright/test';
import { Credentials } from '../../common/config/testConfig';
import { LoginPage } from '../../common/pages/LoginPage';

// Open the portal and log in as the user from .env
// (login page steps are shared: common/pages/LoginPage.ts)
export async function loginAsAdmin(loginPage: LoginPage): Promise<void> {
  await test.step('Login to FassBayar portal', async () => {
    await loginPage.open();
    await loginPage.login(Credentials.username, Credentials.password);
    await loginPage.verifyLoggedIn();
  });
}
