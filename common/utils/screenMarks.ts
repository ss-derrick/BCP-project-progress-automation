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

// ---------- Failure card ----------
// The report picture of a failed check: what the Excel sheet expects (green) next to what the portal shows
// (red), with the screen at that moment under it. Built in a SEPARATE blank tab from a plain screenshot,
// so the portal page is never touched (safe while the test is still acting).
export interface FailureCard {
  testTitle: string;
  automationId: string;
  where: string;                                            // page path
  checks: { check: string; should: string; actual: string }[];
  sheet: { sheetId: string; row: number; title: string; steps: string; expected: string }[];
}

const ERROR_BOXES = `[id$="Error"]:not(:empty), .errorMsg:not(:empty) { outline:3px solid #d32f2f !important; outline-offset:2px; }`;

export async function failureCardShot(page: Page, card: FailureCard): Promise<Buffer | null> {
  const shot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 70, style: ERROR_BOXES }).catch(() => null);
  if (!shot) return null;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const time = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
  const sheetHtml = card.sheet.length
    ? card.sheet.map((s) => `<div class="sid">${esc(s.sheetId)} &middot; Excel row ${s.row}</div><div class="ttl">${esc(s.title)}</div>
        <div class="lbl">Expected Result (Excel)</div><div class="exp">${esc(s.expected)}</div>
        ${s.steps ? `<div class="lbl">Steps (Excel)</div><div class="steps">${esc(s.steps)}</div>` : ''}`).join('<hr>')
    : `<div class="exp">This automated test has no linked case in the Excel sheet: the checks on the right are what it expects.</div>`;
  const checksHtml = card.checks.map((c, i) => `<li><div class="chk">${i + 1}. ${esc(c.check)}</div>` +
    (c.should || c.actual ? `<div class="row"><span class="ok">&#10004; Should be:</span> ${esc(c.should || '-')}</div>
       <div class="row"><span class="bad">&#10008; Portal shows:</span> ${esc(c.actual || '-')}</div>` : '') + `</li>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:14px/1.45 Arial,sans-serif;background:#fff;color:#222}
    .head{background:#b71c1c;color:#fff;padding:12px 18px;font-size:17px;font-weight:bold}
    .head small{display:block;font-size:13px;font-weight:normal;color:#ffcdd2;margin-top:2px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 18px}
    .box{border-radius:8px;padding:10px 14px}
    .want{background:#e8f5e9;border:2px solid #43a047}.got{background:#ffebee;border:2px solid #e53935}
    .box h3{margin:0 0 6px;font-size:15px}.want h3{color:#1b5e20}.got h3{color:#b71c1c}
    .sid{font-weight:bold;color:#1b5e20}.ttl{font-style:italic;margin-bottom:6px}
    .lbl{font-size:12px;color:#555;text-transform:uppercase;letter-spacing:.03em;margin-top:6px}
    .exp{font-weight:bold}.steps{font-size:13px;color:#333}
    ul{margin:0;padding:0;list-style:none} li{margin-bottom:8px}
    .chk{font-weight:bold}.row{margin-left:12px}.ok{color:#1b5e20;font-weight:bold}.bad{color:#b71c1c;font-weight:bold}
    .meta{padding:0 18px 8px;font-size:12px;color:#555}
    .screen{margin:0 18px 18px;border:6px solid #d32f2f;border-radius:4px}
    .screen img{display:block;width:100%}
    .cap{margin:0 18px 4px;font-size:12px;color:#b71c1c;font-weight:bold}
  </style></head><body>
    <div class="head">&#10060; FAILED HERE: ${esc(card.testTitle)}<small>${esc(card.automationId)} &middot; it should not be like this: the Excel sheet expects what is on the left</small></div>
    <div class="grid">
      <div class="box want"><h3>&#10004; What the Excel sheet expects</h3>${sheetHtml}</div>
      <div class="box got"><h3>&#10008; What the portal does instead</h3><ul>${checksHtml}</ul></div>
    </div>
    <div class="meta">Page: ${esc(card.where)} &middot; ${esc(time)} (MYT)</div>
    <div class="cap">Screen at the moment of the failure (error messages on it boxed in red):</div>
    <div class="screen"><img src="data:image/jpeg;base64,${shot.toString('base64')}"></div>
  </body></html>`;
  const tab = await page.context().newPage().catch(() => null);
  if (!tab) return shot;
  try {
    await tab.setViewportSize({ width: 1300, height: 800 });
    await tab.setContent(html, { waitUntil: 'load' });
    await tab.evaluate(() => Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => {}))));
    return await tab.screenshot({ fullPage: true, type: 'jpeg', quality: 75 });
  } catch {
    return shot;
  } finally {
    await tab.close().catch(() => {});
  }
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
