# common/tests/home

Tests for the **Home** menu module (`/console`), on both portals (same screen; only Fassbayar shows the
Daily Transaction Snapshot).

| File | Case | Sheet |
|---|---|---|
| `home.spec.ts` | TC-HOME-001 Home shows greeting, clock, last login and the Quicklinks panel | APH TC-APH-BP-HOME-003 (row 19) |
| | TC-HOME-002 Each Quicklink opens the right page | APH TC-APH-BP-HOME-004 (row 20) |
| | TC-HOME-003 "Your last log in was" shows the previous login | APH TC-APH-BP-HOME-005 (row 21) |
| | TC-HOME-004 Daily Transaction Snapshot chart and View Details | Fassbayar TC-FB-BP-HOME-001 (row 19) |
| | TC-HOME-005 Snapshot totals match today's transactions | Fassbayar TC-FB-BP-HOME-002 (row 20) |
| | TC-HOME-006 Each Quicklink opens the right page (same test as TC-HOME-002; ID from `home.quicklinkId`) | Fassbayar TC-FB-BP-HOME-003 (row 21) |

- Read-only (looks, clicks links, logs out and in again).
- Expected Quicklinks boxes / links / page headings per portal: `portals.config.ts` `home.panels`;
  `home.dailySnapshot` = false on APH (TC-HOME-004 / 005 "Applicable for Fassbayar only").
- Page object: `common/pages/HomePage.ts` (header, `panels()`, `snapshotAmounts()`).

Run: `npx playwright test common/tests/home/home.spec.ts`
