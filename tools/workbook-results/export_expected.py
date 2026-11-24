"""Export what the Excel sheet EXPECTS for every automated test, for the failure screenshots.

For each Automation ID in report-notes/<env>/sheet_links.json, reads its linked case(s) from the workbook's
"Test Case Library" sheet (found by TC ID, like update_workbook.py) and writes:

    { "TC-ADM-022": [ { "sheetId": "TC-APH-BP-ADM-022", "row": 241, "title": "...",
                        "steps": "...", "expected": "..." } ], ... }

The output stays LOCAL (git-ignored): it is the sheet's internal text and the repo is public.
Read-only: the workbook is opened read-only and never saved.

    python export_expected.py --workbook <file.xlsx> --mapping <sheet_links.json> --out <sheet_expected.json>
"""
import argparse
import json
import re
import sys

from openpyxl import load_workbook


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workbook", required=True)
    ap.add_argument("--mapping", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    links = json.load(open(a.mapping, encoding="utf8"))["links"]
    ws = load_workbook(a.workbook, read_only=True, data_only=True)["Test Case Library"]
    rows = ws.iter_rows(values_only=True)
    norm = lambda v: re.sub(r"\s+", " ", str(v or "")).strip()
    header = [norm(v) for v in next(rows)]
    col = {name: header.index(name) for name in ("TC ID", "Test Case Title", "Steps", "Expected Result") if name in header}
    if "TC ID" not in col or "Expected Result" not in col:
        sys.exit(f"[expected] columns TC ID / Expected Result not found in {a.workbook}")
    by_id = {}
    for i, r in enumerate(rows, start=2):
        tc = norm(r[col["TC ID"]]) if len(r) > col["TC ID"] else ""
        if tc:
            by_id[tc] = {"row": i,
                         "title": norm(r[col["Test Case Title"]]) if "Test Case Title" in col else "",
                         "steps": str(r[col["Steps"]] or "").strip() if "Steps" in col else "",
                         "expected": str(r[col["Expected Result"]] or "").strip()}
    out = {}
    for auto_id, cases in links.items():
        found = [dict(sheetId=c["sheetId"], **by_id[c["sheetId"]]) for c in cases if c["sheetId"] in by_id]
        if found:
            out[auto_id] = found
    json.dump(out, open(a.out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"[expected] {len(out)} automated test(s) with their sheet Expected Result -> {a.out}")


if __name__ == "__main__":
    main()
