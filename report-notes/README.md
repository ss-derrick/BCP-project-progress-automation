# report-notes

Hand-written notes that the Test Execution Report shows as extra cards.
Every file is optional: a card appears only when its file exists here.
None exist yet, so the report shows no extra cards.

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

`sheet_links.json`
```json
{
  "workbookUrl": "https://<sharepoint link to the .xlsx>",
  "sheet": "Sheet name",
  "links": {
    "TC-APH-001": [ { "sheetId": "TC-APH-LOGIN-001", "row": 5 } ]
  }
}
```
