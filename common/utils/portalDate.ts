// Dates as the System Portal writes them: "18 Nov 2026" (dd MMM yyyy),
// in the portal's own time zone (Malaysia).
// Note: Node writes September as "Sept" (en-GB); the portal only understands "Sep" and IGNORES a date
// it cannot read (e.g. the credit settlement list then shows every settlement), so it is fixed here.

const format = (d: Date): string =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })
    .format(d).replace('Sept', 'Sep');

// n days before today in the portal's time zone, e.g. portalDaysAgo(1) = yesterday
export const portalDaysAgo = (n: number): string => format(new Date(Date.now() - n * 86_400_000));

// Today, e.g. "18 Nov 2026" (the Date filter default on list pages)
export const portalToday = (): string => format(new Date());
