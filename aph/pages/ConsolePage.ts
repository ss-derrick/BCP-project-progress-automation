import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';

// APH System Portal - Console (landing page after login, /console)
// Locators taken from explore/afterLogin.explore.ts (17 Nov 2026).
export class ConsolePage extends BasePage {

  readonly logoutButton: Locator;
  readonly lastLogin: Locator;
  readonly topMenu: Locator;

  constructor(page: Page) {
    super(page);

    // Note: the portal re-uses id "login_btn" for LOGOUT on this page,
    // so the class is included to be sure it is the logout link
    this.logoutButton = page.locator('#login_btn.btnLogout');
    this.lastLogin = page.locator('#lastLogin');
    this.topMenu = page.locator('#topNavi');
  }

  async verifyLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL(/\/console/);
    await expect(this.logoutButton).toBeVisible();
    await expect(this.lastLogin).toContainText('Your last log in was');
    await this.captureScreen('Console after login');
  }

  // Left-side links on the console, e.g. 'Company Summary', 'Audit Trail'
  menuLink(name: string): Locator {
    return this.page.locator('#barPadding').getByRole('link', { name, exact: true });
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
