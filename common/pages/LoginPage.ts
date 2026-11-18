import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { LOGIN_PATH, Timeouts } from '../../portals.config';

// System Portal - Login page (/auth/login). Same page on APH and Fassbayar.
// Holds both projects' methods:
//   APH:       open(), verifyLoginPage(), login()      (+ ConsolePage.verifyLoggedIn)
//   Fassbayar: goto(),  login(), verifyLoggedIn()
export class LoginPage extends BasePage {

  readonly title: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    this.title = page.getByText('System Portal Login');
    this.usernameInput = page.locator('#t_username');
    this.passwordInput = page.locator('#t_password');
    // "Submit" is an <a> link styled as a button, not a <button>
    this.submitButton = page.locator('#login_btn');
  }

  // (APH) open the login page
  async open(): Promise<void> {
    await super.goto(LOGIN_PATH);
  }

  // (Fassbayar team) open the portal root, wait for the login form
  override async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.usernameInput).toBeVisible({ timeout: Timeouts.pageLoad });
    await this.captureScreen('Login page');
  }

  async verifyLoginPage(): Promise<void> {
    await expect(this.title).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async login(username: string, password: string): Promise<void> {
    await this.typeInto(this.usernameInput, username);
    // fill (not typed key by key) so the password never shows in slow-motion runs
    await this.passwordInput.fill(password);
    await this.captureScreen('Login form filled');
    await this.submitButton.click();
  }

  // (Fassbayar team) login accepted: on the Console, not back on the login page
  async verifyLoggedIn(): Promise<void> {
    await this.page.waitForURL(/\/(console|auth\/login\?error)/, { timeout: Timeouts.pageLoad });
    expect(
      this.page.url(),
      'Login rejected - check the USERNAME / PASSWORD of this environment in .env'
    ).not.toContain('error=');
    await expect(this.page.locator('a.btnLogout')).toBeVisible();
    await this.captureScreen('Home - logged in');
  }
}
