import { test, Page, Locator } from '@playwright/test';
import { DEMO_MODE, Demo } from '../../portals.config';
import { markedScreenshot } from '../utils/screenMarks';

// Shared helpers for all page objects. Every page class extends this.
export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Open a path relative to BASE_URL, e.g. goto('/login')
  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }

  // Short pause between steps (DEMO mode only)
  protected async pause(
    duration: number = Demo.stepPause
  ): Promise<void> {
    if (duration > 0) {
      await this.page.waitForTimeout(duration);
    }
  }

  // Smooth scroll so the viewer can follow along (DEMO mode only).
  // In FAST mode Playwright auto-scrolls before every action anyway.
  protected async scrollToElement(element: Locator): Promise<void> {
    if (!DEMO_MODE) return;

    // Scrolling is only for the viewer: never wait long for it. If the
    // page has already moved on (e.g. a redirect), just skip the scroll.
    try {
      await element.evaluate((el) => {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
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

    await input.pressSequentially(value, {
      delay: Demo.typingDelay
    });

    if (options.pressTab) {
      await input.press('Tab');
    }
  }

  // Take a full-page screenshot of the current screen and attach it to
  // the test. Shown in the Test Execution Report as one of the test's
  // screenshots, in the order they were taken.
  async captureScreen(label: string): Promise<void> {
    // caption bar + error messages boxed in red (common/utils/screenMarks.ts)
    const body = await markedScreenshot(this.page, { caption: label }, true);
    if (!body) return;

    await test.info().attach(`screen: ${label}`, {
      body,
      contentType: 'image/png'
    });
  }

  // Automatic screenshot of a step (every new screen, every Submit result). JPEG so a full run's
  // report stays small enough to open and share; captureScreen() above stays PNG.
  // Off for one run: $env:STEP_SCREENSHOTS='false'
  async captureStep(label: string): Promise<void> {
    if (process.env.STEP_SCREENSHOTS === 'false') return;
    const body = await markedScreenshot(this.page, { caption: label });
    if (body) await test.info().attach(`screen: ${label}`, { body, contentType: 'image/jpeg' });
  }

  // Screenshot a scrolling box IN FULL (e.g. a JSON / log panel with a
  // fixed height). The box is stretched to fit all its content,
  // captured, then put back.
  async captureFullBox(box: Locator, label: string): Promise<void> {

    await this.scrollToElement(box);

    const original = await box.evaluate((el) => {
      const e = el as HTMLElement;
      const saved = {
        height: e.style.height,
        maxHeight: e.style.maxHeight,
        overflow: e.style.overflow
      };
      const border = e.offsetHeight - e.clientHeight;
      e.style.maxHeight = 'none';
      e.style.overflow = 'visible';
      e.style.height = `${e.scrollHeight + border}px`;
      return saved;
    });

    try {
      const body = await box.screenshot();
      await test.info().attach(`screen: ${label}`, {
        body,
        contentType: 'image/png'
      });
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
  async holdForViewing(
    pageName: string,
    duration: number = Demo.viewPage
  ): Promise<void> {
    if (!DEMO_MODE || duration <= 0) return;

    console.log(
      `Keeping ${pageName} open for ${duration / 1000} seconds...`
    );

    await this.page.waitForTimeout(duration);
  }
}
