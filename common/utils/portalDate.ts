// Dates as the APH System Portal shows them: "01 Jan 2026", "17 Nov 2026"

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Date -> "01 Jan 2026"
export function formatPortalDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// "01 Jan 2026" -> Date (midnight, local time). Throws on any other format.
export function parsePortalDate(text: string): Date {
  const match = text.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  const month = match ? MONTHS.indexOf(match[2]) : -1;
  if (!match || month < 0) {
    throw new Error(`Not a portal date (expected "01 Jan 2026"): "${text}"`);
  }
  return new Date(Number(match[3]), month, Number(match[1]));
}

// Today at midnight, local time
export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
