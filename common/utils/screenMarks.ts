import type { Page } from '@playwright/test';

// Marked screenshots for the report, so the problem is visible ON the picture:
//   - a caption bar on top: which step this screen is ("After Submit (...): went to Review & Confirm")
//   - every error / validation message on screen boxed in red with an "ERROR SHOWN" tag
//   - for a failed test: a red banner listing each failed check in plain words (what was checked,
//     what was expected, what the portal showed)
// The marks are added just before the screenshot and removed right after (the page is not changed).

export interface ScreenMarks {
  caption: string;
  failures?: string[];        // red "FAILED" banner lines
}

// Messages the portal shows for errors / validation (leaf elements only, so the box is tight)
const ERROR_TEXT = /An error has occurred|Page not found|Please (enter|select|upload|key in)|Invalid|Duplicat|not exist|No record found|account is suspended|Access Denied|is required|not allowed/i;

export async function markScreen(page: Page, marks: ScreenMarks): Promise<void> {
  await page.evaluate(({ caption, failures, errorText }) => {
    const re = new RegExp(errorText, 'i');
    const vis = (e: Element) => {
      const r = (e as HTMLElement).getBoundingClientRect();
      const st = getComputedStyle(e as HTMLElement);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    // 1. error / validation messages: #xxxError, .errorMsg, or a small leaf element with an error text
    const seen = new Set<Element>();
    const found: string[] = [];
    const candidates = Array.from(document.querySelectorAll('[id$="Error"], [id$="error"], .errorMsg, .error, label, span, div, p, td, li, b, font'));
    for (const el of candidates) {
      if (!vis(el) || el.closest('#qa-mark-banner')) continue;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 160) continue;
      const byId = /error$/i.test(el.id) || el.classList.contains('errorMsg') || el.classList.contains('error');
      const isLeaf = Array.from(el.children).every((c) => !(c.textContent ?? '').trim() || ['BR', 'B', 'I', 'SPAN', 'FONT'].includes(c.tagName));
      if (!(byId || (isLeaf && re.test(text)))) continue;
      if (Array.from(seen).some((s) => s.contains(el) || el.contains(s))) continue;
      seen.add(el);
      found.push(text);
      const h = el as HTMLElement;
      h.dataset.qaOldStyle = h.getAttribute('style') ?? '';
      h.style.outline = '3px solid #d32f2f';
      h.style.outlineOffset = '2px';
      h.style.position = h.style.position || 'relative';
      const tag = document.createElement('span');
      tag.className = 'qa-mark-tag';
      tag.textContent = 'ERROR SHOWN';
      tag.style.cssText = 'position:absolute;top:-20px;left:0;background:#d32f2f;color:#fff;font:bold 11px Arial;padding:2px 6px;border-radius:3px;z-index:99999;white-space:nowrap;';
      h.appendChild(tag);
    }
    // 2. banner at the very top of the page (pushes the page down, nothing hidden)
    document.getElementById('qa-mark-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'qa-mark-banner';
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const failed = failures && failures.length;
    banner.style.cssText = `text-align:left;font:14px Arial;line-height:1.45;padding:10px 16px;color:#fff;background:${failed ? '#b71c1c' : '#263238'};border-bottom:4px solid ${failed ? '#ff8a80' : '#90a4ae'};`;
    banner.innerHTML =
      `<div style="font-weight:bold;font-size:15px">${failed ? '&#10060; FAILED HERE: ' : '&#128247; '}${esc(caption)}</div>` +
      (failed ? `<ol style="margin:6px 0 0 18px;padding:0">${failures!.map((f) => `<li>${esc(f)}</li>`).join('')}</ol>` : '') +
      (found.length ? `<div style="margin-top:4px;color:#ffcdd2">Messages on screen (boxed in red): ${found.slice(0, 5).map((f) => `"${esc(f)}"`).join(' &middot; ')}</div>` : '');
    document.body.insertBefore(banner, document.body.firstChild);
  }, { caption: marks.caption, failures: marks.failures ?? [], errorText: ERROR_TEXT.source });
}

export async function unmarkScreen(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('qa-mark-banner')?.remove();
    document.querySelectorAll('.qa-mark-tag').forEach((t) => t.remove());
    document.querySelectorAll<HTMLElement>('[data-qa-old-style]').forEach((h) => {
      const old = h.dataset.qaOldStyle ?? '';
      if (old) h.setAttribute('style', old); else h.removeAttribute('style');
      delete h.dataset.qaOldStyle;
    });
  }).catch(() => {});
}

// CSS-only marks for screenshots taken WHILE the test is still acting (screenEveryPage): applied by
// page.screenshot({ style }) only for the instant of the capture, no DOM change that could move a click.
// Caption bar via body::before; validation messages (#...Error / .errorMsg) boxed in red.
export function cssMarks(caption: string): string {
  const text = caption.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  return `body::before { content: "\\1F4F7  ${text}"; display:block; font:bold 15px Arial; color:#fff; background:#263238;
      padding:10px 16px; border-bottom:4px solid #90a4ae; text-align:left; }
    [id$="Error"]:not(:empty), .errorMsg:not(:empty) { outline:3px solid #d32f2f !important; outline-offset:2px; }
    body:has(#qa-mark-banner)::before { display:none; }`;  /* a step screenshot is marking the page: one caption only */
}

// CSS-only red "FAILED HERE" banner (screenshot-only, safe while the test keeps acting)
export function cssFailMarks(caption: string, failures: string[]): string {
  const q = (t: string) => t.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  const lines = [`\\274C  FAILED HERE: ${q(caption)}`, ...failures.map((f, i) => `${i + 1}) ${q(f)}`)].join('\\A ');
  return `body::before { content: "${lines}"; display:block; white-space:pre-line; text-align:left; font:bold 14px Arial;
      line-height:1.5; color:#fff; background:#b71c1c; padding:10px 16px; border-bottom:4px solid #ff8a80; }
    body:has(#qa-mark-banner)::before { display:none; }
    [id$="Error"]:not(:empty), .errorMsg:not(:empty) { outline:3px solid #d32f2f !important; outline-offset:2px; }`;
}

// Full-page screenshot with the marks (JPEG unless png = true); null when the page is gone
export async function markedScreenshot(page: Page, marks: ScreenMarks, png = false): Promise<Buffer | null> {
  try {
    await markScreen(page, marks);
  } catch { /* page navigating: shoot without marks */ }
  const body = await page.screenshot(png ? { fullPage: true } : { fullPage: true, type: 'jpeg', quality: 70 }).catch(() => null);
  await unmarkScreen(page);
  return body;
}
