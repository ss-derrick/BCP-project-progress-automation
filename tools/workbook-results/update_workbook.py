"""Write automation results into a test case workbook (.xlsx).

After a run, every sheet case linked to automated tests (report-notes/<env>/sheet_links.json)
gets its yellow execution columns filled in the workbook's "Test Case Library" sheet:

    Status          Pass / Fail / Blocked (several tests on one case: Fail if any failed,
                    Blocked if any was blocked by the environment, Pass if all passed)
    Actual Result   "Automation 2026-11-20 11:50 MYT (UAT-APH): TC-CS-002 pass, TC-CS-003 pass"
    Tester          "Automation (Playwright)"
    Execution Date  2026-11-20
    Build           --build (default "UAT <date>")

Defect ID is never touched. Rows are found by the TC ID in the "TC ID" column (not by the row
numbers in sheet_links.json), so inserted / moved rows do not matter. Cases whose tests did not
run (skipped / not run) are left as they are. A backup copy is saved before the file is changed.

    python update_workbook.py --workbook <file.xlsx> --mapping <sheet_links.json>
        --results <last_execution_results.json> --env UAT-APH [--build "UAT 20 Nov 2026"]
        [--tester "Automation (Playwright)"] [--backup-dir <folder>] [--dry-run]
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timedelta, timezone

from openpyxl import load_workbook

MYT = timezone(timedelta(hours=8))
COLUMNS = ["TC ID", "Status", "Actual Result", "Tester", "Execution Date", "Build"]
RESULT_TEXT = {"pass": "pass", "fail": "FAIL", "blocked-env": "blocked (environment)"}


def case_status(statuses):
    if "fail" in statuses:
        return "Fail"
    if "blocked-env" in statuses:
        return "Blocked"
    return "Pass"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workbook", required=True)
    ap.add_argument("--mapping", required=True)
    ap.add_argument("--results", required=True)
    ap.add_argument("--env", required=True)
    ap.add_argument("--build")
    ap.add_argument("--tester", default="Automation (Playwright)")
    ap.add_argument("--backup-dir")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    mapping = json.load(open(a.mapping, encoding="utf-8"))
    results = json.load(open(a.results, encoding="utf-8"))
    sheet_name = mapping.get("sheet", "Test Case Library")
    now = datetime.now(MYT)
    build = a.build or f"UAT {now:%d %b %Y}"

    # sheet case -> [(automation id, status, notes)] for tests that ran
    by_case = {}
    ran = {r["id"]: r for r in results if r.get("status") in RESULT_TEXT}
    for test_id, links in mapping.get("links", {}).items():
        if test_id not in ran:
            continue
        for link in links:
            by_case.setdefault(link["sheetId"], []).append(ran[test_id])
    if not by_case:
        print("[workbook] nothing to write: no mapped test ran")
        return 0

    wb = load_workbook(a.workbook)
    if sheet_name not in wb.sheetnames:
        print(f"[workbook] sheet '{sheet_name}' not found in {a.workbook}", file=sys.stderr)
        return 1
    ws = wb[sheet_name]

    # header row = first row that has "TC ID"
    header_row, cols = None, {}
    for r in range(1, 11):
        # header text with line breaks / double spaces (e.g. "Execution" + line break + "Date") = one name
        names = {" ".join(str(c.value).split()): c.column for c in ws[r] if c.value is not None}
        if "TC ID" in names:
            header_row, cols = r, names
            break
    missing = [c for c in COLUMNS if c not in cols]
    if header_row is None or missing:
        print(f"[workbook] columns not found in '{sheet_name}': {missing or COLUMNS}", file=sys.stderr)
        return 1

    rows = {}
    for r in range(header_row + 1, ws.max_row + 1):
        v = ws.cell(r, cols["TC ID"]).value
        if v:
            rows[str(v).strip()] = r

    written, not_found = [], []
    for case_id, tests in sorted(by_case.items()):
        r = rows.get(case_id)
        if r is None:
            not_found.append(case_id)
            continue
        status = case_status([t["status"] for t in tests])
        parts = []
        for t in tests:
            part = f"{t['id']} {RESULT_TEXT[t['status']]}"
            if t["status"] != "pass" and t.get("notes"):
                part += f" ({t['notes'][:150]})"
            parts.append(part)
        actual = f"Automation {now:%Y-%m-%d %H:%M} MYT ({a.env}): " + ", ".join(parts)
        values = {"Status": status, "Actual Result": actual, "Tester": a.tester,
                  "Execution Date": f"{now:%Y-%m-%d}", "Build": build}
        for col, val in values.items():
            ws.cell(r, cols[col]).value = val
        written.append((case_id, r, status))

    for case_id, r, status in written:
        print(f"[workbook] {case_id} (row {r}): {status}")
    for case_id in not_found:
        print(f"[workbook] {case_id}: not in the workbook (check sheet_links.json)")
    if a.dry_run:
        print("[workbook] dry run: file not changed")
        return 0

    if a.backup_dir:
        os.makedirs(a.backup_dir, exist_ok=True)
        shutil.copy2(a.workbook, os.path.join(a.backup_dir, f"before-{now:%Y%m%d-%H%M%S}-" + os.path.basename(a.workbook)))

    # Save to the SYSTEM temp folder first (never inside the synced folder: OneDrive would upload
    # the temp file), then copy over the workbook in one write. A locked / open file stays intact.
    fd, tmp = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    try:
        wb.save(tmp)
        shutil.copyfile(tmp, a.workbook)
    except PermissionError:
        print(f"[workbook] {a.workbook} is open / locked (close it in Excel desktop), results NOT written", file=sys.stderr)
        return 2
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    print(f"[workbook] updated {len(written)} case(s) in {a.workbook}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
