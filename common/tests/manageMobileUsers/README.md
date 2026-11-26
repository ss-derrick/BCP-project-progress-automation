# common/tests/manageMobileUsers

Tests for the **Manage Mobile Users** menu module, on both portals: `mobileUsers.spec.ts`.
Automation IDs follow the sheet numbers: **TC-MU-001..029** = APH TC-APH-BP-MU-001..029 (rows 119-146) and
Fassbayar TC-FB-BP-MU-001..029 (rows 134-159). APH has no MU-009; Fassbayar has no MU-011, 020, 022. Those cases are
skipped as "Applicable for ... only" and left out of the other portal's report.

| Kind | Cases | How |
|---|---|---|
| Read only (always run) | 001, 002, 003, 004, 007, 008, 011, 012, 014, 015, 017, 019 (pop-up part), 022, 023, 025, 026, 027, 028, 029 | TD-06 reference company (read only); forms go to Review & Confirm at most, never Confirm; Suspend / Reinstate forms checked with the page's own validation, never submitted |
| Change UAT data (`ADM_ALLOW_UAT_CHANGES=true`) | 005, 010, 013, 016 | Only the automation's own mobile users (`qamu` + 6 digits) on the TD-07 working company; each registration uses one Available TID |
| Human action / test data | 006, 009, 018, 019, 020, 021, 024 | Device, mailbox (TD-18 / TD-19) or test data not named in the Test Data sheet |

Test data per portal: `portals.config.ts` `mobileUsers` (TD-06 / TD-07 company names and MIDs, which cases the sheet has).
On 26 Nov 2026 the Fassbayar TD-07 company had **no Available TID**, so its register / edit / suspend cases are blocked
until TIDs are registered on it (or another company is named in the Test Data sheet).

Page object: `common/pages/MobileUsersPage.ts`. Exploration: `explore/scan/mobileUsers.scan.ts`, `explore/scan/muUsers.scan.ts` (read only).

Run: `npx playwright test common/tests/manageMobileUsers`
