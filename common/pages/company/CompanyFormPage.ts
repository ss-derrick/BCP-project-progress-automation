import { Page, Locator, expect } from '@playwright/test';
import { CommonBasePage } from '../BasePage';
import type { RunMode } from '../../config/runMode';
import type { PortalProfile } from '../../config/portals';
import { RUN_MODE, PORTAL_PROFILE, Timeouts } from '../../config/testConfig';
import type { BusinessAndAuthoriser } from '../../creation/companyData';

// What the "Complete" step shows after a company is created
export interface CreatedCompany {
  userId: string;
  mid: string;             // 'N/A' for a parent company
  businessName: string;
  itemId: string;          // internal id used by ...Details?itemid=
}

// Shared by "Add a Company" and "Add a Parent Company" on EVERY portal
// (same field ids on APH and FassBayar, checked 18 Nov 2026):
//   - Business Details + Authoriser Details
//   - 3-step wizard inside one form:
//       #step1 Company Details -> [Submit]  (a#1.next)   validates, slides to step 2
//       #step2 Review & Confirm -> [Confirm] (#submitThis) = CREATES the company
//       Complete page "...has been successfully added to the system"
export abstract class CommonCompanyFormPage extends CommonBasePage {
  protected readonly portal: PortalProfile;
  protected readonly pageLoadTimeout: number;

  // ---- Business Details
  readonly businessName: Locator;
  readonly businessShortName: Locator;
  readonly brn: Locator;
  readonly sst: Locator;                  // FassBayar only
  readonly tin: Locator;                  // FassBayar only
  readonly address1: Locator;
  readonly address2: Locator;
  readonly postcode: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly businessContact: Locator;

  // ---- Authoriser Details
  readonly salutation: Locator;
  readonly fullName: Locator;
  readonly mobilePrefix: Locator;
  readonly mobileBody: Locator;
  readonly email: Locator;
  readonly userIdPrefix: Locator;

  // ---- Wizard
  readonly step1: Locator;
  readonly step2: Locator;
  readonly submitButton: Locator;
  readonly backButton: Locator;
  readonly confirmButton: Locator;
  // Field validation bubbles, e.g. "Please enter valid City",
  // "Please choose one payment type", "Invalid payment type"
  readonly validationErrors: Locator;
  readonly successMessage: Locator;
  // Complete page when the server refused: "Your request is unsuccessful"
  readonly failureMessage: Locator;
  readonly failureDetails: Locator;
  readonly viewCompanyDetailsButton: Locator;

  // Defaults: the portal of this run (ENV_NAME) and its speeds / timeouts
  constructor(
    page: Page,
    runMode: RunMode = RUN_MODE,
    portal: PortalProfile = PORTAL_PROFILE,
    pageLoadTimeout: number = Timeouts.pageLoad
  ) {
    super(page, runMode);
    this.portal = portal;
    this.pageLoadTimeout = pageLoadTimeout;

    this.businessName = page.locator('#businessName');
    this.businessShortName = page.locator('#businessShortName');
    this.brn = page.locator('#businessRegistrationNo');
    this.sst = page.locator('#businessSST');
    this.tin = page.locator('#businessTIN');
    this.address1 = page.locator('#address1');
    this.address2 = page.locator('#address2');
    this.postcode = page.locator('#postcode');
    this.city = page.locator('#city');
    this.state = page.locator('#state');
    this.businessContact = page.locator('#businessContact');

    this.salutation = page.locator('#salutation');
    this.fullName = page.locator('#fullName');
    this.mobilePrefix = page.locator('#contact_prefix');
    this.mobileBody = page.locator('#contact_body');
    this.email = page.locator('#email');
    this.userIdPrefix = page.locator('#partnerPrefix');

    this.step1 = page.locator('#step1');
    this.step2 = page.locator('#step2');
    this.submitButton = page.locator('a.next[id="1"]');
    this.backButton = page.locator('a.prev[id="2"]');
    this.confirmButton = page.locator('#submitThis');
    this.validationErrors = this.step1.getByText(/^\s*(Please (enter|choose|select)|Invalid|Duplicated)/).filter({ visible: true });
    this.successMessage = page.getByText('has been successfully added to the system');
    this.failureMessage = page.getByText('Your request is unsuccessful');
    this.failureDetails = page.locator('xpath=//*[normalize-space(text())="Error Code"]/following-sibling::*[1]').first();
    this.viewCompanyDetailsButton = page
      .locator('a[href*="itemid="]').filter({ hasText: /View Company\s*Details/ });
  }

  // Type a value like a user (key by key, then Tab: the page checks a field
  // when it loses focus) and make sure the field kept ALL of it - a
  // maxlength would silently cut it off.
  protected async fill(input: Locator, value: string): Promise<void> {
    await this.scrollToElement(input);
    await this.typeInto(input, value, { pressTab: true });
    const maxLength = await input.getAttribute('maxlength');
    await expect(
      input,
      `Field "${await input.getAttribute('name')}" did not keep the full value ` +
      `"${value}" (${value.length} chars, maxlength=${maxLength ?? 'none'})`
    ).toHaveValue(value);
  }

  // Fails with a clear message when the data has a section this portal lacks
  protected requireSection(has: boolean, section: string): void {
    if (!has) {
      throw new Error(`${section} is not on the ${this.portal.name} form - ` +
        'leave it out of the test data (see common/config/portals.ts)');
    }
  }

  // ---------- Step 1 ----------

  async fillBusinessDetails(data: BusinessAndAuthoriser): Promise<void> {
    await this.fill(this.businessName, data.businessName);
    await this.fill(this.businessShortName, data.businessShortName);
    await this.fill(this.brn, data.brn);
    if (data.sst !== undefined || data.tin !== undefined) {
      this.requireSection(this.portal.sstTin, 'SST / TIN');
      if (data.sst !== undefined) await this.fill(this.sst, data.sst);
      if (data.tin !== undefined) await this.fill(this.tin, data.tin);
    }
    await this.fill(this.address1, data.address1);
    if (data.address2) await this.fill(this.address2, data.address2);
    await this.fill(this.postcode, data.postcode);
    await this.fill(this.city, data.city);
    await this.state.selectOption(data.state);
    await this.fill(this.businessContact, data.businessContact);
  }

  async fillAuthoriserDetails(data: BusinessAndAuthoriser): Promise<void> {
    await this.salutation.selectOption(data.salutation);
    await this.fill(this.fullName, data.fullName);
    // These boxes hold hint text ("01X", "1234567") as a real value;
    // typeInto() clears it first
    await this.fill(this.mobilePrefix, data.mobilePrefix);
    await this.fill(this.mobileBody, data.mobileBody);
    await this.fill(this.email, data.email);
    await this.fill(this.userIdPrefix, data.userIdPrefix);
  }

  // Step 1 -> Step 2 (Review & Confirm). Does NOT create anything.
  // Step 2 sits beside step 1 in a slider, so the Confirm button must come
  // into the viewport (it is "visible" to Playwright even before Submit).
  async submitCompanyDetails(): Promise<void> {
    await this.scrollToElement(this.submitButton);
    await this.submitButton.click();
    try {
      await expect(this.confirmButton).toBeInViewport({ timeout: 15_000 });
    } catch {
      // Name the fields the form complained about ("Please enter valid City")
      const errors = await this.validationErrors.allInnerTexts();
      await this.captureScreen('Validation errors');
      throw new Error(
        'Review & Confirm step did not open. Form validation errors: ' +
        (errors.length ? errors.map((e) => `"${e.trim()}"`).join(', ') : '(none shown)')
      );
    }
  }

  // ---------- Step 2 ----------

  // Review & Confirm shows each of these values
  async verifyReview(values: (string | RegExp)[]): Promise<void> {
    for (const value of values) {
      await expect(this.step2, `Review page should show "${value}"`).toContainText(value);
    }
    await this.captureScreen('Review & Confirm');
  }

  // Confirm = CREATES the company on the environment
  async confirm(): Promise<void> {
    await this.scrollToElement(this.confirmButton);
    await this.confirmButton.click();
    // Saving can be slow on UAT: the page blanks out while the server works
    try {
      await this.page.waitForURL(/\/company\/doCreate/, { timeout: this.pageLoadTimeout * 2 });
    } catch {
      throw new Error(
        `Server did not respond within ${this.pageLoadTimeout * 2 / 1000}s after Confirm ` +
        '(page stayed on Review & Confirm) - the company was probably NOT created'
      );
    }
  }

  // ---------- Step 3: Complete ----------

  async readCreatedCompany(): Promise<CreatedCompany> {
    // Either "successfully added" or "Your request is unsuccessful" + Error Code
    await expect(this.successMessage.or(this.failureMessage)).toBeVisible({ timeout: this.pageLoadTimeout });
    if (await this.failureMessage.isVisible()) {
      await this.captureScreen('Complete - request unsuccessful');
      const code = (await this.failureDetails.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      throw new Error(`Portal refused the request (nothing was created): ${code || 'no error code shown'}`);
    }
    await this.captureScreen('Complete - company added');

    const value = (label: string) =>
      this.page.locator(`xpath=//*[normalize-space(text())="${label}"]/following-sibling::*[1]`)
        .first().innerText().then((t) => t.trim());

    const href = await this.viewCompanyDetailsButton.getAttribute('href');

    return {
      userId: await value('Authoriser User ID'),
      mid: await value('MID'),
      businessName: await value('Business Name'),
      itemId: href?.match(/itemid=(\d+)/)?.[1] ?? ''
    };
  }

  async openCompanyDetails(): Promise<void> {
    await this.viewCompanyDetailsButton.click();
    await this.page.waitForURL(/Details\?itemid=\d+/, { timeout: this.pageLoadTimeout });
  }
}

export { CommonCompanyFormPage as CompanyFormPage };
