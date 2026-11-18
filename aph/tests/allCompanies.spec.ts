import { test, expect } from '../fixtures/pages';
import { testCase } from '../../common/utils/testCase';
import { loginAs } from '../flows/loginFlow';
import { Quicklink, type CompanyRow } from '../pages/AllCompaniesPage';
import type { ParentCompanyRow } from '../pages/ParentCompanySummaryPage';
import { knownCompany, noSuchCompany, ROWS_PER_PAGE, syncCompany, filterFromJan2026 } from '../testdata/companyData';
import { formatPortalDate, parsePortalDate, today } from '../../common/utils/portalDate';
import { addCompany } from '../../common/flows/addCompanyFlow';
import { addParentCompany } from '../../common/flows/addParentCompanyFlow';
import { createCompanyWith3Mids } from '../testdata/addCompanyData';
import { masterParentCompany } from '../testdata/parentCompanyData';
import { createParentCompany } from '../testdata/addParentCompanyData';
import type { AllCompaniesPage } from '../pages/AllCompaniesPage';
import type { AddParentCompanyPage, MerchantType } from '../../common/pages/company/AddParentCompanyPage';
import type { ParentCompanySummaryPage } from '../pages/ParentCompanySummaryPage';
import type { ParentCompanyDetailsPage } from '../pages/ParentCompanyDetailsPage';

// APH System Portal - All Companies (top menu "All Companies", /company/list)
//
// Add your scenarios one by one inside the describe block below.
// Each scenario: its own test(...) with a new ID (TC-APH-002, 003, ...).
//
// Page steps you can use (pages/AllCompaniesPage.ts):
//   allCompaniesPage.open()                      open via top menu + verify list page
//   allCompaniesPage.search('keyword')           MID (without -ACS) / Name of Business / Authoriser
//   allCompaniesPage.verifyNoRecordFound('kw')   "No record found" checks
//   allCompaniesPage.filterByStatus('Active')    or 'Suspended'
//   allCompaniesPage.getTotalRecords()           number from "Total Records: N"
//   allCompaniesPage.getPageInfo()               { current, last } from "Page x of y"
//   allCompaniesPage.row('text')                 the row containing a MID / name
//   allCompaniesPage.readRow(row)                { mid, businessName, authoriser, status, date }
//   allCompaniesPage.readAllRows()               every row on the current page
//   allCompaniesPage.goToNextPage()
//   allCompaniesPage.openQuicklink(row, Quicklink.VIEW_DETAILS)
//   allCompaniesPage.exportCsv()                 returns the file name (slow: ~36 s)
//   allCompaniesPage.captureScreen('label')      screenshot for the report
//
// Test data (aph/testdata/companyData.ts): knownCompany, noSuchCompany, ROWS_PER_PAGE

const MODULE = 'All Companies';

test.describe(MODULE, () => {

  // Runs before every scenario in this file (all submodules):
  // log in, open All Companies
  test.beforeEach(async ({ loginPage, consolePage, allCompaniesPage }) => {
    await loginAs({ loginPage, consolePage });
    await test.step('Open All Companies', async () => {
      await allCompaniesPage.open();
    });
  });

  // ==========================================
  // SUBMODULE: Company Summary  (tag @company-summary)
  // Run only these:  npx playwright test --grep @company-summary
  // ==========================================
  test.describe('Company Summary', { tag: '@company-summary' }, () => {

    // ---- Add your Company Summary scenarios below ----

    test(
      'Scenario sync company',
      testCase({ id: 'TC-APH-002', module: MODULE, priority: 'High' }),
      async ({ allCompaniesPage, companyDetailsPage }) => {

        // Content: search the sync company by its MID
        await test.step(`Search MID ${syncCompany.mid}`, async () => {
          await allCompaniesPage.search(syncCompany.mid);
        });

        // Validation: the search returns the company's data
        await test.step('Verify the company data is returned', async () => {
          expect(await allCompaniesPage.getTotalRecords(), 'Total Records').toBe(1);

          const row = allCompaniesPage.row(syncCompany.mid);
          await expect(row).toHaveCount(1);

          const shown = await allCompaniesPage.readRow(row);
          expect(shown.mid, 'MID').toBe(syncCompany.midShown);
          expect(shown.businessName, 'Business Name').toBe(syncCompany.businessName);
          expect(shown.authoriser, 'Authoriser').toBe(syncCompany.authoriser);
          expect(shown.status.toUpperCase(), 'Status').toBe(syncCompany.status);

          await allCompaniesPage.captureScreen('Sync company search result');
        });

        // Content: Quicklink "View Details" -> Go
        await test.step('Quicklink View Details -> Go', async () => {
          await allCompaniesPage.openQuicklink(
            allCompaniesPage.row(syncCompany.mid),
            Quicklink.VIEW_DETAILS
          );
        });

        // Validation: the company details page shows this company's content
        await test.step('Verify company details are returned', async () => {
          await companyDetailsPage.verifyDetailsPage(syncCompany.mid);
          await companyDetailsPage.verifyField('Business Name', syncCompany.businessName);
          await companyDetailsPage.verifyField('Name', syncCompany.authoriser);
          await companyDetailsPage.verifyField('Merchant ID (MID)', syncCompany.mid);
          await companyDetailsPage.captureScreen('Sync company details');
        });

      }
    );

    test(
      'Filter date from Jan 2026 to Current & Status is Suspended',
      testCase({ id: 'TC-APH-003', module: MODULE, priority: 'Medium' }),
      async ({ allCompaniesPage, companyDetailsPage }) => {

        const from = filterFromJan2026;   // 01 Jan 2026
        const to = today();               // current date
        let rows: CompanyRow[] = [];

        // Content: Status = Suspended, Date = 01 Jan 2026 to today, Search
        await test.step(
          `Filter Status Suspended, Date ${formatPortalDate(from)} to ${formatPortalDate(to)}`,
          async () => {
            await allCompaniesPage.filter({ status: 'Suspended', from, to });
          }
        );

        // Validation: every company listed is Suspended and inside the date range
        await test.step('Verify results are Suspended and within the date range', async () => {
          rows = await allCompaniesPage.readAllRows();

          if (rows.length === 0) {
            // No suspended company in this period is a valid result
            await expect(allCompaniesPage.noRecordMessage).toBeVisible();
          }

          for (const r of rows) {
            expect(r.status.toUpperCase(), `${r.mid} status`).toBe('SUSPENDED');

            const date = parsePortalDate(r.date);
            expect(date >= from && date <= to,
              `${r.mid} date ${r.date} should be ${formatPortalDate(from)} - ${formatPortalDate(to)}`
            ).toBe(true);
          }

          console.log(`Suspended companies found (page 1): ${rows.length}`);
          await allCompaniesPage.captureScreen('Suspended companies Jan 2026 to today');
        });

        // Details of a record need a record: stop here (with a note) if none
        if (rows.length === 0) {
          test.info().annotations.push({
            type: 'note',
            description: 'No suspended company from Jan 2026 to today - record details not checked'
          });
          return;
        }

        // Content: open the first record's details (Quicklink View Details -> Go)
        const record = rows[0];
        const plainMid = record.mid.replace(/-[A-Z]+$/, '');   // details page shows the MID without -ACS

        await test.step(`Open details of ${record.mid} (${record.businessName})`, async () => {
          await allCompaniesPage.openQuicklink(
            allCompaniesPage.row(record.mid),
            Quicklink.VIEW_DETAILS
          );
        });

        // Validation: the details page belongs to that record
        await test.step('Verify the record details are returned', async () => {
          await companyDetailsPage.verifyDetailsPage(plainMid);
          await companyDetailsPage.verifyField('Business Name', record.businessName);
          await companyDetailsPage.verifyField('Name', record.authoriser);
          await companyDetailsPage.captureScreen(`Details of ${record.mid}`);
        });

      }
    );

    // ---- Template for the next scenario ----
    //
    // test(
    //   'Scenario title',
    //   testCase({ id: 'TC-APH-004', module: MODULE, priority: 'High' }),
    //   async ({ allCompaniesPage }) => {
    //
    //     await test.step('Step name', async () => {
    //       // actions + expect(...) checks
    //     });
    //
    //   }
    // );

  });

  // ==========================================
  // SUBMODULE: Add a Company  (tag @add-company)
  // Run only these:  npx playwright test --grep @add-company
  // !! These scenarios CREATE a real company on the environment !!
  // ==========================================
  test.describe('Add a Company', { tag: '@add-company' }, () => {

    test(
      'Add a company with 3 MIDs on different Service Providers',
      testCase({ id: 'TC-APH-004', module: MODULE, priority: 'High' }),
      async ({ allCompaniesPage, addCompanyPage }) => {

        // New name / BRN / email / random unique 15-digit MIDs on every run
        //   MID 1 Aeon Credit, MID 2 Hong Leong Bank, MID 3 AmBank (Payment Type Retail)
        // Other hosts: createCompanyData({ hosts: ['GP', 'CIMB'] }) - see common/hosts/hosts.ts
        const company = createCompanyWith3Mids();

        // Content: open Add a Company from the Quicklinks
        await test.step('Open Add a Company', async () => {
          await addCompanyPage.open();
        });

        // Fill -> Submit -> Review -> Confirm (= CREATED) -> Complete
        // (shared with every portal: common/flows/addCompanyFlow.ts)
        await addCompany(addCompanyPage, company);

        // Validation: the new company is listed in All Companies with all 3 MIDs
        await test.step('Verify the new company in All Companies', async () => {
          await allCompaniesPage.open();
          await allCompaniesPage.search(company.businessName);

          const row = allCompaniesPage.row(company.businessName);
          await expect(row).toHaveCount(1);
          for (const mid of company.mids) {
            await expect(row).toContainText(mid.mid);
          }

          const shown = await allCompaniesPage.readRow(row);
          expect(shown.businessName, 'Business Name').toBe(company.businessName);
          expect(shown.authoriser, 'Authoriser').toBe(company.fullName);
          expect(shown.status.toUpperCase(), 'Status').toBe('ACTIVE');
          await allCompaniesPage.captureScreen('New company in All Companies');
        });

      }
    );

  });

  // ==========================================
  // SUBMODULE: Parent Company Summary  (tag @parent-company-summary)
  // Quicklinks > Parent Company Summary  (/company/parentCompanyListing)
  // Run only these:  npx playwright test --grep @parent-company-summary
  // ==========================================
  test.describe('Parent Company Summary', { tag: '@parent-company-summary' }, () => {

    // ---- Add your Parent Company Summary scenarios below ----

    test(
      'Search parent company test_kw_master and view its details',
      testCase({ id: 'TC-APH-005', module: MODULE, priority: 'High' }),
      async ({ parentCompanySummaryPage, parentCompanyDetailsPage }) => {

        const parent = masterParentCompany;

        // Content: open Parent Company Summary and search
        await test.step('Open Parent Company Summary', async () => {
          await parentCompanySummaryPage.open();
        });

        await test.step(`Search "${parent.searchKeyword}"`, async () => {
          await parentCompanySummaryPage.search(parent.searchKeyword);
        });

        // Validation: the search returns the parent company
        await test.step('Verify the parent company is returned', async () => {
          expect(await parentCompanySummaryPage.getTotalRecords(), 'Total Records').toBe(1);

          const row = parentCompanySummaryPage.row(parent.businessName);
          await expect(row).toHaveCount(1);

          const shown = await parentCompanySummaryPage.readRow(row);
          expect(shown.businessName, 'Business Name').toBe(parent.businessName);
          expect(shown.authoriser, 'Authoriser').toBe(parent.authoriser);
          expect(shown.status.toUpperCase(), 'Status').toBe(parent.status);
          await parentCompanySummaryPage.captureScreen('Parent company search result');
        });

        // Content: Quicklink View Details -> Go
        await test.step('Quicklink View Details -> Go', async () => {
          await parentCompanySummaryPage.openViewDetails(parentCompanySummaryPage.row(parent.businessName));
        });

        // Validation: the details page really returns this parent company's data
        await test.step('Verify parent company details are returned', async () => {
          await parentCompanyDetailsPage.verifyDetailsPage(parent.businessName);
          await parentCompanyDetailsPage.verifyField('Business Name', parent.businessName);
          await parentCompanyDetailsPage.verifyField('Business Short Name', parent.businessShortName);
          await parentCompanyDetailsPage.verifyField('User ID', parent.authoriserUserId);
          await parentCompanyDetailsPage.verifyField('Merchant Type', parent.merchantType);
          await parentCompanyDetailsPage.captureScreen('Parent company details');
        });

        await test.step('Verify its child companies are listed', async () => {
          await expect(parentCompanyDetailsPage.childCompaniesTitle).toBeVisible();
          expect(await parentCompanyDetailsPage.getChildTotalRecords(), 'Child companies').toBeGreaterThan(0);

          const child = parentCompanyDetailsPage.childRow(parent.child.businessName);
          await expect(child).toHaveCount(1);
          await expect(child).toContainText(parent.child.mid);
          await parentCompanyDetailsPage.captureScreen('Child companies');
        });

      }
    );

    test(
      'Filter date from Jan 2026 to Current & Status is Suspended - Parent Company',
      testCase({ id: 'TC-APH-006', module: MODULE, priority: 'Medium' }),
      async ({ parentCompanySummaryPage, parentCompanyDetailsPage }) => {

        const from = filterFromJan2026;   // 01 Jan 2026
        const to = today();               // current date
        let rows: ParentCompanyRow[] = [];

        await test.step('Open Parent Company Summary', async () => {
          await parentCompanySummaryPage.open();
        });

        // Content: Status = Suspended, Date = 01 Jan 2026 to today, Search
        await test.step(
          `Filter Status Suspended, Date ${formatPortalDate(from)} to ${formatPortalDate(to)}`,
          async () => {
            await parentCompanySummaryPage.filter({ status: 'Suspended', from, to });
          }
        );

        // Validation: every parent company listed is Suspended and created in the range
        await test.step('Verify results are Suspended and within the date range', async () => {
          rows = await parentCompanySummaryPage.readAllRows();

          if (rows.length === 0) {
            // No suspended parent company in this period is a valid result
            await expect(parentCompanySummaryPage.noRecordMessage).toBeVisible();
          }

          for (const r of rows) {
            expect(r.status.toUpperCase(), `${r.businessName} status`).toBe('SUSPENDED');

            const date = parsePortalDate(r.createdDate);
            expect(date >= from && date <= to,
              `${r.businessName} created ${r.createdDate} should be ${formatPortalDate(from)} - ${formatPortalDate(to)}`
            ).toBe(true);
          }

          console.log(`Suspended parent companies found (page 1): ${rows.length}`);
          await parentCompanySummaryPage.captureScreen('Suspended parent companies Jan 2026 to today');
        });

        // Details of a record need a record: stop here (with a note) if none
        if (rows.length === 0) {
          test.info().annotations.push({
            type: 'note',
            description: 'No suspended parent company from Jan 2026 to today - record details not checked'
          });
          return;
        }

        // Content: open the first record's details (Quicklink View Details -> Go)
        const record = rows[0];

        await test.step(`Open details of ${record.businessName}`, async () => {
          await parentCompanySummaryPage.openViewDetails(
            parentCompanySummaryPage.row(record.businessName)
          );
        });

        // Validation: the details page belongs to that record
        await test.step('Verify the record details are returned', async () => {
          await parentCompanyDetailsPage.verifyDetailsPage(record.businessName);
          await parentCompanyDetailsPage.verifyField('Business Name', record.businessName);
          await parentCompanyDetailsPage.verifyField('Name', record.authoriser);
          await parentCompanyDetailsPage.captureScreen(`Details of ${record.businessName}`);
        });

      }
    );

    // ---- Template for the next Parent Company Summary scenario ----
    //
    // test(
    //   'Scenario title',
    //   testCase({ id: 'TC-APH-007', module: MODULE, priority: 'High' }),
    //   async ({ allCompaniesPage }) => {
    //
    //     await test.step('Step name', async () => {
    //       // actions + expect(...) checks
    //     });
    //
    //   }
    // );

  });

  // ==========================================
  // SUBMODULE: Add a Parent Company  (tag @add-parent-company)
  // Run only these:  $env:DEMO='false'; npx playwright test --grep @add-parent-company
  // !! These scenarios CREATE a real parent company on the environment !!
  // ==========================================
  test.describe('Add a Parent Company', { tag: '@add-parent-company' }, () => {

    // Shared steps for both scenarios: fill, Submit, review, Confirm, then
    // find the new parent company and check its Merchant Type
    async function addAndVerifyParentCompany(
      type: MerchantType,
      pages: {
        addParentCompanyPage: AddParentCompanyPage;
        allCompaniesPage: AllCompaniesPage;
        parentCompanySummaryPage: ParentCompanySummaryPage;
        parentCompanyDetailsPage: ParentCompanyDetailsPage;
      }
    ): Promise<void> {
      const { addParentCompanyPage, allCompaniesPage, parentCompanySummaryPage, parentCompanyDetailsPage } = pages;
      const parent = createParentCompany(type);   // new name / BRN on every run

      // Content: open Add a Parent Company
      await test.step('Open Add a Parent Company', async () => {
        await addParentCompanyPage.open();
      });

      // Fill -> Submit -> Review -> Confirm (= CREATED) -> Complete
      // (shared with every portal: common/flows/addParentCompanyFlow.ts)
      await addParentCompany(addParentCompanyPage, parent);

      // Validation: the new parent company is listed and has the right Merchant Type
      await test.step('Verify the new parent company in Parent Company Summary', async () => {
        await allCompaniesPage.open();
        await parentCompanySummaryPage.open();
        await parentCompanySummaryPage.search(parent.businessName);

        const row = parentCompanySummaryPage.row(parent.businessName);
        await expect(row).toHaveCount(1);

        const shown = await parentCompanySummaryPage.readRow(row);
        expect(shown.businessName, 'Business Name').toBe(parent.businessName);
        expect(shown.authoriser, 'Authoriser').toBe(parent.fullName);
        expect(shown.status.toUpperCase(), 'Status').toBe('ACTIVE');
        await parentCompanySummaryPage.captureScreen('New parent company in Parent Company Summary');
      });

      await test.step(`Verify its details show Merchant Type ${type}`, async () => {
        await parentCompanySummaryPage.openViewDetails(parentCompanySummaryPage.row(parent.businessName));
        await parentCompanyDetailsPage.verifyDetailsPage(parent.businessName);
        await parentCompanyDetailsPage.verifyField('Merchant Type', type);
        await parentCompanyDetailsPage.captureScreen('New parent company details');
      });
    }

    test(
      'Add a parent company - Master Merchant',
      testCase({ id: 'TC-APH-007', module: MODULE, priority: 'High' }),
      async ({ addParentCompanyPage, allCompaniesPage, parentCompanySummaryPage, parentCompanyDetailsPage }) => {
        await addAndVerifyParentCompany('Master Merchant',
          { addParentCompanyPage, allCompaniesPage, parentCompanySummaryPage, parentCompanyDetailsPage });
      }
    );

    test(
      'Add a parent company - HQ Merchant',
      testCase({ id: 'TC-APH-008', module: MODULE, priority: 'High' }),
      async ({ addParentCompanyPage, allCompaniesPage, parentCompanySummaryPage, parentCompanyDetailsPage }) => {
        await addAndVerifyParentCompany('HQ Merchant',
          { addParentCompanyPage, allCompaniesPage, parentCompanySummaryPage, parentCompanyDetailsPage });
      }
    );

  });

});

// Keep imports available for your scenarios
void [expect, testCase, Quicklink, knownCompany, noSuchCompany, ROWS_PER_PAGE];
