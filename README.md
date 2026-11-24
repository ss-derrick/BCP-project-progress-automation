# system-portal-automation

One Playwright + TypeScript codebase for the Softspace **System Portal** on two portals:
**Aeon Payment Hub (APH)** and **Fassbayar**. `ENV_NAME` in `.env` picks the environment;
the environment decides the portal, its hosts and its features (`portals.config.ts`).

Structure report and diagrams: "One Codebase, Two Portals" (team doc).
**What changed, where and why: [CHANGELOG.md](CHANGELOG.md)** (every change is recorded there).

## Structure

```text
system-portal-automation/
├── .env                      # local only: ENV_NAME + each environment's URL, user, password
├── .env.example              # same keys, no secrets (share this one)
├── portals.config.ts         # THE config: environments, portals, hosts + features per portal, run settings
├── playwright.config.ts      # runs common/tests + the current portal's tests; workers 1; report per environment
│
├── common/                   # written once, runs on every portal
│   ├── hosts/                # one profile per host (Service Provider): MID rule, suffix, card schemes, payment types
│   ├── creation/             # hostCompanyData: a new company for one host (NewHostCompany) + data shapes
│   ├── flows/                # login (loginAs, loginAsAdmin)
│   ├── testdata/             # reusable fixed data (existingMids: a MID already taken per environment;
│   │                         #   RDR_01..08 reader upload CSVs with {PLACEHOLDERS} + readerCsvFiles.ts)
│   ├── utils/                # hostValidation, portalDate, random, testCase()
│   ├── pages/                # BasePage, LoginPage, ConsolePage, HomePage, AddCompanyFormPage
│   ├── fixtures/base.ts      # base test: shared pages, blocked-page check, requireFeature()
│   ├── fixtures/portal.ts    # gives shared tests the portal's version of a page (AddCompanyFormPage)
│   ├── tests/                # scenarios that run on BOTH portals, one folder per menu module:
│   │   ├── login/                    login.spec.ts
│   │   ├── home/                     (empty)
│   │   ├── allCompanies/             addCompany, addCompanyValidation, addCompanyCardScheme, companySummary
│   │   ├── manageMobileUsers/        (empty)
│   │   ├── manageReaders/            (empty)
│   │   ├── manageTransactions/       transactionSummary.spec.ts
│   │   ├── manageCreditSettlements/  creditSettlement.spec.ts
│   │   └── administrator/            (empty)
│   └── reporters/            # execution report + summary page
│
├── aph/                      # only what differs on Aeon Payment Hub
│   ├── pages/                # AphAddCompanyFormPage (+ Host Swing Priority)
│   ├── fixtures/  tests/     # tests/<module>/ once an APH-only scenario is added
├── fassbayar/                # only what differs on Fassbayar
│   ├── pages/                # FassbayarAddCompanyFormPage (+ DBA, SST, TIN...), Bill Payment pages
│   ├── fixtures/             # pages.ts: Bill Payment Report + Details
│   ├── tests/manageTransactions/  # billPaymentReport.spec.ts
│
├── report-notes/<env>/       # optional gaps + human-action cards per environment
├── scripts/run-all.js        # npm run test:all / test:aph / test:fassbayar
├── scripts/md-to-html.js     # npm run md -- <file.md>: open a Markdown file in the browser
├── docs/                     # portal-module-map.md: every module, flow, APH vs Fassbayar difference
├── tools/report-generator/   # builds test_execution_report.html (Python 3 + jinja2: pip install jinja2)
├── tools/workbook-results/   # writes run results into the test case workbook (pip install openpyxl; <ENV>_WORKBOOK in .env)
└── explore/scan/             # read-only scans comparing a screen on both portals (npm run scan), not part of the suite
```

**Rules**
1. A file goes in `common/` unless it only makes sense on one portal.
2. A portal page never copies a common page; it `extends` it and overrides only what differs.
3. Tests never say `if (portal === ...)`: differences live in portal pages, host profiles or `portals.config.ts`.
4. `common/` never imports from `aph/` or `fassbayar/`; the two portal folders never import each other.
5. Tests are grouped by portal menu module (`tests/<module>/`), same folder names on every portal (since 19 Nov 2026).
6. Test categories are tags, not folders: `testCase({ ..., suite: ['smoke'] })` -> `@smoke` (since 20 Nov 2026). No `suite` = Full only.

## Running

```powershell
npm install
$env:ENV_NAME='UAT-APH';       npx playwright test    # common/tests + aph/tests
$env:ENV_NAME='UAT-Fassbayar'; npx playwright test    # common/tests + fassbayar/tests
$env:DEMO='false'; ...                                # fast, headless (needed for Add a Company runs)
npm run test:all                                      # APH, then Fassbayar -> summary shows BOTH
npm run test:aph                                      # APH only            -> summary shows APH only
npm run test:fassbayar                                # Fassbayar only      -> summary shows Fassbayar only
npm run test:aph:smoke                                # one category: Smoke (test:fassbayar:smoke, test:smoke = both)
$env:ENV_NAME='UAT-APH'; npx playwright test --grep "@smoke"   # same, without the summary script
npm run report:summary                                # rebuild test_summary.html (every portal) without running
npm run md -- docs/portal-module-map.md               # open a Markdown file in the browser (tables + diagrams)
npm run typecheck
```

- One session per user: tests run one at a time (`workers: 1`); don't use the same account in a browser during a run.
- Traces are off (they record the password). One debug run: `$env:TRACE='on'`.
- TC-COMP-001 (Add a Company) **creates real data** on every run. TC-COMP-002/003 stop before Confirm.

## Hosts

`common/hosts/*.ts` = one profile per Service Provider. `portals.config.ts` lists which hosts each
portal's scenarios cover (`hostsFor()`). Profiles marked `confirmed: false` / `TODO(confirm)` still need
their card schemes and payment types checked on a portal. Host rules shared by every portal live in
`common/utils/hostValidation.ts` (MID length incl. Maybank AMEX = 10 digits, MID suffix, search by plain MID).

## Where things are in the migration

Built 18 Nov 2026. The old page objects and specs copied from `APH-automation` and the Fassbayar team's
suite were removed the same day; only code written for this structure is left. The originals are still in
`APH-automation` and `fasspay-testautomation` for reference.

| Module | Status |
|---|---|
| Login | shared (TC-APH-001) |
| Add a Company | shared page + APH / Fassbayar overrides (TC-COMP-001, 002, 003); random realistic data, Fassbayar SST/TIN/bank/MCC/references filled and checked on Review (Derrick, merged 19 Nov 2026) |
| Add a Company: GP card schemes | shared, Derrick's (TC-COMP-005, TC-COMP-006-01…04; HSBC schemes Fassbayar only) |
| Company Summary | shared (TC-COMP-004) |
| Transaction Summary | shared (TC-TRX-001) |
| Bill Payment Report | Fassbayar only (TC-BILL-001) |
| Manage Credit Settlements | shared, written by Derrick, merged 18 Nov 2026 (TC-CS-001 … 009, `@credit-settlement`) |
| Company list, company details, Parent Company, bulk upload, logo | not rebuilt yet |

Next module: write it once in `common/pages` (+ a small portal override where the screen differs),
put its scenario in `common/tests/<module>/`, and run it on both portals.
One module only: `npx playwright test common/tests/manageCreditSettlements`.
