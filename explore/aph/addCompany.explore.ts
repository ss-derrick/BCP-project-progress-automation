// Explore the APH "Add a Company" form (All Companies > Quicklinks >
// Add a Company, /company/register). Reads the form only - NOTHING is
// submitted, so no company is created.
//   npm run explore:aph -- explore/aph/addCompany.explore.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { Credentials } from '../../common/config/testConfig';
import { dump } from './dump';

test('explore Add a Company form', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login(Credentials.username, Credentials.password);
  await page.waitForURL(/\/console/);

  await page.locator('#topNavi a[href="/company"]').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('#leftPanel a[href="/company/register"]').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await dump(page, 'add-company-01');

  // Every form control with its label, options and attributes
  const fields = await page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const out: string[] = [];
    document.querySelectorAll('#rightMainContent input, #rightMainContent select, #rightMainContent textarea, #rightMainContent a.button, #rightMainContent button').forEach((el) => {
      const e = el as HTMLInputElement;
      if (e.type === 'hidden' && !/mid|provider|payment/i.test(e.name)) return;
      const row = e.closest('tr, .formRow, li, div');
      const label = e.id ? txt(document.querySelector(`label[for="${e.id}"]`)) : '';
      const opts = e.tagName === 'SELECT'
        ? ' OPTIONS[' + Array.from((e as unknown as HTMLSelectElement).options).map((o) => `${o.value}=${txt(o)}`).join(' | ').slice(0, 900) + ']'
        : '';
      out.push(
        `<${e.tagName.toLowerCase()} type=${e.type ?? ''} id=${e.id} name=${e.name} value=${JSON.stringify((e.value ?? '').slice(0, 40))}` +
        ` maxlength=${e.getAttribute('maxlength') ?? ''} readonly=${e.readOnly ?? ''} disabled=${e.disabled ?? ''} visible=${!!(e.offsetWidth || e.offsetHeight)}>` +
        ` LABEL="${label || txt(row?.querySelector('.formLabel, label, th, td'))?.slice(0, 60)}"${opts}` +
        (e.tagName === 'A' || e.tagName === 'BUTTON' ? ` TEXT="${txt(e)}" onclick=${(e.getAttribute('onclick') ?? '').slice(0, 120)}` : '')
      );
    });
    return out;
  });
  console.log('FIELDS\n' + fields.join('\n'));

  // Section headings, to see the form's structure
  const headings = await page.locator('#rightMainContent').evaluate((root) =>
    Array.from(root.querySelectorAll('h1,h2,h3,h4,.title,[class*="Title"],[class*="title"],p[class*="Bold"],.txt14Bold,.txt16'))
      .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 60));
  console.log('HEADINGS ' + JSON.stringify(Array.from(new Set(headings))));

  // Scripts that mention MID / service provider (how MID rows are added)
  const scripts = await page.evaluate(() => Array.from(document.scripts)
    .map((s) => s.textContent ?? '')
    .filter((t) => /mid|serviceProvider|provider|addRow|clone/i.test(t))
    .map((t) => t.replace(/\s+/g, ' ').slice(0, 2500)));
  scripts.forEach((s, i) => console.log(`SCRIPT ${i}: ${s}`));
});
