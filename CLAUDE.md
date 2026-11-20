# Project instructions

## Record every change in CHANGELOG.md
Every time anything in this project is added, changed or removed, add an entry at the TOP of the
"Changes" section of `CHANGELOG.md` (and a link in its list), in the same change:
- date + Malaysia time (MYT) + short title, e.g. `### 2026-11-20 11:15: ...`
- **Why** (the request / reason)
- table: file / folder -> New / Changed / Removed + what
- **Key code**: the important lines
- **How to run / check**: the command(s)

Follow the template at the top of `CHANGELOG.md`. Newest first.
Add a flow / diagram (```mermaid block) or an image (`docs/images/`) when it makes the change clearer.

## Project rules (from README.md)
- Shared code goes in `common/`; only portal-specific code goes in `aph/` or `fassbayar/`.
- Tests are grouped by menu module: `tests/login/`, `home/`, `allCompanies/`, `manageMobileUsers/`, `manageReaders/`, `manageTransactions/`, `manageCreditSettlements/`, `administrator/` (spec imports `../../fixtures/...`). `pages/`, `fixtures/`, `testdata/` stay flat.
- Tests never branch on the portal: differences go in `portals.config.ts`, host profiles or portal page overrides.
- Tests run one at a time (one session per user). TC-COMP-001 creates real data.
- Never commit `.env`.
