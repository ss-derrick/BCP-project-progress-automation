> **Note (18 Nov 2026):** older notes from before the restructure. Folder names, setup and run commands here are out of date: see the root `README.md`. Kept for the scenario descriptions.

# FassBayar automation

End-to-end UI test automation for the **FassBayar System Portal** (UAT-Fassbayar), built with **Playwright + TypeScript**, following the same structure as [`ecom-automation`](https://github.com/ss-derrick/ecom-automation).

A sub-project of **BCP** (see `../README.md`). Run every command below from this `FassBayar/` folder.

> Target: `https://10.0.1.30:36190` (internal network only). Test case IDs: `TC-FASSBAYAR-001` to `012`.

## Setup: credentials

Create a `.env` file in this `FassBayar/` folder (git-ignored, never commit it):

```
APP_USER=<portal user>
APP_PASSWORD=<portal password>
# optional: the authoriser email becomes a unique +alias of this mailbox
NOTIFY_EMAIL=you@company.com
```

> **Each tester uses their own login.** When copying this project to someone, do NOT include
> `.env`: they create their own. Credentials appear in no other file.
>
> Traces are off by default because a trace records the typed password. For one debugging
> run: `$env:TRACE='on'; npx playwright test ...`, and never share a report made that way.
>
> The portal allows **one session per user**, so tests run serially (`workers: 1`).
> Don't use the same account in a browser while the suite is running.

## Covered flows

| Spec | Flow | Test case |
|---|---|---|
| `addCompany.spec.ts` | Login → All Companies → Add a Company → fill every field with random unique data → Review & Confirm → Complete → View Company Details: every value checked, company Active (enabled) | TC-FASSBAYAR-001 |
| `searchCompany.spec.ts` | Login → All Companies → search MID `000452839489382` → check result row (business name, authoriser, status) → Quicklink "View Details" → Go → Company Details shows that MID | TC-FASSBAYAR-002 |
| `bulkCompanyUpload.spec.ts` | Login → All Companies → Bulk Company Upload (Create) → "download template" → file is `sampleBulkCompanyMobileUserUpload.csv`, not empty, header has the key columns (attached to the report) | TC-FASSBAYAR-003 |
| `bulkCompanyUpload.spec.ts` | Same page → download template → Upload CSV with that file → Upload → `/company/upload` shows "File successfully uploaded, you will receive an email after few minutes." | TC-FASSBAYAR-004 |
| `bulkCompanyEditUpload.spec.ts` | Bulk Company Upload (Edit) → "download template" → `sampleBulkCompanyEditUpload.csv` with header `CompanyID;Business Name;Reference1..5` | TC-FASSBAYAR-005 |
| `bulkCompanyEditUpload.spec.ts` | Download template → fill one row: company `EDIT_COMPANY_ID` (default 2089, created by this automation) + random Reference 1–5 → Upload → CSV List: 1 row, 0 errors, "All rows are valid" → Apply Changes → "Special fields updated successfully." → company details show the new references | TC-FASSBAYAR-006 |
| `bulkCompanyEditUpload.spec.ts` | Download template → upload it unchanged → "The file has errors… No changes have been made." (sample CompanyID does not exist) | TC-FASSBAYAR-007 |
| `addParentCompany.spec.ts` | Login → All Companies → Add a Parent Company → random unique Business + Authoriser details, API Auth / SSO off, Merchant Type "Master Merchant" → Submit → Review & Confirm → Confirm → Complete (MID `N/A`) → View Company Details: Parent Company Details shows every value | TC-FASSBAYAR-008 |
| `parentCompanySummary.spec.ts` | Parent Company Summary → take the newest row's **business name** → search → that parent company is listed | TC-FASSBAYAR-009 |
| `parentCompanySummary.spec.ts` | Same, searching by the newest row's **authoriser** | TC-FASSBAYAR-010 |
| `uploadCompanyLogo.spec.ts` | Upload Company Logo → generated random 400×180 PNG → Next → move ONE company (newest automation-created company without a logo) with "›" → Next → Review lists it → Confirm → "Your request is successful", 1 company updated | TC-FASSBAYAR-011 |
| `removeCompanyLogo.spec.ts` | Remove Company Logo → move ONE company (first automation-created company that has a logo) with "›" → Submit → Review lists it → Confirm → "Your request is successful", 1 company updated → company no longer in the remove list | TC-FASSBAYAR-012 |

Logo image: generated fresh on every run, so no image file is needed. To upload your own:
`$env:LOGO_FILE='C:\path\logo.png'`. Choose the company: `$env:LOGO_COMPANY_ID='2103'`
(the list only offers companies that have no logo yet).

> **Known bug (17 Nov 2026):** TC-FASSBAYAR-009/010 fail. Parent Company search redirects (302) to
> `/issue/generalError` ("An error has occurred…") whenever the search has matches; a search with
> no matches loads normally. The same name searched on Company Summary works.

Search another MID for one run: `$env:SEARCH_MID='...'; npx playwright test tests/searchCompany.spec.ts`

Test data comes from `createCompanyData()` in `test-data/companyData.ts`: business name, BRN/SST/TIN, address (state/city/postcode match), contact numbers, authoriser name/email/User ID prefix, bank and account, MCC, limits, references, MID (15 digits) and DBA are all random and unique per run. Merchant configuration (service provider, card schemes, payment types, settings) is fixed to the agreed example; override any field with `createCompanyData({ ... })`.

## Tech stack

| Item | Choice |
|---|---|
| Test runner | `@playwright/test` (v1.64+) |
| Language | TypeScript |
| Browser | Microsoft Edge (`channel: 'msedge'`) |
| Design pattern | Page Object Model + custom fixtures + reusable flows |
| Reports | Playwright HTML report + custom **Test Execution Report** reporter |
| CI | Not set up yet: tests are run by hand from the office network |

## Project structure

```
FassBayar/
├── config/testConfig.ts               # BASE_URL, run modes, timeouts, test ID prefix
├── fixtures/pages.ts                  # extended test + page object fixtures
├── flows/                             # reusable multi-page journeys
├── pages/                             # Page Objects (all extend BasePage)
│   └── BasePage.ts
├── test-data/                         # test data + constants
├── utils/                             # helpers (testCase metadata, ...)
├── tests/                             # *.spec.ts test suites
├── reporters/executionReport.ts       # custom Test Execution Report reporter
├── report-notes/                      # hand-written gaps / action items for the report
├── explore/                           # locator exploration scripts (not part of the suite)
└── playwright.config.ts
```

## Getting started

```powershell
npm install
npx playwright install        # only needed for CI-style Chromium runs
```

## Running tests

| Goal | Command (PowerShell) |
|---|---|
| Run everything (DEMO mode locally) | `npx playwright test` |
| Fast, headless run | `$env:DEMO='false'; npx playwright test` |
| One spec file | `npx playwright test tests/<name>.spec.ts` |
| Mobile web (Pixel 7) | `$env:MOBILE='true'; npx playwright test` |
| Another environment | `$env:BASE_URL='https://...'; npx playwright test` |
| Open the Playwright HTML report | `npm run report` |

| Mode | When | Behaviour |
|---|---|---|
| **DEMO** | Default locally | Headed, `slowMo` 1.5 s, slow typing, pauses |
| **FAST** | Default on CI (`DEMO=false`) | Headless, no artificial waits |
| **MOBILE** | `MOBILE=true` | Phone viewport; report goes to `execution-report-mobile/` |

## Writing a new test

1. **Data:** add data in `test-data/`.
2. **Page objects:** add a class in `pages/` that extends `BasePage`, then register it in `fixtures/pages.ts`.
3. **Flow:** put shared multi-page steps in `flows/`.
4. **Spec:** tag the test so it appears in the report:

```ts
import { test } from '../fixtures/pages';
import { testCase } from '../utils/testCase';

test(
  'Login with valid credentials',
  testCase({ id: 'TC-FASSBAYAR-001', module: 'Login', priority: 'High' }),
  async ({ loginPage }) => {
    // ...
  }
);
```

5. **Evidence:** call `captureScreen('label')` or `captureFullBox(locator, 'label')` at key points.

## Reporting

1. **Playwright HTML report:** `playwright-report/` (`npm run report`).
2. **Test Execution Report:** `reporters/executionReport.ts` writes `execution-report/` (data JSON, evidence screenshots, HTML). The HTML is rendered by the external `generate_report.py` template package, which must be on the machine (`REPORT_GENERATOR` / `PYTHON` env variables override its location).

## CI

Not set up for now (the GitHub Actions workflow was removed on 17 Nov 2026). If it is added
later: the portal is on a private IP (10.0.1.30), so GitHub's own runners can't reach it. CI
would need a **self-hosted runner** inside the office network, with `APP_USER` /
`APP_PASSWORD` stored as repository secrets.
