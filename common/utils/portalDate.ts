// Dates as the System Portal writes them: "18 Nov 2026" (dd MMM yyyy),
// in the portal's own time zone (Malaysia).

// Today, e.g. "18 Nov 2026" (the Date filter default on list pages)
export const portalToday = (): string =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })
    .format(new Date());
