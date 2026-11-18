import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import type { HostProfile } from '../hosts';
import type { NewHostCompany } from '../creation/hostCompanyData';

// System Portal - "Add a Company" (All Companies > Quicklinks > Add a Company,
// /company/register). SHARED by every portal: the 28 fields both portals have
// (read-only scan of 18 Nov 2026, explore/scan/results/).
//
// What only one portal has goes in its override, which extends this class:
//   aph/pages/AphAddCompanyFormPage.ts           Host Swing Priority (MID row)
//   fassbayar/pages/FassbayarAddCompanyFormPage.ts  DBA (MID row)
// The fixture in common/fixtures/portal.ts hands tests the right one.
//
// 2-step slider inside one form (#customForm):
//   #step1 form -> [Submit] validates and slides -> #step2 review -> [Confirm] = CREATES the company
export class AddCompanyFormPage extends BasePage {

  readonly quicklink: Locator;
  readonly step1: Locator;
  readonly step2: Locator;
  readonly submitButton: Locator;
  readonly confirmButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.quicklink = page.locator('#leftPanel').getByRole('link', { name: 'Add a Company', exact: true });
    this.step1 = page.locator('#step1');
    this.step2 = page.locator('#step2');
    this.submitButton = page.locator('a[id="1"].next');
    this.confirmButton = page.locator('#submitThis');
    this.successMessage = page.getByText('has been successfully added to the system');
  }

  // ---------- open ----------

  // From any All Companies page (the Quicklinks panel is on all of them)
  // A click made while the list page is still loading can be lost (seen on
  // APH, 18 Nov 2026): wait for the page, and click again if it didn't open.
  async open(): Promise<void> {
    await this.page.waitForLoadState('load');
    await expect(async () => {
      if (!/\/company\/register/.test(this.page.url())) await this.quicklink.click();
      await expect(this.page).toHaveURL(/\/company\/register/, { timeout: 10_000 });
    }, 'Quicklinks > Add a Company opens /company/register').toPass({ timeout: 45_000 });
    await expect(this.page.locator('#businessName')).toBeVisible();
    await this.page.waitForLoadState('load');
  }

  // ---------- step 1: shared fields ----------

  // Each field is left with Tab, like a user: the page validates a field when
  // it changes / loses focus, and Submit relies on that.
  async fillBusinessDetails(d: NewHostCompany['business']): Promise<void> {
    await this.typeInto(this.page.locator('#businessName'), d.businessName, { pressTab: true });
    await this.typeInto(this.page.locator('#businessShortName'), d.businessShortName, { pressTab: true });
    await this.typeInto(this.page.locator('#businessRegistrationNo'), d.registrationNo, { pressTab: true });
    await this.typeInto(this.page.locator('#address1'), d.address1, { pressTab: true });
    if (d.address2) await this.typeInto(this.page.locator('#address2'), d.address2, { pressTab: true });
    await this.typeInto(this.page.locator('#postcode'), d.postcode, { pressTab: true });
    await this.typeInto(this.page.locator('#city'), d.city, { pressTab: true });
    await this.page.locator('#state').selectOption(d.state);
    await this.typeInto(this.page.locator('#businessContact'), d.businessContact, { pressTab: true });
  }

  async fillAuthoriserDetails(d: NewHostCompany['authoriser']): Promise<void> {
    await this.page.locator('#salutation').selectOption(d.salutation);
    await this.typeInto(this.page.locator('#fullName'), d.fullName, { pressTab: true });
    // These boxes hold hint text ("01X", "1234567", "john.doe@gmail.com") as a real value
    await this.typeInto(this.page.locator('#contact_prefix'), d.contactPrefix, { pressTab: true });
    await this.typeInto(this.page.locator('#contact_body'), d.contactBody, { pressTab: true });
    await this.typeInto(this.page.locator('#email'), d.email, { pressTab: true });
    if (d.userIdPrefix) {
      await this.typeInto(this.page.locator('#partnerPrefix'), d.userIdPrefix, { pressTab: true });
    }
  }

  midRow(n: number): Locator {
    return this.step1.locator(`#paymentOption${n}`);
  }

  // MID row 0 for one host: MID, Service Provider, card schemes, payment types,
  // then the portal's own MID-row fields (override hook below).
  async fillMid(data: NewHostCompany): Promise<void> {
    const n = 0, row = this.midRow(n), host = data.host;

    await this.typeInto(row.locator(`[name="mid${n}"]`), data.mid, { pressTab: true });
    await this.selectHost(row, n, host);

    for (const scheme of data.cardSchemes) {
      await this.chooseCardScheme(row, n, scheme);
    }

    for (const type of data.paymentTypes) {
      const box = row.locator(`[name="${type}Checkbox${n}"]`);
      await expect(box, `Payment type "${type}" should be enabled for ${host.name}`).toBeEnabled();
      await box.check();
    }

    await this.fillPortalMidFields(row, n, data);

    await this.scrollToElement(row);
    await this.captureScreen(`MID: ${data.mid} (${host.name})`);
  }

  // OVERRIDE in the portal page for MID-row fields only that portal has
  protected async fillPortalMidFields(_row: Locator, _n: number, _data: NewHostCompany): Promise<void> {
    // nothing on the shared form
  }

  // OVERRIDE in the portal page for company fields only that portal has
  // (e.g. Fassbayar: SST, TIN, bank, MCC, references)
  protected async fillPortalCompanyFields(_data: NewHostCompany): Promise<void> {
    // nothing on the shared form
  }

  // OVERRIDE in the portal page to check those fields on the review step
  protected async verifyPortalReview(_data: NewHostCompany): Promise<void> {
    // nothing on the shared form
  }

  // ---------- payment types (validation) ----------

  // Every payment-type box shown on MID row <n>: enabled? ticked?
  async readPaymentTypes(n = 0): Promise<Record<string, { enabled: boolean; checked: boolean }>> {
    return this.midRow(n).locator(`input[type="checkbox"][name$="Checkbox${n}"]`).evaluateAll((boxes, row) => {
      const out: Record<string, { enabled: boolean; checked: boolean }> = {};
      for (const b of boxes as HTMLInputElement[]) {
        if (!(b.offsetWidth || b.offsetHeight)) continue;            // hidden on this portal
        out[b.name.replace(new RegExp(`Checkbox${row}$`), '')] = { enabled: !b.disabled, checked: b.checked };
      }
      return out;
    }, n);
  }

  async setPaymentType(type: string, on: boolean, n = 0): Promise<void> {
    await this.midRow(n).locator(`[name="${type}Checkbox${n}"]`).setChecked(on);
    await this.page.waitForTimeout(300);   // the page enables / disables the others on change
  }

  // ---------- card schemes (validation) ----------

  // Card schemes the picker on MID row <n> offers right now (the real <select>'s options)
  async cardSchemeOptions(n = 0): Promise<string[]> {
    const options = this.midRow(n).locator(`select[name="cardScheme${n}"] option`);
    return (await options.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  }

  // Open the card scheme list on MID row <n>, screenshot it, close it again
  async captureCardSchemeList(label: string, n = 0): Promise<void> {
    const row = this.midRow(n);
    await row.locator('.chosen-container input.chosen-search-input').click();
    await expect(row.locator('.chosen-results li').first()).toBeVisible();
    await this.captureScreen(label);
    await this.page.keyboard.press('Escape');
  }

  // Review step: MID Settings shows exactly these schemes, e.g. "Card Scheme : HSBC VISA"
  // (exact, so "VISA" does not pass on a review showing "HSBC VISA")
  async verifyReviewCardSchemes(schemes: string[]): Promise<void> {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(this.step2).toContainText(new RegExp(
      `Card Scheme\\s*:\\s*${schemes.map(esc).join('[,\\s]+')}\\s*Payment Type`
    ));
  }

  // Choose the host on MID row <n> (no MID, nothing else filled)
  async chooseHost(host: HostProfile, n = 0): Promise<void> {
    await this.selectHost(this.midRow(n), n, host);
  }

  // Choosing a Service Provider reloads the row's card schemes and payment
  // types in the background; that sometimes never happens (seen by the
  // Fassbayar team) -> pick another provider and this one again until it does.
  private async selectHost(row: Locator, n: number, host: HostProfile): Promise<void> {
    const provider = row.locator(`[name="serviceProvider${n}"]`);
    const schemeOptions = row.locator(`select[name="cardScheme${n}"] option`);
    let attempt = 0;
    await expect(async () => {
      if (attempt++ > 0) {
        await provider.selectOption({ index: 0 });
        await this.page.waitForTimeout(1_000);
      }
      await provider.selectOption(host.code);
      await this.page.waitForLoadState('networkidle').catch(() => {});
      if (host.onlyTheseSchemes) {
        // filtered list: exactly this host's schemes must be offered
        await expect(schemeOptions).toHaveText(host.cardSchemes, { timeout: 5_000 });
      }
      for (const type of host.paymentTypes) {
        await expect(row.locator(`[name="${type}Checkbox${n}"]`)).toBeEnabled({ timeout: 5_000 });
      }
    }, `Service Provider ${host.name} loads its card schemes / payment types`).toPass({ timeout: 60_000 });
  }

  // Card Scheme = jQuery "chosen" multi-select: type the scheme, wait until it
  // is highlighted, press Enter, then check the real <select> has it.
  private async chooseCardScheme(row: Locator, n: number, scheme: string): Promise<void> {
    const search = row.locator('.chosen-container input.chosen-search-input');
    const highlighted = row.locator('.chosen-results li.highlighted');
    await expect(async () => {
      await search.click();
      await search.fill('');
      await search.pressSequentially(scheme, { delay: 50 });
      await expect(highlighted).toHaveText(scheme, { timeout: 2_000 });
    }, `Find card scheme "${scheme}" in MID row ${n}`).toPass({ timeout: 20_000 });
    await search.press('Enter');
    await expect(
      row.locator(`select[name="cardScheme${n}"] option:checked`).filter({ hasText: new RegExp(`^\\s*${scheme}\\s*$`) }),
      `Card scheme "${scheme}" selected in MID row ${n}`
    ).toHaveCount(1);
  }

  // Fill everything for one host company (step 1)
  async fillCompany(data: NewHostCompany): Promise<void> {
    await this.fillBusinessDetails(data.business);
    await this.fillAuthoriserDetails(data.authoriser);
    await this.fillPortalCompanyFields(data);
    await this.captureScreen('Business and Authoriser details filled');
    await this.fillMid(data);
  }

  // Green "Please enter valid ..." messages currently shown on the form
  async visibleErrors(): Promise<string[]> {
    const errors = this.step1.getByText(/^\s*Please enter (a )?valid/);
    const out: string[] = [];
    for (let i = 0; i < await errors.count(); i++) {
      if (await errors.nth(i).isVisible()) out.push((await errors.nth(i).innerText()).trim());
    }
    return out;
  }

  // Submit = validate + slide to the review step. Does NOT create anything.
  // Step 2 sits beside step 1 in a slider: Confirm must come into the viewport.
  async submit(): Promise<void> {
    await this.scrollToElement(this.submitButton);
    await this.submitButton.click();
    await this.page.waitForTimeout(1_000);
    expect(await this.visibleErrors(), 'Form validation errors after Submit').toEqual([]);
    await this.confirmButton.scrollIntoViewIfNeeded();
    await expect(this.confirmButton).toBeInViewport();
  }

  // Submit when the form SHOULD refuse it: the review step must not open.
  // (Submit asks the server POST /company/checkItemsAvailability; a taken MID
  // is answered with "Duplicated. Not Available" and the form stays on step 1.)
  readonly duplicateMessage = this.page.getByText('Duplicated. Not Available');

  // Waits for the server's availability answer; a Submit click that never
  // reached the server (seen once on APH, 18 Nov 2026) is clicked again.
  async submitExpectingRejection(): Promise<void> {
    await this.scrollToElement(this.submitButton);
    await expect(async () => {
      const answer = this.page.waitForResponse((r) => r.url().includes('/company/checkItemsAvailability'), { timeout: 20_000 });
      await this.submitButton.click();
      await answer;
    }, 'Submit sends the availability check to the server').toPass({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1_000);
    await expect(this.confirmButton, 'Review step must NOT open').not.toBeInViewport();
  }

  // ---------- step 2: review ----------

  // "Merchant ID (MID) : <mid> Service Provider : <host> Status : Enabled Card Scheme : ..."
  async verifyReview(data: NewHostCompany): Promise<void> {
    await expect(this.step2).toContainText(data.business.businessName);
    await expect(this.step2).toContainText(data.business.registrationNo);
    await expect(this.step2).toContainText(data.authoriser.fullName);
    await expect(this.step2).toContainText(data.authoriser.email);
    await expect(this.step2).toContainText(new RegExp(
      `Merchant ID \\(MID\\)\\s*:\\s*${data.mid}\\s*Service Provider\\s*:\\s*${data.host.name}`
    ));
    for (const scheme of data.cardSchemes) {
      await expect(this.step2).toContainText(scheme);
    }
    await this.verifyPortalReview(data);
    await this.captureScreen('Review before Confirm');
  }

  // ---------- step 3: confirm = CREATES the company ----------

  async confirm(): Promise<void> {
    await this.scrollToElement(this.confirmButton);
    await this.confirmButton.click();
    await expect(this.successMessage).toBeVisible({ timeout: 120_000 });
    await this.captureScreen('Complete - company added');
  }

  // The new company is in the list with its MID shown as <mid><host suffix>
  async verifyListed(data: NewHostCompany): Promise<void> {
    await this.page.goto(`/company/search?search=${encodeURIComponent(data.business.businessName)}`);
    const row = this.page.locator('#dataRow tr.dataListMid').filter({ hasText: data.business.businessName });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(`${data.mid}${data.host.midSuffix}`);
    await this.captureScreen('New company in the company list');
  }
}
