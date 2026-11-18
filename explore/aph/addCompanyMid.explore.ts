// Explore MID Settings on "Add a Company": add MID rows and switch the
// Service Provider to see what each row needs. Fills the form in the
// browser only - Submit / Confirm are NEVER clicked, nothing is created.
//   npm run explore:aph -- explore/aph/addCompanyMid.explore.ts
import { test, Page } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { Credentials } from '../../common/config/testConfig';
import { dump, tryStep } from './dump';

// What is visible / enabled in MID row <n>
async function describeRow(page: Page, n: number): Promise<string> {
  return page.evaluate((i) => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const mid = document.querySelector(`[name="mid${i}"]`) as HTMLElement | null;
    if (!mid) return `row ${i}: NOT FOUND`;
    // the row container = nearest ancestor holding this row's service provider
    let box: HTMLElement | null = mid;
    while (box && !box.querySelector(`[name="serviceProvider${i}"]`)) box = box.parentElement;
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const controls = Array.from(box?.querySelectorAll('input,select') ?? [])
      .filter((e) => (e as HTMLInputElement).type !== 'hidden' && vis(e))
      .map((e) => {
        const el = e as HTMLInputElement;
        const lab = el.closest('label') ?? el.parentElement;
        return `${el.name || '(no name)'}[${el.type}${el.disabled ? ',disabled' : ''}${el.checked ? ',checked' : ''}]"${txt(lab).slice(0, 30)}"`;
      });
    return `row ${i}: container=<${box?.tagName.toLowerCase()} id=${box?.id} class=${box?.className}>\n  ` +
      controls.join('\n  ') + `\n  TEXT: ${txt(box).slice(0, 700)}`;
  }, n);
}

test('explore MID Settings rows', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login(Credentials.username, Credentials.password);
  await page.waitForURL(/\/console/);
  await page.goto('/company/register');
  await page.waitForLoadState('networkidle').catch(() => {});

  const midSection = page.locator('#step1').getByText('MID Settings', { exact: true });
  await midSection.scrollIntoViewIfNeeded();

  console.log('=== initial');
  console.log(await describeRow(page, 0));

  // Payment type labels next to the checkboxes in row 0
  const ptLabels = await page.evaluate(() => Array.from(document.querySelectorAll('[name$="Checkbox0"]'))
    .map((e) => `${(e as HTMLInputElement).name}: "${((e.closest('label') ?? e.parentElement)?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}" next="${(e.nextSibling?.textContent ?? '').trim().slice(0, 30)}"`));
  console.log('PAYMENT TYPES row0\n  ' + ptLabels.join('\n  '));

  // Add 2 more MID rows
  for (let i = 0; i < 2; i++) {
    await tryStep(`Add another MID #${i + 1}`, () => page.getByText('Add another MID', { exact: true }).click());
    await page.waitForTimeout(800);
  }
  const names = await page.evaluate(() => Array.from(document.querySelectorAll('[name^="mid"]')).map((e) => (e as HTMLInputElement).name));
  console.log('MID FIELDS NOW: ' + names.join(', '));

  // Switch row 1 -> Hong Leong Bank, row 2 -> AmBank, see what changes
  for (const [row, provider] of [[1, 'HLB'], [2, 'AMB']] as const) {
    await tryStep(`row ${row} provider ${provider}`, () => page.locator(`[name="serviceProvider${row}"]`).selectOption(provider));
    await page.waitForTimeout(800);
  }
  for (const i of [0, 1, 2]) console.log('=== after providers\n' + await describeRow(page, i));

  // Card scheme picker (chosen.js "Select Some Options") in row 0
  await tryStep('open card scheme picker row 0', async () => {
    await page.locator('[name="cardScheme0"]').locator('xpath=following-sibling::*[1]').click();
  });
  await page.waitForTimeout(500);
  const chosen = await page.evaluate(() => Array.from(document.querySelectorAll('.chosen-container, .chzn-container'))
    .map((c) => `<${c.tagName.toLowerCase()} id=${c.id} class=${c.className}> results=${Array.from(c.querySelectorAll('li')).map((l) => (l.textContent ?? '').trim()).filter(Boolean).slice(0, 12).join(' | ')}`));
  console.log('CARD SCHEME PICKERS\n  ' + chosen.join('\n  '));

  await midSection.scrollIntoViewIfNeeded();
  await dump(page, 'add-company-02-mid-rows');
  // Submit / Confirm intentionally not clicked
});
