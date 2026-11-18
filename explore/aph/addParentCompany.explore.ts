// Explore "Add a Parent Company" (All Companies > Quicklinks > Add a Parent
// Company, /company/registerMasterMerchant). Reads the form only - Submit /
// Confirm are NEVER clicked, nothing is created.
//   npm run explore:aph -- explore/aph/addParentCompany.explore.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../common/pages/LoginPage';
import { Credentials } from '../../common/config/testConfig';
import { dump } from './dump';

test('explore Add a Parent Company form', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login(Credentials.username, Credentials.password);
  await page.waitForURL(/\/console/);

  await page.locator('#topNavi a[href="/company"]').click();
  await page.locator('#leftPanel').getByRole('link', { name: 'Add a Parent Company' }).click();
  await page.waitForLoadState('networkidle').catch(() => {});
  console.log('URL ' + page.url());
  await dump(page, 'add-parent-01');

  const info = await page.evaluate(() => {
    const txt = (e: Element | null | undefined) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const vis = (e: Element) => !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight);
    const fields = Array.from(document.querySelectorAll('#step1 input, #step1 select, #step1 textarea, #rightMainContent a.button'))
      .filter((e) => (e as HTMLInputElement).type !== 'hidden')
      .map((e) => {
        const el = e as HTMLInputElement;
        const opts = el.tagName === 'SELECT' ? ' {' + Array.from((el as unknown as HTMLSelectElement).options).map((o) => `${o.value}=${txt(o)}`).join(' | ').slice(0, 400) + '}' : '';
        const near = txt(el.closest('div')?.previousElementSibling ?? el.parentElement?.previousElementSibling).slice(0, 40);
        return `${vis(el) ? 'V' : '-'} <${el.tagName.toLowerCase()} type=${el.type ?? ''} id=${el.id} name=${el.name} value=${JSON.stringify((el.value ?? '').slice(0, 40))} maxlength=${el.getAttribute('maxlength') ?? ''}${el.disabled ? ' disabled' : ''}${el.checked ? ' checked' : ''}> near="${near}"${opts}` +
          (el.tagName === 'A' ? ` TEXT="${txt(el)}" id=${el.id} class=${el.className}` : '');
      });
    const step1 = txt(document.querySelector('#step1')).slice(0, 1800);
    const hasStep2 = !!document.querySelector('#step2');
    const form = document.querySelector('#step1')?.closest('form');
    const scripts = Array.from(document.scripts).map((s) => s.textContent ?? '')
      .flatMap((t) => { const out: string[] = []; const re = /(#submitThis|attr\('action'|validateInput\d+\(\)\{|merchantType|masterMerchant|hq)/gi; let m; let n = 0; while ((m = re.exec(t)) && n < 12) { out.push(t.slice(Math.max(0, m.index - 150), m.index + 250).replace(/\s+/g, ' ')); n++; } return out; });
    return { fields, step1, hasStep2, form: form ? `<form id=${form.id} action=${form.getAttribute('action')} method=${form.getAttribute('method')}>` : 'none', scripts };
  });
  console.log('FORM ' + info.form + ' hasStep2=' + info.hasStep2);
  console.log('FIELDS\n' + info.fields.join('\n'));
  console.log('STEP1 TEXT ' + info.step1);
  console.log('SCRIPTS\n' + Array.from(new Set(info.scripts)).join('\n---\n'));
});
