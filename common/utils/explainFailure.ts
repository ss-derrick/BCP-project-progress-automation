// Plain-words explanation of a failed check, shared by the report's Notes column
// (common/reporters/executionReport.ts) and the red "FAILED" screenshot (common/fixtures/base.ts).
//   'User ID 3 chars accepted - expected no error message, portal showed "Please enter valid User ID"'

export const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '');

export const shown = (v: string): string => {
  const t = v.trim();
  if (t === '' || t === 'undefined' || t === '""' || t === 'null') return 'nothing';
  return t;
};

export function explainError(message: string, step: string): string {
  const lines = stripAnsi(message).split('\n').map((l) => l.trimEnd());
  const first = (lines.find((l) => l.trim()) ?? '').trim().replace(/^Error:\s*/, '');
  const value = (re: RegExp) => lines.map((l) => l.match(re)?.[1]).find((v) => v !== undefined);
  const expected = value(/^\s*Expected(?: substring| pattern| string)?:\s*(.*)$/);
  const received = value(/^\s*Received(?: string| array)?:\s*(.*)$/);
  // generic matcher text ("expect(received).toBe(expected) ...") says nothing: use the step instead
  const generic = /^expect\(|^Timed out|^Timeout|^locator\./.test(first);
  const check = generic ? step : first;
  const where = check || step;                    // short: the check's own name, else the step

  // list / text differences: "+ x" lines = extra on the portal, "- x" = missing from the portal
  const extra = lines.filter((l) => /^\+\s{2,}/.test(l)).map((l) => l.replace(/^\+\s+/, '').replace(/,$/, '').trim()).filter((v) => v && !/^[\[\]{}]$/.test(v));
  const missing = lines.filter((l) => /^-\s{2,}/.test(l)).map((l) => l.replace(/^-\s+/, '').replace(/,$/, '').trim()).filter((v) => v && !/^[\[\]{}]$/.test(v));
  if (/toEqual|toStrictEqual/.test(message) && (extra.length || missing.length)) {
    const parts = [extra.length ? `portal has extra ${extra.join(', ')}` : '', missing.length ? `portal is missing ${missing.join(', ')}` : ''].filter(Boolean);
    return `${where} - ${parts.join('; ')}`;
  }
  if (/Timeout \d+ms exceeded|Timed out/.test(message)) {
    const waited = value(/waiting for (.*)$/);
    return `${where} - the page did not show what was expected in time${waited ? ` (waited for ${waited.trim()})` : ''}`;
  }
  if (expected !== undefined || received !== undefined) {
    let exp = shown(expected ?? '');
    const rec = shown(received ?? '');
    if (/^(true|false)$/.test(exp) && /^(true|false)$/.test(rec)) return `${where} - not met on the portal (expected ${exp}, got ${rec})`;
    if (exp.startsWith('not ')) exp = shown(exp.slice(4)) === 'nothing' ? 'something to be shown' : `anything but ${exp.slice(4)}`;
    if (exp === 'nothing') exp = 'no error message';
    return `${where} - expected ${exp}, portal showed ${rec}`;
  }
  return where || first;
}


// Every failed check of a test (soft ones too), de-duplicated, max `max`
export function explainMessages(messages: string[], max = 6): string[] {
  const notes = [...new Set(messages.map((m) => explainError(stripAnsi(m), '')).filter(Boolean))];
  return notes.length > max ? [...notes.slice(0, max), `(+${notes.length - max} more, see the report)`] : notes;
}
