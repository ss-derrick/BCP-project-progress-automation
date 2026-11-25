# common/tests/login

Tests for **Login / session / password / error pages (AUTH)**, on both portals. The 17 cases are the same in the
APH and Fassbayar sheets (rows 2-18), so the Automation IDs follow the sheet numbers: TC-AUTH-001..017.

| Case | Sheet (both) | Notes |
|---|---|---|
| TC-AUTH-001 | AUTH-001 login page labels, buttons, footer | Field Registry FR-AUTH-S01-001..006 |
| TC-AUTH-002 | AUTH-002 valid login opens Home | header, menu, FB Daily Transaction Snapshot, Audit Trail "Login to System" |
| TC-AUTH-003 | AUTH-003 wrong password | TD-03 lockout user (never the main user); precondition: Active |
| TC-AUTH-004 / 005 | unknown user / blank fields | "Invalid User Name or Password" |
| TC-AUTH-006 | lockout after 3 failures | needs ADM_ALLOW_UAT_CHANGES=true + lockout password; reinstates the user after |
| TC-AUTH-007 | counter reset after a good login | needs the lockout password; runs before 006 |
| (TC-ADM-018) | AUTH-008 suspended user until reinstated | same flow as the Administrator test |
| TC-AUTH-010 | idle 15 minutes, then a menu click | REAL idle wait (about 16 min per portal): the server session must really expire |
| TC-AUTH-011 | timeout dialog Yes / No | REAL waits (about 14.5 min for each dialog, about 30 min per portal) |
| TC-AUTH-012 | logout, Back, pasted URL | |
| TC-AUTH-013 | second login ends the first | first browser gets "Auto Logged Out" |
| TC-AUTH-017 | Access Denied for a Viewer | TD-02 Viewer |
| TC-AUTH-009, 014, 015, 016 | mailbox cases | Human Action (sheet: HAR) |

Test users: `portals.config.ts` `auth` (lockoutUser, viewerUser, from each workbook's Test Data sheet).
Passwords only in `.env`: `<ENV>_LOCKOUT_USER_PASSWORD`, `<ENV>_VIEWER_PASSWORD`.
Exploration: `explore/scan/auth.scan.ts`, `explore/scan/authLogout.scan.ts` (read-only).

Run: `npx playwright test common/tests/login`
