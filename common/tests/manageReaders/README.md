# common/tests/manageReaders

Tests for the **Manage Readers** menu module, on both portals (same screens).

| File | Cases | Sheet rows |
|---|---|---|
| `readers.spec.ts` | TC-RDR-001 .. 016 | APH TC-APH-BP-RDR-001..016 (rows 175-190), Fassbayar TC-FB-BP-RDR-001..016 (rows 193-208) |

- Read-only: 001, 002, 006, 007, 013, 015.
- Change UAT data (only with `ADM_ALLOW_UAT_CHANGES=true`): 003, 004, 005, 008, 009, 010, 012, 016. They use only the
  automation's own test readers (serial `QARDR` + 10 digits) registered on the Test Data **TD-07 working company**
  (APH testcreate888 / 202610011060002, Fassbayar TEST COMPANY AUTOMATION 1). RDR-009 makes two NEW readers
  Permanently Suspended (irreversible).
- Human action (device + card): 011, 014. RDR-005 waits for a "company B" in the Test Data sheet (`portals.config.ts` `readers.secondMid`).

Upload files (RDR-003 / 004 / 005): `common/testdata/RDR_01-valid.csv` .. `RDR_08-reassign.csv`, named as the
sheet's RDR_xx files. They hold `{PLACEHOLDERS}` (serial, MID, provider) that `common/testdata/readerCsvFiles.ts`
fills with fresh values every run; the exact file uploaded is attached to the report.

Page object: `common/pages/ReadersPage.ts` (built on `AdministratorPage`: every screen and Submit is screenshotted).

Run: `npx playwright test common/tests/manageReaders/readers.spec.ts`
