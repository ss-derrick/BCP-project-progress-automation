import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { Credentials, PORTAL_PROFILE } from '../../../portals.config';
import { portalToday } from '../../utils/portalDate';

// Home (/console), both portals (same screen; Fassbayar also shows the Daily Transaction Snapshot).
// Written from the baseline sheets and the portal (explore/scan/home.scan.ts, 24 Nov 2026):
//   APH  TC-APH-BP-HOME-003, 004, 005 (rows 19-21)  -> TC-HOME-001, 002, 003
//   Fassbayar TC-FB-BP-HOME-001, 002 (rows 19-20)   -> TC-HOME-004, 005
// Read-only: only looks, clicks links and logs out / in again.
// Run only this file:  npx playwright test common/tests/home/home.spec.ts

const MODULE = 'Home';
const HOME = PORTAL_PROFILE.home;
const TOP_MENU = ['Home', 'All Companies', 'Manage Mobile Users', 'Manage Readers', 'Manage Transactions', 'Manage Credit Settlements', 'Administrator'];
const SLICES = ['Settled', 'Unsettled', 'Voided'] as const;
const money = (v: string) => Number((v.match(/-?[\d,]+(\.\d+)?/)?.[0] ?? '0').replace(/,/g, ''));
const round2 = (n: number) => Math.round(n * 100) / 100;
// header date / time, e.g. "Tuesday, 24 Nov 2026, 14:00:37" and "Your last log in was Tuesday, 24 Nov 2026 12:14"
// (the page uses non-breaking spaces in places: \s everywhere; dates are normalised before comparing)
const CLOCK = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{2}\s\w{3}\s\d{4}),\s+(\d{2}):(\d{2}):(\d{2})/;
const LAST_LOGIN = /Your\s+last\s+log\s+in\s+was\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{2}\s\w{3}\s\d{4})\s+(\d{2}):(\d{2})/;
const sp = (t: string) => t.replace(/\s+/g, ' ');
const minutes = (hh: string, mm: string) => Number(hh) * 60 + Number(mm);

// APH sheet cases (TC-APH-BP-HOME-003..005). Not in the Fassbayar sheet: not run there (each portal follows its own
// baseline sheet; the reporter leaves "Applicable for ... only" cases out of that portal's report).
test.describe('Home @home - header, Quicklinks, last login (APH sheet)', () => {
  test.skip(!HOME.headerCases, `Applicable for APH only: not a case of the ${PORTAL_PROFILE.name} baseline sheet`);


  test.beforeEach(async ({ loginPage, consolePage }) => {
    await loginAs({ loginPage, consolePage });
  });

  test(
    'Home shows greeting, clock, last login and the Quicklinks panel',
    testCase({ id: 'TC-HOME-001', module: MODULE, priority: 'Low', suite: ['smoke'] }),
    async ({ homePage: home }) => {
      await home.openHome();
      await test.step('Browser title "Home | Soft Space"; header: greeting, live clock, last login, LOGOUT', async () => {
        await expect.soft(home.page, 'browser title').toHaveTitle('Home | Soft Space');
        await expect(home.header).toContainText(`Good Day, ${Credentials.username}`);
        const first = (await home.header.innerText()).match(CLOCK);
        expect(first, `clock "{weekday}, {dd Mon yyyy}, {hh:mm:ss}" in "${await home.header.innerText()}"`).toBeTruthy();
        expect(sp(first![2]), 'clock date = today').toBe(portalToday());
        await home.page.waitForTimeout(2_500);
        const later = (await home.header.innerText()).match(CLOCK);
        // The case's Expected Result does not ask for a ticking clock; only the Field Registry note of
        // FR-XCUT-S01-013 says "Live clock". So a clock that does not tick is a finding, not a failure.
        if (later?.[0] === first![0]) {
          test.info().annotations.push({ type: 'finding', description: `Header clock shows the page-load time, it does not tick (still "${first![0]}" after 2.5 s; Field Registry note FR-XCUT-S01-013 says "Live clock")` });
        }
        await expect(home.lastLogin).toHaveText(LAST_LOGIN);
        await expect(home.page.locator('#login_btn.btnLogout')).toHaveText(/LOGOUT/);
      });
      await test.step('Top menu: Home, All Companies, ... Administrator', async () => {
        const menu = (await home.topMenuLinks.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
        expect(menu).toEqual(TOP_MENU);
      });
      await test.step(`Quicklinks panel: ${HOME.panels.length} boxes with their links (Field Registry)`, async () => {
        const shown = await home.panels();
        expect(shown.map((p) => p.title), 'box titles').toEqual(HOME.panels.map((p) => p.title));
        for (const expected of HOME.panels) {
          const box = shown.find((p) => p.title === expected.title);
          expect.soft(box?.links, `"${expected.title}" links`).toEqual(expected.links.map((l) => ({ text: l.text, href: l.href })));
        }
        await home.captureScreen('Home - Quicklinks panel');
      });
    }
  );

  test(
    'Each Quicklink opens the right page',
    testCase({ id: 'TC-HOME-002', module: MODULE, priority: 'Low' }),
    async ({ homePage: home }) => {
      for (const [boxIndex, panel] of HOME.panels.entries()) {
        for (const link of panel.links) {
          await test.step(`${panel.title} > ${link.text}: opens "${link.heading}"`, async () => {
            await home.page.goto('/console');
            await home.page.waitForLoadState('load');
            await home.panelBoxes.nth(boxIndex).locator('a', { hasText: new RegExp(`^\\s*${link.text.replace(/[()&]/g, '\\$&')}\\s*$`) }).first().click();
            await home.page.waitForLoadState('load');
            await home.failIfLoggedOut();
            await expect(home.page.locator('#rightMainContent')).not.toContainText('An error has occurred');
            expect(new URL(home.page.url()).pathname.startsWith(link.href), `URL ${home.page.url()} starts with ${link.href}`).toBe(true);
            await expect(home.page.locator('.barPaddTitle, .title24Black').first(), 'page heading').toHaveText(link.heading);
            // page titles are in scope (QA Lead 19 Nov, OQ-FB-08): browser title = "<page> | Soft Space"
            await expect.soft(home.page, `browser title of "${link.text}"`).toHaveTitle(`${link.heading} | Soft Space`);
            await home.captureStep(`${link.text} -> ${link.heading}`);
          });
        }
      }
    }
  );

  test(
    '"Your last log in was" shows the previous login, not the current one',
    testCase({ id: 'TC-HOME-003', module: MODULE, priority: 'High' }),
    async ({ homePage: home, loginPage, consolePage }) => {
      let first = { date: '', min: 0, text: '' };
      await test.step('Login 1 (done before this test): note the time on the header clock', async () => {
        await home.openHome();
        const m = (await home.header.innerText()).match(CLOCK)!;
        first = { date: sp(m[2]), min: minutes(m[3], m[4]), text: `${sp(m[2])} ${m[3]}:${m[4]}` };
        await home.captureStep(`Login 1 at ${first.text}`);
      });
      await test.step('Log out; wait for the next minute so the two logins differ', async () => {
        await consolePage.logout();
        await home.page.waitForURL(/\/auth\/login|\/login|\/$/, { timeout: 30_000 }).catch(() => {});
        await home.captureStep('Logged out');
        const nowMin = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' })); return d.getHours() * 60 + d.getMinutes(); };
        for (let i = 0; i < 70 && nowMin() === first.min; i++) await home.page.waitForTimeout(1_000);
      });
      await test.step(`Login 2: "Your last log in was" = login 1 (${first.text}), not now`, async () => {
        await loginAs({ loginPage, consolePage });
        const shown = (await home.lastLogin.innerText()).match(LAST_LOGIN);
        const now = (await home.header.innerText()).match(CLOCK)!;
        await home.captureStep(`Login 2: ${await home.lastLogin.innerText()}`);
        expect(shown, `"Your last log in was {weekday}, {dd Mon yyyy} {hh:mm}"`).toBeTruthy();
        expect(sp(shown![2]), 'last login date').toBe(first.date);
        const lastMin = minutes(shown![3], shown![4]);
        expect(Math.abs(lastMin - first.min), `last login ${shown![3]}:${shown![4]} = login 1 ${first.text} (±1 min)`).toBeLessThanOrEqual(1);
        expect(lastMin, `last login is not the current login (${now[3]}:${now[4]})`).not.toBe(minutes(now[3], now[4]));
      });
    }
  );
});

// Fassbayar sheet cases (TC-FB-BP-HOME-001..002). APH's Home has no Daily Transaction Snapshot: not run there.
test.describe('Home @home - Daily Transaction Snapshot (Fassbayar sheet)', () => {
  test.skip(!HOME.dailySnapshot, `Applicable for Fassbayar only: ${PORTAL_PROFILE.name} Home has no Daily Transaction Snapshot`);

  test.beforeEach(async ({ loginPage, consolePage }) => {
    await loginAs({ loginPage, consolePage });
  });

  test(
    'Home shows the Daily Transaction Snapshot chart and View Details',
    testCase({ id: 'TC-HOME-004', module: MODULE, priority: 'Medium' }),
    async ({ homePage: home }) => {
      await home.openHome();
      await test.step('Heading "Daily Transaction Snapshot As of {today}, {hh:mm}"; Total Amount (RM)', async () => {
        await expect(home.snapshot).toContainText('Daily Transaction Snapshot');
        await expect(home.snapshotAsOf, 'As of = today').toContainText(portalToday());
        await expect(home.snapshotAsOf).toHaveText(/\d{2}:\d{2}/);
        await expect(home.snapshot).toContainText('Total Amount (RM)');
        const total = money(await home.snapshotTotal.innerText());
        const a = await home.snapshotAmounts();
        test.info().annotations.push({ type: 'info', description: `Snapshot: Settled ${a.Settled}, Unsettled ${a.Unsettled}, Voided ${a.Voided}; Total Amount ${total}` });
        expect(total, 'Total Amount = Settled + Unsettled (Voided not counted)').toBeCloseTo(a.Settled + a.Unsettled, 2);
      });
      await test.step('Chart with slices Settled / Unsettled / Voided', async () => {
        await expect(home.snapshotChart).toBeVisible();
        expect((await home.snapshotLegend.allInnerTexts()).map((t) => t.trim())).toEqual([...SLICES]);
        await home.captureScreen('Daily Transaction Snapshot');
      });
      await test.step('View Details opens the transaction list (today)', async () => {
        await home.snapshotViewDetails.click();
        await home.page.waitForLoadState('load');
        await expect(home.page).toHaveURL(/\/transaction\/list/);
        await expect(home.page.locator('.barPaddTitle, .title24Black').first()).toHaveText('All Transactions');
        await home.captureStep('View Details -> All Transactions');
      });
    }
  );

  test(
    'Snapshot totals match today\'s transactions',
    testCase({ id: 'TC-HOME-005', module: MODULE, priority: 'High' }),
    async ({ homePage: home, administratorPage: list }) => {
      // status in Transaction Summary -> snapshot slice
      const sliceOf = (status: string): typeof SLICES[number] | null =>
        /^Settled/i.test(status) ? 'Settled' : /^Voided/i.test(status) ? 'Voided' : /^(Approved|Unsettled|Pending)/i.test(status) ? 'Unsettled' : null;
      const compare = async () => {
        await home.openHome();
        const snap = await home.snapshotAmounts();
        await home.page.goto('/transaction');
        await home.page.waitForLoadState('load');
        const cols = (await list.columns()).map((c) => c.replace(/\s+/g, ''));
        const iStatus = cols.findIndex((c) => /Status/.test(c));
        const iAmount = cols.findIndex((c) => /^Amount/.test(c));
        const rows = await list.allRowCells();
        const sums: Record<string, number> = { Settled: 0, Unsettled: 0, Voided: 0 };
        const other: string[] = [];
        for (const r of rows) {
          const s = sliceOf(r[iStatus] ?? '');
          if (s) sums[s] = round2(sums[s] + money(r[iAmount] ?? '0')); else other.push(r[iStatus]);
        }
        return { snap, sums, count: rows.length, other };
      };
      let r = await compare();
      if (SLICES.some((s) => Math.abs(r.snap[s] - r.sums[s]) > 0.005)) r = await compare();   // a sale may have come in between
      await home.captureStep(`Transaction Summary today: ${r.count} transactions`);
      test.info().annotations.push({ type: 'info', description:
        `Today: ${r.count} transactions; list Settled ${r.sums.Settled}, Unsettled ${r.sums.Unsettled}, Voided ${r.sums.Voided}` +
        ` | snapshot ${r.snap.Settled} / ${r.snap.Unsettled} / ${r.snap.Voided}${r.other.length ? ` | not in the chart: ${[...new Set(r.other)].join(', ')}` : ''}` });
      for (const s of SLICES) {
        await test.step(`${s}: snapshot ${r.snap[s]} = today's ${s} transactions ${r.sums[s]}`, async () => {
          expect(r.snap[s], `${s} amount`).toBeCloseTo(r.sums[s], 2);
        });
      }
      await test.step('A tiny slice next to a large one stays visible (drawn at 1% at least; tooltip shows the real amount)', async () => {
        await home.openHome();
        const a = await home.snapshotAmounts();
        const sum = a.Settled + a.Unsettled + a.Voided;
        const tiny = SLICES.filter((s) => a[s] > 0 && a[s] / sum < 0.01);
        const js = await home.page.evaluate(() => Array.from(document.scripts).map((s) => s.textContent ?? '').join(' '));
        if (!tiny.length) test.info().annotations.push({ type: 'info', description: 'No slice under 1% today: the tiny-slice rule is only checked in the page script' });
        expect(/MIN_SLICE_SHARE\s*=\s*0?\.01/.test(js), 'page draws a non-zero slice at 1% at least (MIN_SLICE_SHARE)').toBe(true);
        expect(/tooltipFormatter[\s\S]*sliceLabels\[i\]/.test(js), 'tooltip shows the real amount (sliceLabels)').toBe(true);
      });
    }
  );
});
