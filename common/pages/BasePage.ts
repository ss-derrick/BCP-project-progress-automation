import { test, Page, Locator } from '@playwright/test';
import type { RunMode } from '../config/runMode';
import { RUN_MODE } from '../config/testConfig';

// Shared helpers for all page objects of every portal. Watch-mode speeds
// come from common/config/testConfig.ts (RUN_MODE).
export abstract class CommonBasePage {
  readonly page: Page;
  protected readonly runMode: RunMode;

  constructor(page: Page, runMode: RunMode = RUN_MODE) {
    this.page = page;
    this.runMode = runMode;
  }

  // Open a path relative to BASE_URL, e.g. goto('/auth/login')
  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }

  // Short pause between steps (DEMO mode only)
  protected async pause(duration: number = this.runMode.stepPause): Promise<void> {
    if (duration > 0) {
      await this.page.waitForTimeout(duration);
    }
  }

  // Smooth scroll so the viewer can follow along (DEMO mode only).
  // In FAST mode Playwright auto-scrolls before every action anyway.
  protected async scrollToElement(element: Locator): Promise<void> {
    if (!this.runMode.demoMode) return;

    // Scrolling is only for the viewer: never wait long for it. If the
    // page has already moved on (e.g. a redirect), just skip the scroll.
    try {
      await element.evaluate((el) => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }, undefined, { timeout: 5_000 });
    } catch {
      return;
    }

    await this.pause();
  }

  // Clear an input and type a value key by key,
  // so input masks / JS listeners on the page still fire
  protected async typeInto(
    input: Locator,
    value: string,
    options: { pressTab?: boolean } = {}
  ): Promise<void> {
    await input.click();
    await input.fill('');
    await input.pressSequentially(value, { delay: this.runMode.typingDelay });

    if (options.pressTab) {
      await input.press('Tab');
    }
  }

  // Full-page screenshot attached to the test. Shown in the Test Execution
  // Report as one of the test's screenshots, in the order they were taken.
  async captureScreen(label: string): Promise<void> {
    const body = await this.page.screenshot({ fullPage: true });
    await test.info().attach(`screen: ${label}`, { body, contentType: 'image/png' });
  }

  // Screenshot a fixed-height, internally scrolling box IN FULL (e.g. a
  // JSON / log panel). The box is stretched to fit, captured, then restored.
  async captureFullBox(box: Locator, label: string): Promise<void> {
    await this.scrollToElement(box);

    const original = await box.evaluate((el) => {
      const e = el as HTMLElement;
      const saved = { height: e.style.height, maxHeight: e.style.maxHeight, overflow: e.style.overflow };
      const border = e.offsetHeight - e.clientHeight;
      e.style.maxHeight = 'none';
      e.style.overflow = 'visible';
      e.style.height = `${e.scrollHeight + border}px`;
      return saved;
    });

    try {
      const body = await box.screenshot();
      await test.info().attach(`screen: ${label}`, { body, contentType: 'image/png' });
    } finally {
      await box.evaluate((el, saved) => {
        const e = el as HTMLElement;
        e.style.height = saved.height;
        e.style.maxHeight = saved.maxHeight;
        e.style.overflow = saved.overflow;
      }, original);
    }
  }

  // Keep the current page open for observation (DEMO mode only)
  async holdForViewing(pageName: string, duration: number = this.runMode.viewPage): Promise<void> {
    if (!this.runMode.demoMode || duration <= 0) return;
    console.log(`Keeping ${pageName} open for ${duration / 1000} seconds...`);
    await this.page.waitForTimeout(duration);
  }
}


// Page objects extend BasePage
export { CommonBasePage as BasePage };
