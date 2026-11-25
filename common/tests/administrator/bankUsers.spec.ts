import { test, expect } from '../../fixtures/base';
import type { Locator } from '@playwright/test';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { BASE_URL, Credentials, ENV_NAME, IGNORE_HTTPS_ERRORS, PORTAL_PROFILE, TEST_BANK_USER_PASSWORD } from '../../../portals.config';
import { LoginPage } from '../../pages/LoginPage';
import { bankUserRow, setBankUserAccess } from '../../flows/bankUserFlow';
import { ADMIN_QUICKLINKS, portalDate, type AdministratorPage } from '../../pages/AdministratorPage';
import { letters, digits } from '../../utils/random';
import { requireUatChanges, stopBeforeSaving, TEST_BANK_USER, TEST_EMAIL, UAT_PREVIEW, UAT_CHANGES_ALLOWED } from '../../utils/uatChanges';

// Administrator > Manage Bank Users / Add a Bank User / Bank User Details / Suspend / Reinstate.
// Written from the APH baseline sheet (TC-APH-BP-ADM-001 ... 009, 018, 020 ... 023) and the portal
// (explore/scan/administrator.scan.ts, 23 Nov 2026). Only on portals with the screen (features.bankUsers).
// Read-only unless ADM_ALLOW_UAT_CHANGES=true: forms are Submitted (= validation / Review) and left with
// Back; Confirm is never clicked; Suspend / Reinstate validation runs without Submit (validateInput1).
// Sheet expectations that the portal does not meet are soft checks: the test fails and lists them.
// Run only this file:  npx playwright test common/tests/administrator/bankUsers.spec.ts

const MODULE = 'Administrator';
const OWN = Credentials.username;
// Sheet / Field Registry (FR-ADM-S01 / S02 / S06 / S07, OPT_ROLE_FILTER, OPT_ROLE_ASSIGN)
const ROLE_FILTER = ['Select One', 'Super Admin', 'Security Admin', 'Admin', 'Viewer', 'Reader Provisioner', 'Fraud User'];
const ROLE_ASSIGN = ['Security Admin', 'Admin', 'Viewer', 'Reader Provisioner', 'Fraud User'];
const STATUS_FILTER_SHEET = ['Select One', 'Active', 'Suspended'];
// "Resigned" (status filter, suspend reason) is not tested: QA Lead decision OQ-APH-23 (22 Nov 2026,
// "remove resign test cases"). It is left out of the comparison and noted in the report instead.
const withoutResigned = (options: string[]): string[] => {
  if (options.includes('Resigned')) test.info().annotations.push({ type: 'finding', description: '"Resigned" shown; not tested (QA Lead OQ-APH-23)' });
  return options.filter((o) => o !== 'Resigned');
};
// "Failover Operator" (Fassbayar only) does not affect the bank-user cases (user decision 25 Nov 2026): it is left
// out of the Role list comparisons (ADM-001, 002, 020, 022) and noted in the report instead of failing the test.
const withoutFailover = (options: string[], where: string): string[] => {
  if (options.includes('Failover Operator')) test.info().annotations.push({ type: 'finding', description: `"Failover Operator" in the ${where}: not compared (Fassbayar role; does not affect this case)` });
  return options.filter((o) => o !== 'Failover Operator');
};
const COLUMNS = ['User ID', 'Role', 'Status', 'Created Date', 'Quicklink'];
const uniqueUserId = (len: number) => `qa${letters(1)}${digits(len - 3)}`.slice(0, len);   // \w only, 3-20

// First user row in the list that is not the logged-in account (optionally with a status filter)
async function otherUserRow(admin: AdministratorPage, status?: string): Promise<Locator | null> {
  await admin.openQuicklink('Manage Bank Users');
  if (status) await admin.filter({ status });
  const row = admin.rows.filter({ hasNotText: new RegExp(`^\\s*${OWN}\\b`) }).first();
  return (await row.count()) ? row : null;
}

// Test bank users. First choice: the user the workbook's Test Data sheet names for the case
// (portals.config.ts administrator.*; ADM_TEST_BANK_USER overrides). Those are used as they are: never
// created or edited here (apart from what the case itself does). Not named yet -> the automation's own
// dummy users, created once (Viewer) and reused; bank users cannot be deleted. Dummy email = the team
// test mailbox (ADM_TEST_EMAIL), else <id>@example.com.
//   DUMMY_USER: edit / suspend / log in as it. RESET_USER: Reset Password target (kept apart because a
//   reset makes the user set a new password, which would break ADM-018's login).
const DUMMY_USER = 'qaautotest01';
const RESET_USER = 'qaautotest02';
const SHEET = PORTAL_PROFILE.administrator;

// Find / suspend / reinstate a bank user: shared with the Login (AUTH) tests (common/flows/bankUserFlow.ts)
const dummyUserRow = bankUserRow;
const setAccess = setBankUserAccess;

// A user named in the Test Data sheet: must exist, used as it is
async function sheetUser(admin: AdministratorPage, id: string): Promise<string> {
  const found = await (await dummyUserRow(admin, id)).count();
  expect(found, `Test Data user ${id} exists on ${ENV_NAME}`).toBeGreaterThan(0);
  return id;
}

// The sheet's user for this purpose, else the automation's own dummy user
async function caseUser(admin: AdministratorPage, sheetId: string, dummy: string): Promise<string> {
  return sheetId ? sheetUser(admin, sheetId) : ensureUser(admin, dummy);
}

// The dummy user, created if missing; its email moved to the test mailbox if it still has another one
async function ensureUser(admin: AdministratorPage, id: string): Promise<string> {
  const email = TEST_EMAIL || `${id}@example.com`;
  if (!(await (await dummyUserRow(admin, id)).count())) {
    await test.step(`Create the automation's dummy bank user ${id} (once; reused on later runs)`, async () => {
      await admin.openQuicklink('Add a Bank User');
      await admin.fill({ userId: id, name: 'QA Automation Test', role: 'Viewer', email });
      await admin.submit();
      await admin.confirm();
      await expect(admin.main).toContainText(/success/i);
    });
    return id;
  }
  if (TEST_EMAIL) {
    await admin.quicklinkGo(await dummyUserRow(admin, id), 'View Details');
    await admin.clickButton('Edit Bank User Details');
    if ((await admin.input('email').inputValue()).trim().toLowerCase() !== TEST_EMAIL.toLowerCase()) {
      await test.step(`Move ${id}'s email to the test mailbox`, async () => {
        await admin.clear(['email']);
        await admin.fill({ email: TEST_EMAIL });
        await admin.submit();
        await admin.confirm();
        await expect(admin.main).toContainText('Your request is successful');
      });
    }
  }
  return id;
}

async function testBankUser(admin: AdministratorPage): Promise<string> {
  if (TEST_BANK_USER) return TEST_BANK_USER;
  if (UAT_CHANGES_ALLOWED) return caseUser(admin, SHEET.testBankUser, DUMMY_USER);
  if (!UAT_PREVIEW) return '';
  const row = await otherUserRow(admin, 'Active');        // preview: nothing is saved, any other active user will do
  return row ? (await row.locator('td').first().innerText()).trim() : '';
}

if (PORTAL_PROFILE.features.bankUsers) {
  test.describe('Administrator > Bank Users @administrator', () => {

    test.beforeEach(async ({ loginPage, consolePage }) => {
      await loginAs({ loginPage, consolePage });
    });

    test(
      'Manage Bank Users shows search, filters, columns, Quicklink and export',
      testCase({ id: 'TC-ADM-001', module: MODULE, priority: 'High', suite: ['smoke'] }),
      async ({ administratorPage: admin }) => {
        await test.step('Open Administrator > Manage Bank Users', async () => {
          await admin.openQuicklink('Manage Bank Users');
          await expect(admin.title).toHaveText('All Users');
          const expected = ADMIN_QUICKLINKS.filter((q) => q !== 'Host Settings' || PORTAL_PROFILE.features.hostSettings);
          expect.soft((await admin.quicklinks.allInnerTexts()).map((t) => t.trim()), 'Administrator quicklinks').toEqual(expected);
        });
        await test.step('Search box, Role, Status, Date filters', async () => {
          await expect(admin.searchBox).toHaveValue('User ID');
          await admin.captureOptions('role', 'Role filter (Manage Bank Users)', ROLE_FILTER);
          await admin.captureOptions('status', 'Status filter (Manage Bank Users)', STATUS_FILTER_SHEET);
          expect.soft(withoutFailover(await admin.options('role'), 'Role filter'), 'Role filter (OPT_ROLE_FILTER)').toEqual(ROLE_FILTER);
          expect.soft(withoutResigned(await admin.options('status')), 'Status filter (sheet: Active / Suspended)').toEqual(STATUS_FILTER_SHEET);
          await expect(admin.input('from', admin.filterForm)).toHaveValue(portalDate({ years: -10 }));
          await expect(admin.input('to', admin.filterForm)).toHaveValue(portalDate());
        });
        await test.step('Columns and Quicklink (View Details, Suspend Bank User Access)', async () => {
          await admin.expectColumns(COLUMNS);
          const row = admin.rows.filter({ hasText: 'Active' }).filter({ hasNotText: new RegExp(`^\\s*${OWN}\\b`) }).first();
          expect(await admin.quicklinkOptions(row)).toEqual(['View Details', 'Suspend Bank User Access']);
          await expect(admin.button('Export to CSV')).toBeVisible();
          await admin.captureScreen('Manage Bank Users');
        });
      }
    );

    test(
      'Add a bank user for each assignable role',
      testCase({ id: 'TC-ADM-002', module: MODULE, priority: 'High', manual: [{
        title: 'Activation email of each new bank user', reason: 'The email arrives in a mailbox automation cannot read.',
        handling: 'Check the activation emails by hand after a run with ADM_ALLOW_UAT_CHANGES=true.' }] }),
      async ({ administratorPage: admin }) => {
        requireUatChanges('creates a new bank user for every role; bank users cannot be deleted');
        for (const role of ROLE_ASSIGN) {
          await test.step(`Add a Bank User with role ${role} -> Submit -> Confirm`, async () => {
            await admin.openQuicklink('Add a Bank User');
            const roles = await admin.options('role');
            if (role === ROLE_ASSIGN[0]) await admin.captureOptions('role', 'Role (Add a Bank User)', ROLE_ASSIGN);
            expect(roles, 'Super Admin not offered').not.toContain('Super Admin');
            if (role === ROLE_ASSIGN[0]) expect.soft(withoutFailover(roles, 'Role list'), 'Role list (OPT_ROLE_ASSIGN)').toEqual(ROLE_ASSIGN);
            const id = uniqueUserId(12);
            await admin.fill({ userId: id, name: `QA ${role}`.slice(0, 20), role, email: `${id}@example.com` });
            await admin.submit();
            expect(await admin.reviewShown(), 'Review & Confirm').toBe(true);
            await admin.confirm();
            await expect(admin.main).toContainText(/success/i);
            await admin.captureScreen(`Bank user ${id} (${role}) added`);
          });
        }
      }
    );

    test(
      'Bank user validation: User ID 3-20, Name 3-20, email; duplicate User ID',
      testCase({ id: 'TC-ADM-003', module: MODULE, priority: 'Low' }),
      async ({ administratorPage: admin }) => {
        const valid = { name: 'QA Validation', email: 'qa.adm.validation@example.com' };
        const tryUser = async (userId: string, name = valid.name, email = valid.email) => {
          await admin.openQuicklink('Add a Bank User');
          await admin.fill({ userId, name, email });
          await admin.submit();
          const errors = await admin.visibleErrors();
          await admin.backFromReview();          // never confirmed
          return errors;
        };
        await test.step('Hints: "Between 3-20 Alphanumeric characters" and "Between 3-20 characters"', async () => {
          await admin.openQuicklink('Add a Bank User');
          await expect(admin.main).toContainText(/Between 3-20 Alphanumeric characters/);
          await expect(admin.main).toContainText(/Between 3-20 characters/);
        });
        await test.step('User ID 2 chars / with "-" / "a b!" rejected; 3 and 20 accepted; 21 cut to 20', async () => {
          expect((await tryUser('ab')).userIdError).toBe('Please enter valid User ID');
          expect((await tryUser('ab-cd')).userIdError).toBe('Please enter valid User ID');
          expect((await tryUser('a b!')).userIdError).toBe('Please enter valid User ID');
          // a random ID can already exist (more users every run): try another one on "Duplicated"
          const acceptedId = async (len: number) => {
            let err: string | undefined = 'Duplicated. Not Available';
            for (let i = 0; i < 5 && err === 'Duplicated. Not Available'; i++) err = (await tryUser(len === 3 ? letters(3) : uniqueUserId(len))).userIdError;
            return err;
          };
          const three = await acceptedId(3);
          if (three === 'Please enter valid User ID') {
            // checked by hand 25 Nov 2026 (explore/scan/buid.scan.ts): every 3-char ID refused on Fassbayar, 4 accepted
            test.info().annotations.push({ type: 'finding', description: 'A 3-character User ID is refused on Submit: the page checks the ' +
              'User ID on Submit with regex_muid (Mobile User ID rule, min 4) instead of regex_buid (min 3). Sheet / QA Lead: 3-20' });
          }
          expect.soft(three, 'User ID 3 chars accepted (page validates with the Mobile User ID rule, min 4)').toBeUndefined();
          expect.soft(await acceptedId(20), 'User ID 20 chars accepted').toBeUndefined();
          await admin.openQuicklink('Add a Bank User');
          await admin.fill({ userId: 'q' + digits(20) });
          expect((await admin.input('userId').inputValue()).length, '21st character not taken').toBe(20);
        });
        await test.step(`Existing User ID (${OWN}) refused: "Duplicated. Not Available"`, async () => {
          expect((await tryUser(OWN)).userIdError).toBe('Duplicated. Not Available');
        });
        await test.step('Name 2 rejected; 3 and 20 accepted; 21 cut to 20; email "x@" rejected', async () => {
          expect((await tryUser(uniqueUserId(10), 'ab')).nameError).toBe('Please enter valid Name');
          expect.soft((await tryUser(uniqueUserId(10), 'abc')).nameError, 'Name 3 chars accepted').toBeUndefined();
          expect.soft((await tryUser(uniqueUserId(10), 'abcdefghijklmnopqrst')).nameError, 'Name 20 chars accepted').toBeUndefined();
          await admin.openQuicklink('Add a Bank User');
          await admin.fill({ name: 'abcdefghijklmnopqrstu' });
          expect((await admin.input('name').inputValue()).length, '21st character not taken').toBe(20);
          expect((await tryUser(uniqueUserId(10), valid.name, 'x@')).emailError).toBe('Please enter valid Email');
          await admin.captureScreen('Add a Bank User - validation');
        });
      }
    );

    test(
      'Bank User Details and Edit (name, role)',
      testCase({ id: 'TC-ADM-004', module: MODULE, priority: 'Medium', manual: [{
        title: 'Edited bank user: new role applies on next login', reason: 'Needs the test user\'s own password (activation email).',
        handling: 'Log in as the edited test user by hand and check the new role.' }] }),
      async ({ administratorPage: admin }) => {
        requireUatChanges('edits the name and role of a test bank user');
        const user = await testBankUser(admin);
        test.skip(!user, 'No disposable test bank user: set ADM_TEST_BANK_USER in .env');
        await admin.openQuicklink('Manage Bank Users');
        await admin.search(user);
        await admin.quicklinkGo(admin.rows.first(), 'View Details');
        await expect(admin.main).toContainText(`User ID: ${user}`);
        await admin.clickButton('Edit Bank User Details');
        const name = `QA Edited ${digits(4)}`;
        await admin.fill({ name, role: 'Viewer' });
        await admin.submit();
        await admin.confirm();
        await expect(admin.main).toContainText('Your request is successful');
        // the Complete page shows User ID and Role only: check the new Name / Role on Bank User Details
        await admin.quicklinkGo(await dummyUserRow(admin, user), 'View Details');
        await expect(admin.main).toContainText(name);
        await expect(admin.main).toContainText('Viewer');
        await admin.captureScreen('Bank user edited');
      }
    );

    test(
      'Suspend Bank User Access form shows the expected fields',
      testCase({ id: 'TC-ADM-005', module: MODULE, priority: 'High' }),
      async ({ administratorPage: admin }) => {
        const row = await otherUserRow(admin, 'Active');
        test.skip(!row, `No active bank user other than ${OWN} on ${ENV_NAME}`);
        const userId = (await row!.locator('td').first().innerText()).trim();
        await test.step(`Open Suspend Bank User Access for ${userId} (not submitted)`, async () => {
          await admin.quicklinkGo(row!, 'Suspend Bank User Access');
          await expect(admin.main).toContainText('You are currently viewing');
          await expect(admin.main).toContainText(new RegExp(`User ID\\s*:\\s*${userId}`));
          await expect(admin.button('View Bank User Details')).toBeVisible();
          await expect(admin.title).toHaveText('Suspend Bank User Access');
          expect(await admin.steps.allInnerTexts()).toEqual(['Details', 'Complete']);
          await expect(admin.main).toContainText(new RegExp(`Effective Date\\s*:\\s*${portalDate()}`));
        });
        await test.step('Reason list, remarks counter, Submit', async () => {
          expect.soft(withoutResigned(await admin.options('reason')), 'Reason options (sheet: Others)').toEqual(['Others']);
          await expect(admin.main).toContainText(/Max characters:\s*250/);
          expect(await admin.remaining()).toBe('250');
          await expect(admin.button('Submit')).toBeVisible();
          await admin.captureScreen('Suspend Bank User Access form');
        });
        await test.step('Reinstate form: Reason = Reinstate only', async () => {
          const suspended = await otherUserRow(admin, 'Suspended');
          test.skip(!suspended, 'No suspended bank user to open the Reinstate form on');
          await admin.quicklinkGo(suspended!, 'Reinstate Bank User Access');
          await expect(admin.title).toHaveText('Reinstate Bank User Access');
          expect(await admin.options('reason')).toEqual(['Reinstate']);
          await admin.captureScreen('Reinstate Bank User Access form');
        });
      }
    );

    test(
      'Suspend Bank User Access with reason and remarks, then reinstate',
      testCase({ id: 'TC-ADM-006', module: MODULE, priority: 'High' }),
      async ({ administratorPage: admin }) => {
        requireUatChanges('suspends and then reinstates a test bank user');
        const user = await testBankUser(admin);
        test.skip(!user, 'No disposable test bank user: set ADM_TEST_BANK_USER in .env');
        const open = () => dummyUserRow(admin, user);
        // a run that stopped half-way can leave the user suspended: reinstate it first
        if (!UAT_PREVIEW && /Suspended/.test(await (await open()).innerText())) {
          await test.step(`${user} was left Suspended by an earlier run: reinstate first`, async () => {
            await admin.quicklinkGo(await open(), 'Reinstate Bank User Access');
            await admin.fillCounted('description', 'QA automation: reinstate before test');
            await admin.button('Submit').click();
            await admin.page.waitForLoadState('load');
          });
        }
        await test.step('Suspend: Reason Others, remarks "QA baseline suspend"', async () => {
          await admin.quicklinkGo(await open(), 'Suspend Bank User Access');
          await admin.fill({ reason: 'Others', description: 'QA baseline suspend' });
          await stopBeforeSaving(admin, `Suspend Submit for ${user} (Submit saves at once)`);
          await admin.button('Submit').click();
          await admin.page.waitForLoadState('load');
          await expect((await open()).locator('td').nth(2)).toHaveText('Suspended');
        });
        await test.step('Status History shows the suspension', async () => {
          await admin.quicklinkGo(await open(), 'View Details');
          const frame = await admin.openPopup('Status History');
          expect(await admin.popupText(frame)).toContain('QA baseline suspend');
          await admin.closePopup();
        });
        await test.step('Reinstate: Reason Reinstate, remarks "QA baseline reinstate"', async () => {
          await admin.quicklinkGo(await open(), 'Reinstate Bank User Access');
          await admin.fill({ description: 'QA baseline reinstate' });
          await admin.button('Submit').click();
          await admin.page.waitForLoadState('load');
          await expect((await open()).locator('td').nth(2)).toHaveText('Active');
          await admin.captureScreen('Test bank user reinstated');
        });
      }
    );

    test(
      'Suspend Bank User Access: remarks limit and counter',
      testCase({ id: 'TC-ADM-007', module: MODULE, priority: 'Low' }),
      async ({ administratorPage: admin }) => {
        const row = await otherUserRow(admin, 'Active');
        test.skip(!row, `No active bank user other than ${OWN} on ${ENV_NAME}`);
        await admin.quicklinkGo(row!, 'Suspend Bank User Access');
        await test.step('10 characters -> "240 remaining"', async () => {
          await admin.input('description').pressSequentially('abcdefghij');
          expect(await admin.remaining()).toBe('240');
        });
        await test.step('251 characters -> stops at 250', async () => {
          await admin.input('description').fill('x'.repeat(251));
          expect((await admin.input('description').inputValue()).length).toBe(250);
        });
        await test.step('Empty remarks rejected (checked without Submit)', async () => {
          await admin.input('description').fill('');
          expect(await admin.validateWithoutSubmit(), 'form refuses to submit').toBe(false);
          await expect(admin.error('descriptionError')).toHaveText('Please enter a short description');
          await admin.captureScreen('Suspend remarks validation');
        });
      }
    );

    test(
      'Bank user cannot suspend their own account',
      testCase({ id: 'TC-ADM-008', module: MODULE, priority: 'Low' }),
      async ({ administratorPage: admin }) => {
        await admin.openQuicklink('Manage Bank Users');
        await admin.search(OWN);
        const own = admin.rows.filter({ hasText: new RegExp(`^\\s*${OWN}\\b`) }).first();
        await test.step(`Own row (${OWN}): Quicklink has no Suspend`, async () => {
          expect(await admin.quicklinkOptions(own)).toEqual(['View Details']);
        });
        await test.step('Own Bank User Details: no Suspend Bank User Access (button hidden)', async () => {
          await admin.quicklinkGo(own, 'View Details');
          await expect(admin.main).toContainText(`User ID: ${OWN}`);
          await expect(admin.button('Suspend Bank User Access')).toHaveCount(0);
          await admin.captureScreen('Own bank user details - no suspend');
        });
      }
    );

    test(
      'Reset Password pop-up and email',
      testCase({ id: 'TC-ADM-009', module: MODULE, priority: 'Medium', manual: [{
        title: 'Reset Password: activation email arrives', reason: 'The email goes to the team test mailbox, which automation does not read.',
        handling: `After a run, check the mailbox of ${SHEET.resetUser || RESET_USER} has the activation email.` }] }),
      async ({ administratorPage: admin }) => {
        const target = SHEET.resetUser || RESET_USER;
        requireUatChanges(`resets ${target}'s password: activation email to its mailbox`);
        test.skip(!SHEET.resetUser && !TEST_EMAIL, 'Human action required: no test mailbox; set ADM_TEST_EMAIL in .env');
        await caseUser(admin, SHEET.resetUser, RESET_USER);
        await admin.quicklinkGo(await dummyUserRow(admin, target), 'View Details');
        const frame = await admin.openPopup('Reset Password');
        await test.step('Pop-up: "Are you sure you want to reset password? Yes, an activation email will be sent to {email}"', async () => {
          const text = await admin.popupText(frame);
          expect(text).toContain('Are you sure you want to reset password?');
          expect(text).toMatch(/an activation email will be sent to \S+@\S+/i);
          if (!SHEET.resetUser) expect(text.toLowerCase()).toContain(TEST_EMAIL.toLowerCase());
          await admin.captureScreen('Reset Password pop-up');
        });
        await test.step('Continue: password reset, email sent', async () => {
          await stopBeforeSaving(admin, `Reset Password Continue for ${target}`);
          await frame.locator('a, button, input[type=button], input[type=submit]').filter({ hasText: /^\s*Continue\s*$/ }).first().click();
          await admin.page.waitForLoadState('load');
          await admin.page.waitForTimeout(2_000);
          const after = `${await admin.popupText(frame).catch(() => '')} ${await admin.main.innerText().catch(() => '')}`.replace(/\s+/g, ' ');
          console.log(`reset password ${target}: ${after.slice(0, 300)}`);
          await admin.captureScreen('After Reset Password Continue');
          expect(after, 'reset confirmed on screen').toMatch(/success|sent|has been reset/i);
          await admin.closePopup();
        });
      }
    );

    test(
      'Suspended bank user cannot log in; reinstated user can',
      testCase({ id: 'TC-ADM-018', module: MODULE, priority: 'High' }),
      async ({ administratorPage: admin, browser }) => {
        const who = SHEET.loginTestUser || TEST_BANK_USER || DUMMY_USER;
        requireUatChanges(`suspends ${who}, tries to log in as it, reinstates it`);
        test.skip(!TEST_BANK_USER_PASSWORD, `Human action required: ${who}'s password is needed ` +
          `(${SHEET.loginTestUser && SHEET.loginTestUser !== DUMMY_USER ? 'ask the QA Lead (Test Data sheet)' : 'set it once from its reset email in the test mailbox'}); ` +
          `put it in .env as ${ENV_NAME.replace(/-/g, '_')}_TEST_BANK_USER_PASSWORD`);
        const user = SHEET.loginTestUser ? await sheetUser(admin, SHEET.loginTestUser) : await testBankUser(admin);
        // log in as the test user in a separate browser (the admin session stays logged in)
        const canLogIn = async (label: string): Promise<boolean> => {
          const context = await browser.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS });
          try {
            const login = new LoginPage(await context.newPage());
            await login.open();
            await login.login(user, TEST_BANK_USER_PASSWORD);
            await login.page.waitForLoadState('load');
            await login.page.waitForTimeout(1_500);
            const ok = await login.page.locator('a.btnLogout').isVisible();
            const screen = (await login.page.locator('body').innerText()).replace(/\s+/g, ' ');
            console.log(`${label}: ${ok ? 'logged in' : 'refused'} | ${screen.slice(0, 200)}`);
            await login.captureStep(`Log in as ${label} ${user}: ${ok ? 'LOGGED IN' : 'REFUSED'}`);
            if (ok) await login.page.locator('a.btnLogout').click();
            return ok;
          } finally {
            await context.close();
          }
        };
        if (/Suspended/.test(await (await dummyUserRow(admin, user)).innerText())) await setAccess(admin, user, 'Reinstate', 'QA automation: reinstate before test');
        await test.step(`Suspend ${user}`, async () => {
          await setAccess(admin, user, 'Suspend', 'QA baseline suspend (login check)');
        });
        await test.step(`Log in as suspended ${user}: refused`, async () => {
          expect(await canLogIn('suspended'), 'suspended user must not log in').toBe(false);
        });
        await test.step(`Reinstate ${user}`, async () => {
          await setAccess(admin, user, 'Reinstate', 'QA baseline reinstate (login check)');
        });
        await test.step(`Log in as reinstated ${user}: allowed`, async () => {
          expect(await canLogIn('reinstated'), 'reinstated user must log in').toBe(true);
        });
      }
    );

    test(
      'All Users (Manage Bank Users): search and filter field validation',
      testCase({ id: 'TC-ADM-020', module: MODULE, priority: 'Medium' }),
      async ({ administratorPage: admin, page }) => {
        await admin.openQuicklink('Manage Bank Users');
        await test.step('Search box placeholder "User ID"; dates picker-only, default last 10 years', async () => {
          await expect(admin.searchBox).toHaveValue('User ID');
          for (const n of ['from', 'to']) expect(await admin.input(n, admin.filterForm).getAttribute('readonly'), `${n} read-only`).not.toBeNull();
          await expect(admin.input('from', admin.filterForm)).toHaveValue(portalDate({ years: -10 }));
          await expect(admin.input('to', admin.filterForm)).toHaveValue(portalDate());
        });
        await test.step('Dropdowns: Role (OPT_ROLE_FILTER), Status (sheet: Active / Suspended)', async () => {
          await admin.captureOptions('role', 'Role filter (All Users)', ROLE_FILTER);
          await admin.captureOptions('status', 'Status filter (All Users)', STATUS_FILTER_SHEET);
          expect.soft(withoutFailover(await admin.options('role'), 'Role filter'), 'Role filter (OPT_ROLE_FILTER)').toEqual(ROLE_FILTER);
          expect.soft(withoutResigned(await admin.options('status')), 'Status filter (sheet: Active / Suspended)').toEqual(STATUS_FILTER_SHEET);
        });
        await test.step('Special characters \' " < > % searched as plain text', async () => {
          await admin.search(`'"<>%`);
          await expect(admin.errorPage).toHaveCount(0);
          await expect(page).toHaveURL(/\/admin\//);
          expect(await admin.rows.count(), 'no extra rows').toBe(0);
          await admin.captureScreen('Bank users - special characters');
        });
      }
    );

    test(
      'Add a Bank User: mandatory fields',
      testCase({ id: 'TC-ADM-021', module: MODULE, priority: 'Medium' }),
      async ({ administratorPage: admin }) => {
        await admin.openQuicklink('Add a Bank User');
        await test.step('Submit with every field blank: User ID error, not submitted', async () => {
          await admin.clear(['userId', 'name', 'email']);
          await admin.submit();
          await expect(admin.error('userIdError')).toHaveText('Please enter valid User ID');
          expect(await admin.reviewShown()).toBe(false);
        });
        await test.step('Fill one field at a time: each error shows, then clears once filled', async () => {
          await admin.fill({ userId: uniqueUserId(10) });
          await admin.submit();
          await expect(admin.error('userIdError')).toBeHidden();
          expect.soft(await admin.reviewShown(), 'blank Name must not reach Review').toBe(false);
          await expect.soft(admin.error('nameError'), 'Name error for blank Name').toHaveText('Please enter valid Name');
          await admin.backFromReview();
          await admin.fill({ name: 'QA Mandatory' });
          await admin.clear(['email']);
          await admin.submit();
          await expect(admin.error('nameError')).toBeHidden();
          expect.soft(await admin.reviewShown(), 'blank Email must not reach Review').toBe(false);
          await expect.soft(admin.error('emailError'), 'Email error for blank Email').toHaveText('Please enter valid Email');
          await admin.backFromReview();
          await admin.fill({ email: 'qa.adm.mandatory@example.com' });
          await admin.submit();
          await expect(admin.error('emailError')).toBeHidden();
          expect(await admin.reviewShown(), 'all filled -> Review & Confirm').toBe(true);
          await admin.captureScreen('Add a Bank User - all mandatory filled (not confirmed)');
          await admin.backFromReview();
        });
      }
    );

    test(
      'Edit Bank User Details: field validation (mandatory, format and length)',
      testCase({ id: 'TC-ADM-022', module: MODULE, priority: 'Medium' }),
      async ({ administratorPage: admin }) => {
        // Own account: the form is only Submitted and left with Back, never confirmed
        await admin.openQuicklink('Manage Bank Users');
        await admin.search(OWN);
        await admin.quicklinkGo(admin.rows.filter({ hasText: new RegExp(`^\\s*${OWN}\\b`) }).first(), 'View Details');
        await admin.clickButton('Edit Bank User Details');
        await expect(admin.title).toHaveText('Edit Bank User Details');
        expect(await admin.steps.allInnerTexts()).toEqual(['Details', 'Review & Confirm', 'Complete']);
        await test.step('Every field blank: errors, nothing saved', async () => {
          await admin.clear(['name', 'email']);
          await admin.captureStep('Name and Email blanked, before Submit');
          await admin.submit();
          expect.soft(await admin.reviewShown(), 'blank Name / Email must not reach Review').toBe(false);
          await expect.soft(admin.error('nameError'), 'Name error').toBeVisible();
          await expect.soft(admin.error('emailError'), 'Email error').toBeVisible();
          await admin.backFromReview();
        });
        await test.step('Name 2 / invalid email rejected; Name max 20; Role options', async () => {
          await admin.fill({ name: 'ab', email: 'bad@' });
          await admin.captureStep('Name "ab", Email "bad@", before Submit');
          await admin.submit();
          await expect(admin.error('nameError')).toHaveText('Please enter valid Name');
          await expect(admin.error('emailError')).toHaveText('Please enter valid Email');
          await admin.fill({ name: 'abcdefghijklmnopqrstu' });
          expect((await admin.input('name').inputValue()).length).toBe(20);
          // Own account (used so no colleague's account is touched): its role cannot be changed, no Role list
          if (await admin.input('role').count()) expect(withoutFailover(await admin.options('role'), 'Role list')).toEqual(ROLE_ASSIGN);
          else test.info().annotations.push({ type: 'info', description: 'Own account: Role is not editable (no Role list)' });
        });
        await test.step('Valid values -> Review, then Back (not saved)', async () => {
          await admin.fill({ name: 'QA Edit Check', email: 'qa.adm.edit@example.com' });
          await admin.submit();
          expect(await admin.reviewShown()).toBe(true);
          await admin.captureScreen('Edit Bank User Details - Review (not confirmed)');
          await admin.backFromReview();
        });
      }
    );

    test(
      'Reinstate Bank User Access form: field validation (mandatory, format and length)',
      testCase({ id: 'TC-ADM-023', module: MODULE, priority: 'Medium' }),
      async ({ administratorPage: admin }) => {
        const row = await otherUserRow(admin, 'Suspended');
        test.skip(!row, `No suspended bank user on ${ENV_NAME} to open the Reinstate form on`);
        await admin.quicklinkGo(row!, 'Reinstate Bank User Access');
        await expect(admin.title).toHaveText('Reinstate Bank User Access');
        await test.step('Reason = Reinstate only; counter 250', async () => {
          expect(await admin.options('reason')).toEqual(['Reinstate']);
          expect(await admin.selected('reason')).toBe('Reinstate');
          expect(await admin.remaining()).toBe('250');
        });
        await test.step('Blank remarks rejected (checked without Submit); 250 max', async () => {
          expect(await admin.validateWithoutSubmit()).toBe(false);
          await expect(admin.error('descriptionError')).toHaveText('Please enter a short description');
          await admin.fillCounted('description', 'y'.repeat(251));
          expect((await admin.input('description').inputValue()).length).toBe(250);
          expect(await admin.remaining()).toBe('0');
          await admin.captureScreen('Reinstate form validation');
        });
      }
    );
  });
}
