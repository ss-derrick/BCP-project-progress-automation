> **Note (18 Nov 2026):** older notes from before the restructure. Folder names, setup and run commands here are out of date: see the root `README.md`. Kept for the scenario descriptions.

# APH-automation

Playwright + TypeScript UI automation for the **APH System Portal** (UAT: `https://10.0.1.30:35190`). Same structure as `ecom-automation`, without any payment code.

The login account is read from a local **`.env`** file (ignored by git). Copy `.env.example` to `.env` and fill in `APP_USERNAME` / `APP_PASSWORD`.

---

## Structure

```
APH-automation/
├── .env                        # login account (local only, never committed)
├── config/testConfig.ts        # BASE_URL, env name, ID prefix, timeouts, run modes
├── playwright.config.ts        # browser, reporters (reads config/testConfig.ts)
├── fixtures/pages.ts           # gives page objects to specs + blocked-env auto check
├── pages/
│   ├── BasePage.ts             # shared helpers: typeInto, captureScreen, captureFullBox, ...
│   ├── LoginPage.ts            # /auth/login
│   ├── ConsolePage.ts          # /console (landing page after login, LOGOUT)
│   ├── AllCompaniesPage.ts     # All Companies: search, status filter, paging, quicklink, CSV
│   ├── CompanyDetailsPage.ts   # Company details (Quicklink View Details)
│   ├── AddCompanyPage.ts       # Add a Company: business, authoriser, MID Settings, Submit/Confirm
│   ├── ParentCompanySummaryPage.ts  # Parent Company Summary: search, View Details
│   ├── ParentCompanyDetailsPage.ts  # Parent company details + child companies
│   └── AddParentCompanyPage.ts      # Add a Parent Company: Master / HQ Merchant (reuses AddCompanyPage)
├── flows/loginFlow.ts          # multi-page journeys shared by many specs
├── test-data/                  # constants + data factories (no data inside specs)
├── utils/
│   ├── testCase.ts             # testCase({ id, module, priority }) for the report
│   └── random.ts               # unique suffix for test data
├── tests/login.spec.ts         # TC-APH-001 login + logout
├── tests/allCompanies.spec.ts  # All Companies scenarios (added one by one)
├── reporters/executionReport.ts# Test Execution Report + screenshot gallery
├── report-notes/               # optional report cards (see its README)
├── explore/                    # dump a page's elements to write locators
└── .github/workflows/          # CI (headless Chromium)
```

Layers only talk downward: **spec → flow / fixture → page object → BasePage**. Specs never hold locators or test data.

---

## Getting started

```powershell
npm install
npx playwright test                       # DEMO mode: headed and slow
$env:DEMO='false'; npx playwright test    # fast, headless
npm run report                            # Playwright HTML report
npm run typecheck                         # TypeScript check, no run
```

`tests/login.spec.ts` logs in with the `.env` account, checks the Console, then logs out.

---

## Configuration (`config/testConfig.ts`)

| Variable | Default | Purpose |
|---|---|---|
| `ENV_NAME` | `UAT-APH` | Environment name in the report header |
| `BASE_URL` | `https://10.0.1.30:35190` | APH System Portal |
| `IGNORE_HTTPS_ERRORS` | `true` | Accept the UAT self-signed certificate |
| `PROJECT_NAME` / `SYSTEM_LABEL` | `APH Automation` / `UAT-APH (https://10.0.1.30:35190)` | Report header |
| `TEST_ID_PREFIX` | `TC-APH` | Test case ID prefix |
| `APP_USERNAME` / `APP_PASSWORD` | from `.env` | Login account. Never commit |
| `BLOCKED_PAGE_TEXT` | `Web Page Blocked!` | Firewall block text; empty turns the check off |
| `DEMO` | `true` locally, `false` on CI | Headed + slow vs headless + fast |
| `MOBILE` / `MOBILE_DEVICE` | `false` / `Pixel 7` | Phone-sized run |
| `REPORT_DIR` | `execution-report` | Report folder |
| `REPORT_TIMEZONE` / `REPORT_TIMEZONE_SHORT` | `Asia/Kuala_Lumpur` / `KL` | Report timestamps |
| `REPORT_GENERATOR` / `PYTHON` | `~/skills/02 automation test execution report template package - legacy/generate_report.py` / `python` | Renders the report HTML |
| `EXPLORE_OUT` | `test-results/explore-dumps` | Where `explore/` writes dumps |

Timeouts (`test`, `expect`, `pageLoad`, `action`) are in the same file.

---

## Adding things

**A new test case:** add data in `test-data/` if needed, then a `test()` in the right spec, tagged with `testCase({ id, module, priority })`.

**A new page:**
1. Dump it: copy `explore/afterLogin.explore.ts` (logs in, then dumps), then `npx playwright test --config explore/explore.config.ts explore/<name>.explore.ts`. Read `test-results/explore-dumps/*.txt` for locators.
2. Create `pages/<Name>Page.ts` extending `BasePage`: locators in the constructor, action and verify methods below.
3. Register it in `fixtures/pages.ts` (import, add to `PageObjects`, add one fixture).
4. Use it in a spec, or in a flow if several specs pass through it.

**Evidence:** call `captureScreen('label')` (or `captureFullBox(locator, 'label')` for scrolling panels) at each important point. Screenshots show up in the report gallery in order.

**Missing input:** stop the test with an error starting `HUMAN ACTION REQUIRED:` and say what is needed (see `flows/loginFlow.ts`).

---

## Reporting

Each run writes:

1. `playwright-report/`: Playwright's own report (`npm run report`)
2. `execution-report/` (or `execution-report-mobile/`):
   - `data/test_case_library.json` and `data/last_execution_results.json`
   - `evidence/<TC-ID>/NN-label.png` and `evidence/manifest.json`
   - `test_execution_report.html` plus a dated single-file copy, **only if** `generate_report.py` is found (`REPORT_GENERATOR`). Without it the data and screenshots are still written, and a warning is printed.

Statuses: `pass`, `fail`, `blocked-env`, `skipped`, `not-run`. `npm run report:rebuild` re-renders the last results without running tests.
