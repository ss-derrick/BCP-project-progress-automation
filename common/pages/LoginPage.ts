import { Page, Locator, expect } from '@playwright/test';
import { CommonBasePage } from './BasePage';
import { LoginLocators } from '../locators/login';
import type { RunMode } from '../config/runMode';
import { RUN_MODE } from '../config/testConfig';

// Soft Space System Portal - Login page (/auth/login), shared by every
// BCP portal. A portal can extend this if its login ever differs.
export class CommonLoginPage extends CommonBasePage {
  readonly title: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page, runMode: RunMode = RUN_MODE) {
    super(page, runMode);
    this.title = page.getByText(LoginLocators.title);
    this.usernameInput = page.locator(LoginLocators.username);
    this.passwordInput = page.locator(LoginLocators.password);
    this.submitButton = page.locator(LoginLocators.submit);
    this.logoutButton = page.locator(LoginLocators.logout);
  }

  async open(): Promise<void> {
    await this.goto(LoginLocators.path);
    await expect(this.usernameInput).toBeVisible();
    await this.captureScreen('Login page');
  }

  async verifyLoginPage(): Promise<void> {
    await expect(this.title).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  // The password is filled in one go (not typed key by key) and only shows
  // as dots in the screenshot.
  async login(username: string, password: string): Promise<void> {
    await this.typeInto(this.usernameInput, username);
    await this.passwordInput.fill(password);
    await this.captureScreen('Login form filled');
    await this.submitButton.click();
  }

  // Logged in = left the login page without an error, LOGOUT is shown
  async verifyLoggedIn(): Promise<void> {
    await expect(
      this.page,
      'Login rejected - check the user ID / password in this project\'s .env'
    ).not.toHaveURL(LoginLocators.loginErrorUrl);
    await expect(this.logoutButton).toBeVisible();
    await this.captureScreen('Home - logged in');
  }
}

export { CommonLoginPage as LoginPage };
