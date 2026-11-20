# report-notes

Hand-written notes that the Test Execution Report shows as extra cards.

- **Human Action Required** and **Open Gaps / Limitations** are ALWAYS in the report.
  No file here (or an empty list) -> the card shows one "none" row
  ("No human action required" / "No open gaps or limitations recorded"),
  and the summary page counts them as 0.
- **Investigation** and the sheet links appear only when their file exists.

Per environment: put the files in `report-notes/<env>/` (e.g. `report-notes/uat-fassbayar/`);
without that folder, `report-notes/` is used for every environment.

| File | Card in the report |
|---|---|
| `human_action_items.json` | Human Action Required |
| `investigation_items.json` | Investigation / Evidence-Gathering Results |
| `gaps.json` | Open Gaps / Limitations |
| `sheet_links.json` | Adds a link under each Test Case ID to its row in an Excel test case sheet |

## Formats

`human_action_items.json`
```json
[
  {
    "id": "TC-APH-012",
    "module": "Login",
    "title": "Login with SSO",
    "reason": "SSO needs a real phone approval, which automation cannot do.",
    "recommended_handling": "Test by hand before each release."
  }
]
```

`gaps.json`
```json
[
  {
    "id": "GAP-001",
    "status": "Open",
    "description": "What is not covered.",
    "impact": "What could break without anyone noticing."
  }
]
```

`sheet_links.json`: adds a **"Test Case ID (<sheet>)" column** next to the Automation ID in
"All test cases": the Excel test case ID(s) of the same scenario, each opening the workbook at its row
(Excel Online). The search box also finds them; tests with no row in the sheet show "-".
Usually one per portal: `report-notes/uat-aph/sheet_links.json`, `report-notes/uat-fassbayar/sheet_links.json`.
```json
{
  "workbookUrl": "https://<sharepoint link to the .xlsx>",
  "workbookName": "SSR-xxx_System_Portal_Test_Cases_v1.0.xlsx",
  "sheet": "Sheet name",
  "columnLabel": "Test Case ID (SSR-xxx v1.0)",
  "links": {
    "TC-COMP-001": [ { "sheetId": "TC-SP-COMP-001", "row": 5 } ],
    "TC-CS-005":   [ { "sheetId": "TC-SP-CS-010", "row": 14 }, { "sheetId": "TC-SP-CS-011", "row": 15 } ]
  }
}
```
`workbookName` (tooltip) and `columnLabel` are optional; `row` = the Excel row number.
