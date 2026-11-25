import { test, expect } from '../../fixtures/base';
import type { Browser, Page } from '@playwright/test';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { bankUserStatus, setBankUserAccess } from '../../flows/bankUserFlow';
import { LoginPage } from '../../pages/LoginPage';
import { humanAction, requireUatChanges, UAT_CHANGES_ALLOWED } from '../../utils/uatChanges';
import { portalToday } from '../../utils/portalDate';
import { portalDate } from '../../pages/AdministratorPage';
import { BASE_URL, Credentials, ENV_NAME, IGNORE_HTTPS_ERRORS, LOCKOUT_USER_PASSWORD, PORTAL_PROFILE, VIEWER_PASSWORD } from '../../../portals.config';

// Login / session / password / error pages (AUTH), both portals: the 17 cases are the same in both sheets
//   APH TC-APH-BP-AUTH-001..017 (rows 2-18), Fassbayar TC-FB-BP-AUTH-001..017 (rows 2-18) -> TC-AUTH-001..017
//   (AUTH-008 "suspended user cannot log in until reinstated" = TC-ADM-018, same flow: linked to that test)
// Written from both sheets (Test Case Library, Test Data TD-01/02/03, Field Registry FR-AUTH-S01 / FR-XCUT-S01 /
// FR-XCUT-S02, Validation Rules regex_password, Open Questions OQ-APH-12/13/18, OQ-FB-06) and the portal
// (explore/scan/auth.scan.ts, 25 Nov 2026: both portals behave the same).
// Accounts: each case uses its own sheet's Test Data (AUTH-003: APH TD-03 lockout user, Fassbayar TD-01 main user,
// followed at once by a correct login so the counter is 0 again); lockout cases only on the TD-03 lockout user.
// Run only this file:  npx playwright test common/tests/login/auth.spec.ts

const MODULE = 'Login (AUTH)';   // sheet Module column: AUTH
const AUTH = PORTAL_PROFILE.auth;
const ENV_KEY = ENV_NAME.toUpperCase().replace(/[^A-Z0-9]/g, '_');
const BAD_CREDENTIALS = 'Invalid User Name or Password';
const CONCURRENT = 'Auto Logged Out';
const UNKNOWN_USER = 'zz_no_user_99';                       // APH Test Data of AUTH-004
const WRONG_PASSWORD = 'Wrong-Passw0rd!';
const FOOTER = ['Copyright © Soft Space Sdn. Bhd. All Rights Reserved',
  'Supported browsers: Google Chrome [Ver. 38+], Mozilla Firefox [Ver. 33+], Internet Explorer [Ver. 8+], Safari [Ver. 6+]'];
const TOP_MENU = ['Home', 'All Companies', 'Manage Mobile Users', 'Manage Readers', 'Manage Transactions', 'Manage Credit Settlements', 'Administrator'];
// Session timeout (AUTH-010 / 011): the page shows the dialog after 870 s idle and calls /auth/logout 60 s later.
// Both tests wait in REAL time, as the sheet's steps say (a faked page clock leaves the server session fresh).
const sp = (t: string) => t.replace(/\s+/g, ' ').trim();

const needLockoutPassword = () => test.skip(!LOCKOUT_USER_PASSWORD,
  `Human action required: the password of the lockout user ${AUTH.lockoutUser} (Test Data TD-03) is needed; ` +
  `put it in .env as ${ENV_KEY}_LOCKOUT_USER_PASSWORD`);

// The message under "System Portal Login" ('' when none)
async function loginMessage(page: Page): Promise<string> {
  const lines = (await page.locator('body').innerText()).split('\n').map(sp).filter(Boolean);
  const from = lines.indexOf('System Portal Login');
  const to = lines.indexOf('User ID');
  return from >= 0 && to > from ? lines.slice(from + 1, to).join(' ') : '';
}

// One login attempt on the given page; returns what the portal showed
async function attempt(page: Page, user: string, password: string, label: string) {
  const login = new LoginPage(page);
  await login.open();
  await login.usernameInput.fill(user);
  await login.passwordInput.fill(password);
  await login.submitButton.click();
  await page.waitForLoadState('load');
  await page.waitForTimeout(1_000);
  const loggedIn = await page.locator('a.btnLogout').isVisible();
  const result = { url: page.url(), loggedIn, message: loggedIn ? '' : await loginMessage(page) };
  await login.captureStep(`${label}: ${loggedIn ? 'LOGGED IN' : `refused - "${result.message}"`}`);
  return result;
}

// A protected page opened directly must end on the login page (= no session)
async function expectNoSession(page: Page, label: string) {
  await page.goto('/company');
  await page.waitForLoadState('load');
  expect(new URL(page.url()).pathname, `${label}: /company opens the login page (no session)`).toBe('/auth/login');
}

// A second browser (own session) for the user under test; the main session stays as it is
async function otherBrowser<T>(browser: Browser, run: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS });
  try { return await run(await context.newPage()); } finally { await context.close(); }
}

// Sign-out started by the page itself (timeout dialog / idle timer): wait for the navigation, then check that
// the session really ended. The dialog and the timer use GET /auth/logout; LOGOUT posts to /logout.
async function expectSignedOut(page: Page, trigger: () => Promise<unknown>, label: string) {
  const navigated = page.waitForEvent('framenavigated', { timeout: 30_000 }).catch(() => null);
  await trigger();
  await navigated;
  await page.waitForLoadState('load');
  await page.waitForTimeout(1_000);
  const where = new URL(page.url()).pathname;
  await new LoginPage(page).captureStep(`${label}: now on ${where}`);
  if (where !== '/auth/login') {
    test.info().annotations.push({ type: 'finding', description: `${label}: the page went to /auth/logout, which only redirects to ${where} ` +
      'and does not log out (the LOGOUT button posts to /logout instead); the user stays logged in' });
  }
  expect.soft(where, `${label}: the login page is shown`).toBe('/auth/login');
  await page.goto('/company');
  await page.waitForLoadState('load');
  expect(new URL(page.url()).pathname, `${label}: session ended (/company opens the login page)`).toBe('/auth/login');
}

async function logoutIfIn(page: Page) {
  if (await page.locator('a.btnLogout').isVisible()) {
    await page.locator('a.btnLogout').click();
    await page.waitForLoadState('load');
  }
}

test.describe('Login @login - login page and failed logins', () => {

  test(
    'Login page shows the expected labels, buttons and footer',
    testCase({ id: 'TC-AUTH-001', module: MODULE, priority: 'High', suite: ['smoke'] }),
    async ({ loginPage, page }) => {
      await loginPage.open();
      await test.step('Field Registry FR-AUTH-S01-001..006', async () => {
        await expect(page.getByText('System Portal Login', { exact: true }), 'heading "System Portal Login"').toBeVisible();
        await expect(loginPage.usernameInput, 'User ID input').toBeVisible();
        await expect(page.getByText('User ID', { exact: true }), 'label "User ID"').toBeVisible();
        await expect(loginPage.passwordInput, 'Password input').toBeVisible();
        await expect(loginPage.passwordInput, 'Password is masked').toHaveAttribute('type', 'password');
        await expect(page.getByText('Password', { exact: true }), 'label "Password"').toBeVisible();
        await expect(loginPage.submitButton, 'Submit').toHaveText(/^\s*Submit\s*$/);
        for (const line of FOOTER) await expect(page.getByText(line, { exact: true }), `footer "${line.slice(0, 30)}..."`).toBeVisible();
      });
      await test.step('No forgot-password link', async () => {
        await expect(page.locator('a', { hasText: /forgot|reset/i }), 'forgot-password link').toHaveCount(0);
      });
      await loginPage.captureStep('Login page');
    }
  );

  test(
    'Wrong password is rejected',
    testCase({ id: 'TC-AUTH-003', module: MODULE, priority: 'High' }),
    async ({ loginPage, consolePage, administratorPage: admin, browser }) => {
      // Test Data from this portal's sheet: APH TD-03 lockout user, Fassbayar TD-01 main user. One failed attempt,
      // then (when the password is known) a correct login right away resets the failed-attempt counter to 0.
      const td = AUTH.wrongPasswordUser;
      const u = td === 'TD-01' ? Credentials.username : AUTH.lockoutUser;
      const password = td === 'TD-01' ? Credentials.password : LOCKOUT_USER_PASSWORD;
      await loginAs({ loginPage, consolePage });
      await test.step(`Precondition: ${td} ${u} is Active`, async () => {
        const status = await bankUserStatus(admin, u);
        await admin.captureStep(`Manage Bank Users: ${u} is ${status || 'not found'}`);
        expect(status, `${u} exists`).not.toBe('');
        if (status === 'Suspended') {
          if (UAT_CHANGES_ALLOWED) await setBankUserAccess(admin, u, 'Reinstate', 'QA automation: reinstate lockout user before AUTH-003');
          else test.skip(true, `Precondition not met: ${u} (Test Data ${td}) is Suspended on the portal ` +
            `("Your account is suspended"). Reinstate it in Manage Bank Users, or run with ADM_ALLOW_UAT_CHANGES=true`);
        }
      });
      await otherBrowser(browser, async (p) => {
        const r = await attempt(p, u, WRONG_PASSWORD, `${td} ${u} + wrong password`);
        expect(r.loggedIn, 'not logged in').toBe(false);
        expect(new URL(r.url).pathname, 'stays on the login page').toBe('/auth/login');
        if (/suspended/i.test(r.message)) {
          test.info().annotations.push({ type: 'finding', description: `${td} ${u} is "Active" in Manage Bank Users but the login page ` +
            `says "${r.message}" (locked by earlier failed logins?): precondition "Active, 0 failed attempts" cannot be met` });
        }
        expect(r.message, 'message').toBe(BAD_CREDENTIALS);
        await expectNoSession(p, 'after the wrong password');
        if (password) {
          await test.step('Reset the failed-attempt counter: correct login, log out', async () => {
            expect((await attempt(p, u, password, 'Correct password (counter reset)')).loggedIn, `${u} logs in`).toBe(true);
            await logoutIfIn(p);
          });
        }
      });
    }
  );

  test(
    'Unknown User ID gets the same message as a wrong password',
    testCase({ id: 'TC-AUTH-004', module: MODULE, priority: 'Medium' }),
    async ({ page }) => {
      const r = await attempt(page, UNKNOWN_USER, WRONG_PASSWORD, `Unknown user ${UNKNOWN_USER}`);
      expect(r.loggedIn, 'not logged in').toBe(false);
      expect(r.message, 'same message as a wrong password (nothing reveals whether the user exists)').toBe(BAD_CREDENTIALS);
      await expectNoSession(page, 'after the unknown user');
    }
  );

  test(
    'Blank User ID or Password is blocked',
    testCase({ id: 'TC-AUTH-005', module: MODULE, priority: 'Medium' }),
    async ({ page }) => {
      for (const [label, user, password] of [['User ID blank', '', WRONG_PASSWORD], ['Password blank', UNKNOWN_USER, ''], ['both blank', '', '']] as const) {
        await test.step(label, async () => {
          const r = await attempt(page, user, password, label);
          expect(r.loggedIn, `${label}: not logged in`).toBe(false);
          expect(r.message, `${label}: rejected with a message`).toBe(BAD_CREDENTIALS);
          await expectNoSession(page, label);
        });
      }
    }
  );

  // Sheet: "Run this case before AUTH lockout" -> before TC-AUTH-006
  test(
    'Failed-attempt counter resets after a successful login',
    testCase({ id: 'TC-AUTH-007', module: MODULE, priority: 'Medium' }),
    async ({ page }) => {
      needLockoutPassword();
      const u = AUTH.lockoutUser;
      await test.step('Start from 0 failed attempts: correct login, log out', async () => {
        expect((await attempt(page, u, LOCKOUT_USER_PASSWORD, 'Correct password')).loggedIn, `${u} logs in (Active)`).toBe(true);
        await logoutIfIn(page);
      });
      for (const round of [1, 2]) {
        await test.step(`Round ${round}: wrong password twice, then the correct one`, async () => {
          for (const n of [1, 2]) {
            const r = await attempt(page, u, WRONG_PASSWORD, `Round ${round}, wrong password ${n}`);
            expect(r.message, `round ${round}, wrong password ${n}: "${BAD_CREDENTIALS}" (not suspended)`).toBe(BAD_CREDENTIALS);
          }
          const ok = await attempt(page, u, LOCKOUT_USER_PASSWORD, `Round ${round}, correct password`);
          expect(ok.loggedIn, `round ${round}: correct password logs in (account not suspended, counter reset)`).toBe(true);
          await logoutIfIn(page);
        });
      }
    }
  );

  test(
    'Account is suspended after 3 consecutive failed logins',
    testCase({ id: 'TC-AUTH-006', module: MODULE, priority: 'High' }),
    async ({ page, loginPage, consolePage, administratorPage: admin, browser }) => {
      const u = AUTH.lockoutUser;
      requireUatChanges(`suspends the lockout user ${u} with 3 wrong passwords, then reinstates it`);
      needLockoutPassword();
      await loginAs({ loginPage, consolePage });
      await test.step(`Precondition: ${u} is Active with 0 failed attempts`, async () => {
        if ((await bankUserStatus(admin, u)) === 'Suspended') await setBankUserAccess(admin, u, 'Reinstate', 'QA automation: reinstate lockout user before AUTH-006');
        await otherBrowser(browser, async (p) => {
          expect((await attempt(p, u, LOCKOUT_USER_PASSWORD, 'Correct password (0 failed attempts)')).loggedIn, `${u} logs in`).toBe(true);
          await logoutIfIn(p);
        });
      });
      try {
        await otherBrowser(browser, async (p) => {
          let third = '';
          await test.step('Wrong password 3 times', async () => {
            for (const n of [1, 2, 3]) {
              const r = await attempt(p, u, WRONG_PASSWORD, `Wrong password ${n}`);
              expect(r.loggedIn, `wrong password ${n}: not logged in`).toBe(false);
              if (n === 3) third = r.message;
            }
            expect.soft(third, 'after the 3rd failure: the suspended-account error (not the normal wrong-password message)').not.toBe(BAD_CREDENTIALS);
            expect.soft(third, 'after the 3rd failure: suspended-account error').toMatch(/suspend|lock/i);
          });
          await test.step('The correct password is then refused', async () => {
            const r = await attempt(p, u, LOCKOUT_USER_PASSWORD, 'Correct password after 3 failures');
            expect.soft(r.loggedIn, 'correct password refused (account suspended)').toBe(false);
            await logoutIfIn(p);
          });
        });
        await test.step(`Manage Bank Users: ${u} has status Suspended`, async () => {
          expect.soft(await bankUserStatus(admin, u), `${u} status`).toBe('Suspended');
          await admin.captureStep(`Manage Bank Users: ${u}`);
        });
      } finally {
        await test.step(`Reinstate ${u} (Test Data: TD-01 reinstates it after the run)`, async () => {
          if ((await bankUserStatus(admin, u)) === 'Suspended') await setBankUserAccess(admin, u, 'Reinstate', 'QA automation: reinstate lockout user after AUTH-006');
        });
      }
    }
  );
});

test.describe('Login @login - login, session and logout', () => {

  test(
    'Login with valid bank user credentials opens Home',
    testCase({ id: 'TC-AUTH-002', module: MODULE, priority: 'High', suite: ['smoke'] }),
    async ({ loginPage, consolePage, administratorPage: admin, page }) => {
      await loginAs({ loginPage, consolePage });
      await test.step('Home: greeting, last login, menu of a Super Admin', async () => {
        expect(new URL(page.url()).pathname, 'Home opens').toBe('/console');
        const header = sp(await page.locator('body').innerText());
        expect(header, 'greeting').toContain(`Good Day, ${Credentials.username}`);
        expect(header, '"Your last log in was ..."').toMatch(/Your last log in was \w+day, \d{2} \w{3} \d{4} \d{2}:\d{2}/);
        const menu = (await page.locator('#topNavi a').allInnerTexts()).map(sp).filter(Boolean);
        expect(menu, 'menu matches the role (Super Admin: every menu)').toEqual(TOP_MENU);
        if (PORTAL_PROFILE.home.dailySnapshot) await expect(page.getByText('Daily Transaction Snapshot'), 'Daily Transaction Snapshot (Fassbayar)').toBeVisible();
        await consolePage.captureScreen('Home after login');
      });
      await test.step('Audit Trail: "Login to System" by this user today', async () => {
        await admin.openQuicklink('Audit Trail');
        await admin.setDate('from', portalDate());                  // today only (3 months of logins is slow)
        await admin.filter({ action: 'Login to System' });
        const rows = (await admin.rows.allInnerTexts()).map(sp);
        const [d, m, y] = portalToday().split(' ');
        const today = new RegExp(`${d} ${m} ${y}|${d}/\\d{2}/${y}|${y}-\\d{2}-${d}`);
        expect(rows.some((r) => r.toLowerCase().includes(Credentials.username.toLowerCase()) && /Login to System/.test(r) && today.test(r)),
          `Audit Trail has "Login to System" by ${Credentials.username} today (${portalToday()})`).toBe(true);
        await admin.captureScreen('Audit Trail - Login to System');
      });
    }
  );

  test(
    'Idle session warns, then signs out after 15 minutes',
    testCase({ id: 'TC-AUTH-010', module: MODULE, priority: 'Medium' }),
    async ({ loginPage, consolePage, page }) => {
      // REAL idle time (about 16 minutes), as the sheet's steps: the server session must really be idle for 15 minutes.
      // (Fast-forwarding only the page clock leaves the server session fresh, so it cannot show the 15-minute sign-out.)
      test.setTimeout(22 * 60_000);
      await loginAs({ loginPage, consolePage });
      await page.goto('/console');
      await page.waitForLoadState('load');
      const idleSince = Date.now();
      const minutes = () => ((Date.now() - idleSince) / 60_000).toFixed(1);
      const dialog = page.locator('.ui-dialog', { hasText: 'Your session is about to expire' });
      await test.step('1. Stay idle on Home; 2. "Your session is about to expire" appears before expiry', async () => {
        await expect(dialog, 'timeout dialog appears while idle').toBeVisible({ timeout: 15 * 60_000 });
        const shownAfter = (Date.now() - idleSince) / 1000;
        await consolePage.captureStep(`Session timeout dialog after ${minutes()} min idle`);
        expect(shownAfter, `dialog appears before the 15-minute expiry (after ${minutes()} min)`).toBeLessThan(15 * 60);
        await expect(dialog.locator('.btnNo'), 'FR-XCUT-S01 "No, sign me out"').toHaveText('No, sign me out');
        await expect(dialog.locator('.btnYes'), 'FR-XCUT-S01 "Yes, keep me signed in"').toHaveText('Yes, keep me signed in');
      });
      await test.step('Do nothing; 3. click a menu item after 15 minutes: login page', async () => {
        const left = idleSince + 15.5 * 60_000 - Date.now();
        if (left > 0) await page.waitForTimeout(left);
        const where = new URL(page.url()).pathname;
        await consolePage.captureStep(`After ${minutes()} min idle, before the click: on ${where}`);
        const menu = page.locator('#topNavi a[href="/company"]');                // top menu "All Companies"
        if (await menu.isVisible()) {
          await menu.click();
          await page.waitForLoadState('load');
        }
        await consolePage.captureStep(`After ${minutes()} min idle: menu "All Companies" clicked`);
        expect(new URL(page.url()).pathname, `after 15 minutes idle the next request goes to the login page`).toBe('/auth/login');
      });
    }
  );

  test(
    '"Yes, keep me signed in" keeps the session; "No, sign me out" logs out',
    testCase({ id: 'TC-AUTH-011', module: MODULE, priority: 'Medium' }),
    async ({ loginPage, consolePage, page }) => {
      // REAL waiting, as the sheet's steps (about 14.5 minutes for each dialog, about 30 minutes in all)
      test.setTimeout(40 * 60_000);
      await loginAs({ loginPage, consolePage });
      await page.goto('/console');
      await page.waitForLoadState('load');
      const dialog = page.locator('.ui-dialog', { hasText: 'Your session is about to expire' });
      const waitForDialog = async (label: string) => {
        const since = Date.now();
        await expect(dialog, `${label}: timeout dialog appears while idle`).toBeVisible({ timeout: 17 * 60_000 });   // dialog at 14.5 min after the page's last load; slow loads need room
        await consolePage.captureStep(`${label}: dialog after ${((Date.now() - since) / 60_000).toFixed(1)} min idle`);
      };
      await test.step('1. Wait for the timeout dialog, click "Yes, keep me signed in": session continues', async () => {
        await waitForDialog('First wait');
        const reloaded = page.waitForEvent('framenavigated', { timeout: 30_000 }).catch(() => null);
        await dialog.locator('.btnYes').click();
        await reloaded;
        await page.waitForLoadState('load');
        await expect(page.locator('a.btnLogout'), 'still logged in').toBeVisible();
        expect(new URL(page.url()).pathname, 'back on Home').toBe('/console');
        await expect(dialog, 'dialog closed').toBeHidden();
        await consolePage.captureStep('After "Yes, keep me signed in"');
      });
      await test.step('2. Wait for it again, click "No, sign me out": login page', async () => {
        await waitForDialog('Second wait');
        await expectSignedOut(page, () => dialog.locator('.btnNo').click(), 'After "No, sign me out"');
      });
    }
  );

  test(
    'Logout ends the session',
    testCase({ id: 'TC-AUTH-012', module: MODULE, priority: 'High' }),
    async ({ loginPage, consolePage, page }) => {
      await loginAs({ loginPage, consolePage });
      await page.goto('/company');
      await test.step('Click LOGOUT: login page', async () => {
        await consolePage.logout();
        await loginPage.verifyLoginPage();
        expect(new URL(page.url()).pathname, 'login page').toBe('/auth/login');
        await loginPage.captureStep('After LOGOUT');
      });
      await test.step('Back: no protected page', async () => {
        await page.goBack().catch(() => {});
        await page.waitForLoadState('load');
        expect(new URL(page.url()).pathname, 'Back stays on the login page').toBe('/auth/login');
        await expect(page.locator('a.btnLogout'), 'no logged-in page after Back').toBeHidden();
        await loginPage.captureStep('After Back');
      });
      await test.step('Pasted protected URL (/company): login page', async () => {
        await expectNoSession(page, 'pasted /company after logout');
      });
    }
  );

  test(
    'Second login by the same user ends the first session',
    testCase({ id: 'TC-AUTH-013', module: MODULE, priority: 'Medium' }),
    async ({ loginPage, consolePage, page, browser }) => {
      await loginAs({ loginPage, consolePage });
      await otherBrowser(browser, async (b) => {
        await test.step(`Browser B: log in again as ${Credentials.username}`, async () => {
          expect((await attempt(b, Credentials.username, Credentials.password, 'Browser B login')).loggedIn, 'browser B works').toBe(true);
        });
        await test.step('Browser A: click a menu item -> old session ended, login page', async () => {
          await page.locator('#topNavi a[href="/company"]').click();   // top menu: All Companies (text is All<br>Companies)
          await page.waitForLoadState('load');
          expect(new URL(page.url()).pathname, 'browser A is sent to the login page').toBe('/auth/login');
          expect(await loginMessage(page), 'browser A message').toBe(CONCURRENT);
          await loginPage.captureStep('Browser A after the second login');
        });
        await test.step('Browser B still works', async () => {
          await b.goto('/company');
          await b.waitForLoadState('load');
          expect(new URL(b.url()).pathname, 'browser B opens All Companies (still logged in)').toMatch(/^\/company/);
          await logoutIfIn(b);
        });
      });
    }
  );
});

test.describe('Login @login - access denied', () => {

  test(
    'Access-denied page when the role lacks permission',
    testCase({ id: 'TC-AUTH-017', module: MODULE, priority: 'High' }),
    async ({ loginPage, consolePage, page }) => {
      test.skip(!VIEWER_PASSWORD, `Human action required: the password of the Viewer ${AUTH.viewerUser} (Test Data TD-02) is needed; ` +
        `put it in .env as ${ENV_KEY}_VIEWER_PASSWORD`);
      await loginAs({ loginPage, consolePage }, AUTH.viewerUser, VIEWER_PASSWORD);
      await page.goto('/admin/register');
      await page.waitForLoadState('load');
      const body = sp(await page.locator('body').innerText());
      await consolePage.captureStep(`Viewer ${AUTH.viewerUser} opens /admin/register`);
      expect(body, '"Access Denied" page').toContain('Access Denied');
      await expect(page.locator('[name="userId"], [name="email"]'), 'the Add a Bank User form is not shown').toHaveCount(0);
      expect(body, 'no stack trace').not.toMatch(/Exception|stack ?trace|at [a-z]+\.[a-z.]+\(/i);
    }
  );
});

test.describe('Login @login - mailbox cases (human action)', () => {
  const MAILBOX = 'the activation / reset email in the TD-18 test mailbox';

  test(
    'Pending-activation bank user cannot log in before activating',
    testCase({ id: 'TC-AUTH-009', module: MODULE, priority: 'Medium', manual: [{
      title: 'Pending-activation bank user cannot log in before activating', reason: `Needs ${MAILBOX} (sheet: HAR).`,
      handling: 'Add a bank user; log in before activating (refused); activate with the 6-digit code from the email and a compliant password; log in (works). Check the email against NTF-01.' }] }),
    async () => { humanAction(`${MAILBOX} (sheet: HAR)`); }
  );

  test(
    'Password rule: 12-20 characters with digit, lower, upper and special',
    testCase({ id: 'TC-AUTH-014', module: MODULE, priority: 'Medium', manual: [{
      title: 'Password rule 12-20 characters with digit, lower, upper and special', reason: `Needs a reset / activation link from ${MAILBOX} (sheet: HAR).`,
      handling: 'On the reset page try 11 and 21 characters, no upper, no lower, no digit, no special (rejected with the password message); 12, 20 and a password with \'*\' (accepted; \'*\' is rejected today: OQ-APH-13 / OQ-FB-06).' }] }),
    async () => { humanAction(`${MAILBOX} (sheet: HAR)`); }
  );

  test(
    'One of the last 5 passwords cannot be reused',
    testCase({ id: 'TC-AUTH-015', module: MODULE, priority: 'Low', manual: [{
      title: 'One of the last 5 passwords cannot be reused', reason: `Needs a reset link from ${MAILBOX} (sheet: HAR).`,
      handling: 'On the reset page enter one of the last 5 passwords: "Please choose a password that you haven\'t used before"; password unchanged.' }] }),
    async () => { humanAction(`${MAILBOX} (sheet: HAR)`); }
  );

  test(
    'Admin password reset email lets the user set a new password once',
    testCase({ id: 'TC-AUTH-016', module: MODULE, priority: 'Medium', manual: [{
      title: 'Admin password reset email lets the user set a new password once', reason: `Needs ${MAILBOX} (sheet: HAR).`,
      handling: 'Reset Password on a disposable bank user; set a new password from the email link (works); open the same link again ("Not a Valid Link"); an expired link is refused. Check the email against NTF-02.' }] }),
    async () => { humanAction(`${MAILBOX} (sheet: HAR)`); }
  );
});
