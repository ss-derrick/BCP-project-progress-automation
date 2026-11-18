import { Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LoginLocators } from '../locators/login';

// READ-ONLY probe of the "Add a Company" form (/company/register), or any
// other company form via opts.path (e.g. /company/registerMasterMerchant).
// Logs in, opens the form, lists every field, then picks each Service
// Provider (host) in MID row 0 and records the Card Schemes and Payment
// Types it offers. Never clicks Submit or Confirm: nothing is created.
//
// Used to fill common/company/hosts.ts and the portal profiles. Each
// portal has a thin explore wrapper (explore/aph, explore/fassbayar).
export async function probeAddCompany(
  page: Page,
  opts: { portal: string; username: string; password: string; outDir: string; path?: string; name?: string }
): Promise<void> {
  await page.goto(LoginLocators.path);
  await page.locator(LoginLocators.username).fill(opts.username);
  await page.locator(LoginLocators.password).fill(opts.password);
  await page.locator(LoginLocators.submit).click();
  await page.locator(LoginLocators.logout).waitFor({ timeout: 30_000 });

  await page.goto(opts.path ?? '/company/register');
  await page.locator('#businessName').waitFor();

  const fields = await page.evaluate(() => {
    const out: Record<string, unknown>[] = [];
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const e = el as HTMLInputElement;
      if (e.type === 'hidden') return;
      const box = e.getBoundingClientRect();
      out.push({
        tag: e.tagName.toLowerCase(), id: e.id, name: e.name, type: e.type,
        maxlength: e.getAttribute('maxlength'), visible: box.width > 0 && box.height > 0,
        inPaymentOption: e.closest('[id^="paymentOption"]')?.id ?? null,
        step: e.closest('#step1') ? 'step1' : e.closest('#step2') ? 'step2' : null
      });
    });
    return out;
  });

  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a.next, a.prev, #submitThis')).map((el) => ({
      id: el.id, cls: el.className, text: (el as HTMLElement).innerText.trim(),
      step: el.closest('#step1') ? 'step1' : el.closest('#step2') ? 'step2' : null
    })));

  const headings = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#step1 h1, #step1 h2, #step1 h3, #step1 h4, #step1 legend, #step1 .title'))
      .map((h) => (h as HTMLElement).innerText.trim()).filter(Boolean));

  const sp = page.locator('select[name="serviceProvider0"]');
  const providers = await sp.locator('option').evaluateAll((os) =>
    os.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o as HTMLOptionElement).label.trim() })));

  const hosts: Record<string, unknown>[] = [];
  for (const p of providers.filter((o) => o.value)) {
    await sp.selectOption(p.value);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2_500);
    const cardSchemes = await page.locator('select[name="cardScheme0"] option').evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).label.trim()).filter(Boolean));
    const paymentTypes = await page.evaluate(() => {
      const out: { name: string; label: string; enabled: boolean; checked: boolean }[] = [];
      document.querySelectorAll('input[type="checkbox"][name$="Checkbox0"], input[type="checkbox"][name$="QRStaticCheckbox0"]')
        .forEach((el) => {
          const c = el as HTMLInputElement;
          const label = (c.closest('label')?.innerText ?? c.parentElement?.innerText ?? '').trim();
          out.push({ name: c.name, label, enabled: !c.disabled, checked: c.checked });
        });
      return out;
    });
    hosts.push({ ...p, cardSchemes, paymentTypes });
  }

  const result = { portal: opts.portal, url: page.url(), headings, buttons, fields, hosts };
  fs.mkdirSync(opts.outDir, { recursive: true });
  const file = path.join(opts.outDir, `${opts.portal}-${opts.name ?? 'add-company'}-probe.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  await page.screenshot({ path: path.join(opts.outDir, `${opts.portal}-${opts.name ?? 'add-company'}-probe.png`), fullPage: true });
  console.log(`Probe written: ${file}`);
}
