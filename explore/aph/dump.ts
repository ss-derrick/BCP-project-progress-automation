import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export const OUT = process.env.EXPLORE_OUT ?? path.join(__dirname, '..', 'explore-dumps');

// Save a full-page screenshot + a compact list of the page's useful
// elements (ids, data-* / aria-* attributes, form controls, buttons,
// links) to explore/explore-dumps/<name>.png / .txt
// "V" at the start of a line = visible on screen, "-" = hidden.
export async function dump(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }).catch(() => {});

  const rows = await page.evaluate(() => {
    if (!document.body) return [] as string[];
    const out: string[] = [];
    for (const e of Array.from(document.querySelectorAll('body *'))) {
      const el = e as HTMLElement;
      if (['SCRIPT', 'STYLE', 'LINK', 'META'].includes(el.tagName)) continue;
      const cls = typeof el.className === 'string' ? el.className : '';
      const attrs = Array.from(el.attributes)
        .filter((a) => a.name.startsWith('data-') || a.name.startsWith('aria-') ||
          ['name', 'type', 'role', 'placeholder', 'autocomplete', 'for', 'readonly', 'disabled', 'hidden', 'maxlength', 'value', 'href'].includes(a.name))
        .map((a) => `${a.name}=${JSON.stringify(a.value.slice(0, 60))}`);
      const interesting =
        el.id || attrs.some((d) => d.startsWith('data-test') || d.startsWith('role=')) ||
        ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A', 'DIALOG', 'FORM', 'LABEL', 'H1', 'H2', 'H3', 'TABLE'].includes(el.tagName);
      if (!interesting) continue;
      const r = el.getBoundingClientRect();
      const visible = !!(r.width && r.height) && getComputedStyle(el).visibility !== 'hidden';
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent?.trim()).join(' ').trim();
      const text = (own || (el.children.length === 0 ? el.innerText : '') || '').replace(/\s+/g, ' ').slice(0, 70);
      out.push(
        `${visible ? 'V' : '-'} <${el.tagName.toLowerCase()}` +
        (el.id ? ` #${el.id}` : '') +
        (cls ? ` .${cls.trim().split(/\s+/).join('.')}` : '') +
        (attrs.length ? ` ${attrs.join(' ')}` : '') + '>' +
        (text ? ` "${text}"` : '')
      );
    }
    return out;
  }).catch((e) => [`(page was navigating: ${String(e.message).split('\n')[0]})`]);

  fs.writeFileSync(path.join(OUT, `${name}.txt`), `URL: ${page.url()}\n` + rows.join('\n'));
  console.log(`dumped ${name} (${rows.length} elements) ${page.url()}`);
}

// Try an action; log instead of failing so exploration keeps going
export async function tryStep(label: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    console.log(`STEP FAILED: ${label}: ${String((e as Error).message).split('\n')[0]}`);
    return false;
  }
}
