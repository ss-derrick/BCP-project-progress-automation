import { expect, Locator, Page } from '@playwright/test';

// "Selected Company Section" two-list picker (jQuery multiselect2side), used
// on Upload Company Logo and Remove Company Logo:
//   left  "Please select" = available companies (option value = company id)
//   right "Selected"      = companies to apply the action to
//   buttons: › Add Selected, » Add All, ‹ Remove Selected, « Remove All
// NOTE: the first left option is pre-highlighted when the page opens.
export class CompanyPicker {
  readonly available: Locator;
  readonly selected: Locator;
  readonly addSelectedButton: Locator;

  constructor(private readonly page: Page) {
    this.available = page.locator('#selectedSnms2side__sx');
    this.selected = page.locator('#selectedSnms2side__dx');
    this.addSelectedButton = page.locator('.ms2side__options .AddOne');
  }

  async options(): Promise<{ id: string; name: string }[]> {
    // The page fills the list a moment after the step opens - wait for it
    await expect.poll(() => this.available.locator('option').count(), {
      message: 'The "Please select" company list should load',
      timeout: 30_000
    }).toBeGreaterThan(0);
    return this.available.locator('option').evaluateAll((os) =>
      os.map((o) => ({ id: (o as HTMLOptionElement).value, name: (o.textContent ?? '').trim() })));
  }

  // First company in the list (list order) whose name passes `accept`
  async firstCompany(accept: (name: string) => boolean, description: string): Promise<string> {
    const match = (await this.options()).find((o) => accept(o.name));
    if (!match) throw new Error(`No ${description} in the "Please select" list.`);
    return match.id;
  }

  // Newest company (highest id) whose name passes `accept`
  async newestCompany(accept: (name: string) => boolean, description: string): Promise<string> {
    const matches = (await this.options()).filter((o) => accept(o.name))
      .sort((a, b) => Number(b.id) - Number(a.id));
    if (!matches.length) throw new Error(`No ${description} in the "Please select" list.`);
    return matches[0].id;
  }

  // Move ONE company (by id) to the "Selected" list. Returns its name.
  async moveOne(companyId: string): Promise<string> {
    const option = this.available.locator(`option[value="${companyId}"]`);
    await expect(option, `Company ${companyId} is not in the "Please select" list`).toHaveCount(1);
    const name = (await option.innerText()).trim();

    // Click the option like a user: a plain click selects ONLY that option
    await option.scrollIntoViewIfNeeded();
    await option.click();
    await expect.poll(
      () => this.available.evaluate((s) =>
        Array.from((s as HTMLSelectElement).selectedOptions).map((o) => o.value)),
      { message: 'Only the chosen company should be highlighted before moving' }
    ).toEqual([companyId]);

    // "›" = Add Selected (moves only the highlighted company; "»" would move all)
    await this.addSelectedButton.click();

    await expect(this.selected.locator('option')).toHaveCount(1);
    await expect(this.selected.locator('option')).toHaveText(name);
    return name;
  }
}
