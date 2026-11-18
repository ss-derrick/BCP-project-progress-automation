# BCP automation

UI test automation for the **BCP System Portals**, built with **Playwright + TypeScript**. One codebase for every portal: APH and FassBayar are the same Soft Space System Portal (same login, menus, field ids, rules), so code is written **once** in `common/`, and the portal folders only hold what is really different.

| Environment (`ENV_NAME`) | Portal | UAT address | Test IDs |
|---|---|---|---|
| `UAT-APH` | APH (Aeon Payment Hub) | `https://10.0.1.30:35190` | `TC-APH-…` |
| `UAT-FASSBAYAR` | FassBayar | `https://10.0.1.30:36190` | `TC-FASSBAYAR-…` |

Both portals are on the internal network only.

## Structure

```
BCP Project/
├── .env                  # local only: ENV_NAME + each environment's URL, user, password
├── .env.example          # same keys, no secrets
├── portals.config.ts     # THE config: environments -> portal, what each portal's screens have
├── playwright.config.ts  # ONE config: runs common/tests + <portal>/tests for ENV_NAME
├── scripts/pw.js         # runs Playwright for one environment (used by npm run test:*)
│
├── common/               # written once, runs on every portal
│   ├── config/           # testConfig.ts (run settings from .env), portals.ts (types + field ids)
│   ├── hosts/            # HOSTS (Service Providers): card schemes + payment types per host
│   ├── creation/         # random unique data builders: company (new 15-digit MIDs), parent company
│   ├── pages/            # shared page objects: BasePage, LoginPage, company/Add(Parent)CompanyPage ...
│   ├── flows/            # journeys: add a company, add a parent company (confirm:false = dry run)
│   ├── fixtures/base.ts  # base test: shared pages + blocked-page check
│   ├── tests/            # scenarios that run on BOTH portals (moved here one by one)
│   ├── reporters/        # Test Execution Report + BCP summary page
│   ├── utils/            # random, portalDate, testCase()
│   ├── locators/         # login screen selectors
│   └── explore/          # read-only probe of a company form (fields + what every host offers)
│
├── aph/                  # only what is different on APH
│   ├── pages/  fixtures/  tests/  testdata/  flows/
├── fassbayar/            # only what is different on FassBayar
│   ├── pages/  fixtures/  tests/  testdata/  flows/
│
├── explore/              # locator-finding scripts (not the suite): aph/, fassbayar/, explore-dumps/
├── report-notes/<ENV>/   # gaps / human-action items shown in that environment's report
├── reports/<ENV>/        # execution-report/ + playwright-report/ per environment
└── BCP_Test_Summary.html # generated: latest results of every environment
```

### Rules that keep it clean

1. A file goes in `common/` unless it only makes sense on one portal.
2. A portal file never copies a common file; it extends it and changes only what differs.
3. Tests never say `if (portal === ...)`. A section that is **present or missing** on a portal is a flag in `portals.config.ts` (the shared page skips it); a screen that **behaves** differently gets a portal page that extends the common one.
4. `aph/` and `fassbayar/` never import each other; both import from `common/`.

## Setup (once)

1. Install in this folder:
   ```powershell
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in **your own** logins for each environment. `.env` is never shared or committed. Both portals allow only **one session per user**, so two people on the same account log each other out.

## Running

| Goal | Command (PowerShell) |
|---|---|
| APH tests | `npm run test:aph` |
| FassBayar tests | `npm run test:fassbayar` |
| Both, one after the other | `npm run test:all` |
| One file / tag | `npm run test:aph -- aph/tests/login.spec.ts` · `npm run test:aph -- --grep @add-company` |
| Fast, headless | `$env:DEMO='false';` in front, e.g. `$env:DEMO='false'; npm run test:all` |
| Phone screen | `$env:MOBILE='true';` in front |
| Playwright report | `npm run report:aph` / `npm run report:fassbayar` |
| Type-check everything | `npm run typecheck` |

`npx playwright test` alone runs the environment set by `ENV_NAME` in `.env`.

## Add a Company / Add a Parent Company (shared by every portal)

| To change… | Edit |
|---|---|
| A locator or step of the form | `common/pages/company/AddCompanyPage.ts` (Business / Authoriser / Submit / Confirm: `CompanyFormPage.ts`; parent form: `AddParentCompanyPage.ts`) |
| Which sections a portal has (Bank, MCC, SST/TIN, DBA, SSO…) | `PORTALS` in `portals.config.ts` |
| **Test another host** (GP, CIMB, HLB, TPA, UOB, OCBC…) | in the test: `createCompanyData({ hosts: ['GP'] })`; host defaults in `common/hosts/hosts.ts` |

Rules the form enforces (found on UAT, handled by the shared code):
- Every MID is a new random **unique 15-digit** number on each run.
- A card scheme can be used by **one MID only** per company: with several MIDs each gets its own scheme.
- AmBank: Retail and MyDebit are linked (both ticked). Fasspay QR Host needs a QR wallet ticked (and on FassBayar a card scheme, not shown on review). AEON360 has no Card Scheme field.
- Only FassBayar has the SSO box on Add a Parent Company.

**Dry runs** (fill the form, Submit, check Review: **never Confirm, create nothing**):

```powershell
npm run explore:aph -- explore/aph/addCompanyDryRun.explore.ts          # one MID per APH host
npm run explore:fassbayar -- explore/fassbayar/addCompanyDryRun.spec.ts  # one MID per FassBayar host
npm run explore:aph -- explore/aph/addParentCompanyDryRun.explore.ts    # both Merchant Types
npm run explore:fassbayar -- explore/fassbayar/addParentCompanyDryRun.spec.ts
```
One host only: `$env:HOSTS='GP';` in front.

## Reports

| Report | Where |
|---|---|
| **BCP summary** (all environments: pass / not passed, last run, failed tests, links) | `BCP_Test_Summary.html` |
| Test Execution Report per environment (every test with screenshots, gaps, human action items) | `reports/<ENV>/execution-report/test_execution_report.html` |
| Playwright HTML report | `reports/<ENV>/playwright-report/` |

The summary is rebuilt at the end of every run. Each environment shows its **own** last run. Rebuild reports without running tests: `npm run test:aph -- --list` (or `test:fassbayar`).

## Still to do (next steps of the restructure)

- Merge the page pairs that cover the same screen (company list, company details, parent summary / details, home / console) into `common/pages/`, then one login flow in `common/flows/`.
- Move scenarios that pass on both portals into `common/tests/` (first: Add a Company, Add a Parent Company). Needs a portal-neutral test ID scheme (e.g. `TC-COMP-001`).
- Host profiles: add MID length / suffix per host (Maybank AMEX MIDs are 10 digits; the list shows `<mid>-ACS`).
