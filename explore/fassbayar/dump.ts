import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

// Dump every interactive / labelled element on the page (all frames) to
// explore/explore-dumps/<name>.json + a full-page screenshot.
export async function dumpPage(page: Page, name: string): Promise<void> {
  const outDir = process.env.EXPLORE_OUT ?? path.join(__dirname, '..', 'explore-dumps');
  fs.mkdirSync(outDir, { recursive: true });

  const frames = [];
  for (const frame of page.frames()) {
    const items = await frame.evaluate(() => {
      const visible = (e: Element) => {
        const r = (e as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const labelFor = (e: Element) => {
        const id = e.getAttribute('id');
        const l = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        return (l?.textContent ?? e.closest('label')?.textContent ?? '').trim().replace(/\s+/g, ' ');
      };
      return Array.from(document.querySelectorAll(
        'input, select, textarea, button, a, [role=button], [onclick], label, h1, h2, h3, h4, legend, th'
      )).map((e) => ({
        tag: e.tagName.toLowerCase(),
        type: e.getAttribute('type'),
        id: e.getAttribute('id'),
        name: e.getAttribute('name'),
        cls: e.getAttribute('class'),
        href: e.getAttribute('href'),
        onclick: e.getAttribute('onclick'),
        placeholder: e.getAttribute('placeholder'),
        value: (e as HTMLInputElement).value ?? null,
        checked: (e as HTMLInputElement).checked ?? null,
        label: labelFor(e),
        text: (e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 120),
        options: e.tagName === 'SELECT'
          ? Array.from((e as HTMLSelectElement).options).map(o => `${o.value}=${o.text.trim()}`).slice(0, 60)
          : undefined,
        visible: visible(e)
      }));
    }).catch(() => []);
    frames.push({ url: frame.url(), name: frame.name(), items });
  }

  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ url: page.url(), title: await page.title(), frames }, null, 1));
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(`[dump] ${name}: ${page.url()}`);
}
