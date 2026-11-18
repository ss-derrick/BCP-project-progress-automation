// READ-ONLY scan of "Add a Company" on the portal of ENV_NAME.
// Logs in once, opens the form, records every field, the form's own rules,
// and - per Service Provider - the card schemes and payment types it offers.
// Submit / Confirm are NEVER clicked: nothing is created.
// Output: test-results/scan/add-company-<env>.json
import { test } from '@playwright/test';
import * as fs from 'node:fs';
import { Credentials, ENV_NAME, PORTAL } from '../../portals.config';

test(`scan Add a Company on ${ENV_NAME}`, async ({ page }) => {
  // login
  await page.goto('/auth/login');
  await page.locator('#t_username').fill(Credentials.username);
  await page.locator('#t_password').fill(Credentials.password);
  await page.locator('#login_btn').click();
  await page.waitForURL(/\/console/, { timeout: 60_000 });

  // open the form
  await page.goto('/company/register');
  await page.locator('#businessName').waitFor({ timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  const form = await page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const step1 = document.querySelector('#step1') ?? document.body;
    const fields = Array.from(step1.querySelectorAll('input, select, textarea'))
      .filter((e) => (e as HTMLInputElement).type !== 'hidden' && (e as HTMLInputElement).name)
      .map((e) => {
        const el = e as HTMLInputElement;
        const label = txt(el.closest('.formInput')?.previousElementSibling) || txt(el.closest('label'));
        return {
          name: el.name, id: el.id, tag: el.tagName.toLowerCase(), type: el.type,
          maxlength: el.getAttribute('maxlength') ?? '', visible: vis(el), disabled: el.disabled,
          label: label.slice(0, 60), required: label.startsWith('*'),
          options: el.tagName === 'SELECT'
            ? Array.from((el as unknown as HTMLSelectElement).options).map((o) => `${o.value}=${txt(o)}`) : undefined
        };
      });
    const sections = Array.from(step1.querySelectorAll('.barPaddTitle, .title, h2, h3, .txt18'))
      .map(txt).filter((t) => t && t.length < 60);
    const w = window as unknown as Record<string, unknown>;
    const rules: Record<string, string> = {};
    for (const k of Object.keys(w).filter((k) => /^regex_/.test(k)).sort()) rules[k] = String(w[k]);
    return { fields, sections: Array.from(new Set(sections)), rules };
  });

  // per Service Provider (MID row 0): card schemes offered + payment types enabled / auto-ticked
  const provider = page.locator('select[name="serviceProvider0"]');
  const providers = await provider.locator('option').evaluateAll((os) =>
    os.map((o) => ({ value: (o as HTMLOptionElement).value, label: (o.textContent ?? '').trim() })));
  const hosts: Record<string, unknown>[] = [];
  for (const p of providers) {
    await provider.selectOption({ index: 0 });
    await page.waitForTimeout(800);
    await provider.selectOption(p.value);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const row = document.querySelector('#paymentOption0') ?? document;
      const schemes = Array.from(row.querySelectorAll('select[name="cardScheme0"] option')).map((o) => (o.textContent ?? '').trim());
      const boxes = Array.from(row.querySelectorAll('input[type="checkbox"][name$="Checkbox0"]')) as HTMLInputElement[];
      const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
      const extra = Array.from(row.querySelectorAll('input, select'))
        .filter((e) => vis(e) && (e as HTMLInputElement).name && !/Checkbox0$|^cardScheme0$|^serviceProvider0$|^mid0$/.test((e as HTMLInputElement).name))
        .map((e) => (e as HTMLInputElement).name);
      return {
        cardSchemes: schemes,
        paymentTypesEnabled: boxes.filter((b) => vis(b) && !b.disabled).map((b) => b.name.replace(/Checkbox0$/, '')),
        autoTicked: boxes.filter((b) => b.checked).map((b) => b.name.replace(/Checkbox0$/, '')),
        otherVisibleFields: Array.from(new Set(extra))
      };
    });
    hosts.push({ code: p.value, label: p.label, ...info });
    console.log(`${p.value.padEnd(8)} ${p.label.padEnd(18)} schemes=${info.cardSchemes.length} payment=${info.paymentTypesEnabled.join(',')}${info.autoTicked.length ? ' auto=' + info.autoTicked.join(',') : ''}`);
  }

  fs.mkdirSync('test-results/scan', { recursive: true });
  const out = `test-results/scan/add-company-${ENV_NAME.toLowerCase()}.json`;
  fs.writeFileSync(out, JSON.stringify({ env: ENV_NAME, portal: PORTAL, scannedAt: new Date().toISOString(), ...form, hosts }, null, 2));
  await page.screenshot({ path: `test-results/scan/add-company-${ENV_NAME.toLowerCase()}.png`, fullPage: true });
  console.log(`saved ${out}: ${form.fields.length} fields, ${Object.keys(form.rules).length} rules, ${hosts.length} hosts`);
  // Submit / Confirm intentionally never clicked
});
