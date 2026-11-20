#!/usr/bin/env python3
"""
Generate a self-contained HTML test execution report.

Two report types, selected by report_config.json's "report_type" field
(or --report-type on the command line):

  lite  - a compact pass/fail/skip dashboard with search + filters, plus
          three optional cards (Human Action Required, Investigation /
          Evidence-Gathering Results, Open Gaps / Limitations) that only
          render when their data files are provided. Good for a quick
          look after a routine regression run, or a fuller one when you
          need those extras without the rest of "full"'s structure.
  full  - a separate, more document-like layout (header meta grid,
          status banner, executive summary, Blocked/Not-Run analysis,
          Evidence Appendix, etc.) for a report meant to stand alone as
          a stakeholder-facing execution record.

Usage:
    python3 generate_report.py --config sample-data/lite/report_config.json
    python3 generate_report.py --config sample-data/full/report_config.json

See README.md for both schemas.
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from jinja2 import Environment, FileSystemLoader, select_autoescape

SCRIPT_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = SCRIPT_DIR / "template"

# ---------------------------------------------------------------- helpers --

def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def make_resolver(base_dir: Path):
    """Resolve a data-file path relative to the config file's own directory,
    unless it's already absolute or already exists relative to the CWD."""
    def resolve(p) -> Path:
        p = Path(p)
        return p if p.is_absolute() or p.exists() else (base_dir / p)
    return resolve


def load_optional(config: dict, key: str, resolve, default=None):
    path = config.get(key)
    if not path:
        return default if default is not None else []
    return load_json(resolve(path))


def load_optional_text(config: dict, inline_key: str, path_key: str, resolve):
    if config.get(path_key):
        return resolve(config[path_key]).read_text(encoding="utf-8")
    return config.get(inline_key)


def classify_severity(text: str) -> str:
    """Best-effort keyword coloring for free-text severity values -> good/bad/warn/neutral."""
    t = (text or "").strip().lower()
    if any(k in t for k in ("critical", "blocker", "high")):
        return "bad"
    if any(k in t for k in ("medium", "moderate")):
        return "warn"
    return "neutral"


def classify_status(text: str) -> str:
    """Best-effort keyword coloring for free-text status values -> good/bad/warn/neutral."""
    t = (text or "").strip().lower()
    if any(k in t for k in ("open", "blocked", "overdue", "urgent", "failing")):
        return "bad"
    if any(k in t for k in ("progress", "pending", "investigating", "partial", "limited", "waiting")):
        return "warn"
    if any(k in t for k in ("resolved", "closed", "done", "complete", "passed", "mitigated", "fixed")):
        return "good"
    return "neutral"


def render(template_name: str, context: dict, output_path: Path):
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "j2"]),
        trim_blocks=True,
    )
    html = env.get_template(template_name).render(**context)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")


def generated_at_now(config: dict) -> str:
    if config.get("generated_at"):
        return config["generated_at"]
    tz = ZoneInfo(config.get("timezone", "UTC"))
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S %z")


# -------------------------------------------------------------- lite mode --

LITE_STATUS_ORDER = ["pass", "fail", "blocked-env", "skipped", "not-run"]
LITE_STATUS_META = {
    "pass":        {"label": "Pass",                       "color_class": "pass"},
    "fail":        {"label": "Fail",                       "color_class": "fail"},
    "blocked-env": {"label": "Blocked (environment)",  "color_class": "blocked"},
    "skipped":     {"label": "Skipped",                    "color_var": "--skipped"},
    "not-run":     {"label": "Not run",                    "color_class": "notrun"},
}
LITE_BADGE_LABEL = {
    "pass": "Pass", "fail": "Fail", "blocked-env": "Blocked (environment)",
    "skipped": "Skipped", "not-run": "Not Run",
}


def lite_fmt_duration(seconds) -> str:
    if seconds is None:
        return "—"
    try:
        return f"{round(float(seconds), 2)}s"
    except (TypeError, ValueError):
        return "—"


def lite_build_rows(library: list, results: list) -> list:
    results_by_id = {r["id"]: r for r in results}
    seen_ids = set()
    rows = []
    for case in library:
        tc_id = case["id"]
        seen_ids.add(tc_id)
        res = results_by_id.get(tc_id, {})
        status = res.get("status", "not-run")
        if status not in LITE_BADGE_LABEL:
            print(f"warning: unknown status {status!r} for {tc_id}, treating as not-run", file=sys.stderr)
            status = "not-run"
        rows.append({
            "id": tc_id, "module": case["module"], "title": case["title"],
            "priority": case.get("priority", ""), "status": status,
            "status_label": LITE_BADGE_LABEL[status],
            "last_executed": res.get("last_executed", ""),
            "duration": lite_fmt_duration(res.get("duration_seconds")),
            "evidence": res.get("evidence") or None,
            "notes": res.get("notes", "") or "",
        })
    orphans = set(results_by_id) - seen_ids
    if orphans:
        print(f"warning: {len(orphans)} execution result(s) have no matching library entry: "
              f"{', '.join(sorted(orphans))}", file=sys.stderr)
    return rows


def lite_build_stats(rows: list) -> list:
    counts = {s: 0 for s in LITE_STATUS_ORDER}
    for r in rows:
        counts[r["status"]] += 1
    stats = [{"n": len(rows), "l": "Total", "color_class": None, "color_var": None}]
    for status in LITE_STATUS_ORDER:
        meta = LITE_STATUS_META[status]
        stats.append({"n": counts[status], "l": meta["label"],
                       "color_class": meta.get("color_class"), "color_var": meta.get("color_var")})
    return stats


def lite_build_coverage(rows: list) -> list:
    modules = {}
    for r in rows:
        m = modules.setdefault(r["module"], {s: 0 for s in LITE_STATUS_ORDER})
        m[r["status"]] += 1
    coverage = []
    for module in sorted(modules):
        c = modules[module]
        total = sum(c.values())
        executed = total - c["not-run"]
        pct = round((executed / total * 100), 1) if total else 0.0
        coverage.append({"module": module, "total": total, "pass": c["pass"], "fail": c["fail"],
                          "blocked": c["blocked-env"], "skipped": c["skipped"], "notrun": c["not-run"],
                          "executed_pct": pct})
    return coverage


def generate_lite(config: dict, resolve, output_path: Path):
    library = load_json(resolve(config["library_path"]))
    results = load_json(resolve(config["results_path"]))

    rows = lite_build_rows(library, results)
    stats = lite_build_stats(rows)
    coverage_rows = lite_build_coverage(rows)
    module_options = sorted({r["module"] for r in rows})

    # Optional extras — each renders only when its data file is provided.
    human_action_items = load_optional(config, "human_action_path", resolve)
    investigation_items = load_optional(config, "investigation_path", resolve)
    gaps = load_optional(config, "gaps_path", resolve)
    for g in gaps:
        g["status_class"] = classify_status(g.get("status", ""))
    gap_ids = {g["id"] for g in gaps}

    render("test_execution_report.html.j2", dict(
        project_name=config["project_name"],
        system_label=config["system_label"],
        run_context=config.get("run_context", ""),
        timezone=config.get("timezone", "UTC"),
        timezone_short=config.get("timezone_short", ""),
        generated_at=generated_at_now(config),
        scope_label=config.get("scope_label", ""),
        library_path=str(config["library_path"]),
        results_path=str(config["results_path"]),
        total_count=len(rows),
        stats=stats,
        coverage_rows=coverage_rows,
        module_options=module_options,
        rows=rows,
        human_action_items=human_action_items,
        investigation_items=investigation_items,
        gaps=gaps,
        gap_ids=gap_ids,
    ), output_path)
    extras = []
    if human_action_items:
        extras.append(f"{len(human_action_items)} not-automatable")
    if investigation_items:
        extras.append(f"{len(investigation_items)} investigation")
    if gaps:
        extras.append(f"{len(gaps)} gaps")
    extra_note = f", {', '.join(extras)}" if extras else ""
    print(f"wrote {output_path} (lite, {len(rows)} test cases, {len(coverage_rows)} modules{extra_note})")


# -------------------------------------------------------------- full mode --

FULL_STATUSES = ["pass", "fail", "blocked", "not-run", "not-verified"]
FULL_STATUS_ALIASES = {
    "pass": "pass", "passed": "pass",
    "fail": "fail", "failed": "fail",
    "blocked": "blocked", "block": "blocked",
    "not-run": "not-run", "not run": "not-run", "notrun": "not-run",
    "not-verified": "not-verified", "not verified": "not-verified", "notverified": "not-verified",
}
FULL_STATUS_LABEL = {
    "pass": "Pass", "fail": "Fail", "blocked": "Blocked",
    "not-run": "Not Run", "not-verified": "Not Verified",
}


def normalize_full_status(raw: str) -> str:
    key = (raw or "").strip().lower()
    return FULL_STATUS_ALIASES.get(key, "not-run" if not key else "not-verified")


def classify_overall(text: str) -> str:
    # Order matters: an explicit "partial"/"limited" is the reporter's deliberate
    # headline word and usually explains itself with "...blocked" or "...failed"
    # right after it, so it must win over those more generic keywords.
    t = (text or "").strip().lower()
    if "partial" in t or "limited" in t:
        return "partial"
    if "fail" in t:
        return "failed"
    if "block" in t:
        return "blocked"
    if "pass" in t or "complete" in t or "success" in t:
        return "passed"
    return ""


def full_build_rows(library: list, results: list) -> list:
    results_by_id = {r["id"]: r for r in results}
    seen_ids = set()
    rows = []
    for case in library:
        tc_id = case["id"]
        seen_ids.add(tc_id)
        res = results_by_id.get(tc_id, {})
        status = normalize_full_status(res.get("status")) if res else "not-run"
        rows.append({
            "id": tc_id, "module": case["module"], "scenario": case.get("scenario", case.get("title", "")),
            "priority": case.get("priority", ""), "expected_result": case.get("expected_result", ""),
            "status": status, "status_label": FULL_STATUS_LABEL[status],
            "actual_result": res.get("actual_result", ""),
            "evidence": res.get("evidence") or None,
            "verified_by": res.get("verified_by", ""),
            "last_executed": res.get("last_executed", ""),
            "gap_ref": res.get("gap_ref", ""),
            "notes": res.get("notes", "") or "",
        })
    orphans = set(results_by_id) - seen_ids
    if orphans:
        print(f"warning: {len(orphans)} execution result(s) have no matching library entry: "
              f"{', '.join(sorted(orphans))}", file=sys.stderr)
    return rows


def full_build_coverage(rows: list) -> list:
    modules = {}
    for r in rows:
        m = modules.setdefault(r["module"], {s: 0 for s in FULL_STATUSES})
        m[r["status"]] += 1
    coverage = []
    for module in sorted(modules):
        c = modules[module]
        total = sum(c.values())
        trustworthy = c["pass"] + c["fail"]
        exec_cov = round(trustworthy / total * 100, 1) if total else 0.0
        pass_rate = round(c["pass"] / trustworthy * 100, 1) if trustworthy else 0.0
        coverage.append({"module": module, "total": total, "trustworthy": trustworthy,
                          "pass": c["pass"], "fail": c["fail"], "blocked": c["blocked"],
                          "notrun": c["not-run"], "execution_coverage": exec_cov, "pass_rate": pass_rate})
    return coverage


def generate_full(config: dict, resolve, output_path: Path):
    library = load_json(resolve(config["library_path"]))
    results = load_json(resolve(config["results_path"]))
    rows = full_build_rows(library, results)

    counts = {s: 0 for s in FULL_STATUSES}
    for r in rows:
        counts[r["status"]] += 1
    total = len(rows)
    trustworthy = counts["pass"] + counts["fail"]
    execution_coverage = round(trustworthy / total * 100, 1) if total else 0.0
    pass_rate = round(counts["pass"] / trustworthy * 100, 1) if trustworthy else 0.0

    human_action_items = load_optional(config, "human_action_path", resolve)
    for item in human_action_items:
        item["severity_class"] = classify_severity(item.get("severity", ""))
        item["status_class"] = classify_status(item.get("status", ""))

    investigation_items = load_optional(config, "investigation_path", resolve)

    blocked_notrun_items = load_optional(config, "blocked_notrun_path", resolve)
    for item in blocked_notrun_items:
        item["status_class"] = classify_status(item.get("status", ""))

    gaps = load_optional(config, "gaps_path", resolve)
    for g in gaps:
        g["status_class"] = classify_status(g.get("status", ""))
    gap_ids = {g["id"] for g in gaps}

    followups = load_optional(config, "followups_path", resolve)

    preflight_checks = load_optional(config, "preflight_path", resolve)
    for c in preflight_checks:
        c["status_class"] = classify_status(c.get("status", ""))

    runtime_and_command = load_optional_text(config, "runtime_and_command", "runtime_and_command_path", resolve)
    raw_execution_logs = load_optional_text(config, "raw_execution_logs", "raw_execution_logs_path", resolve)

    sut_reached = config.get("sut_reached") or ("Yes" if trustworthy > 0 else "No")
    overall_status = config.get("overall_status", "Completed")

    render("test_execution_report_full.html.j2", dict(
        project_name=config["project_name"],
        scope=config.get("scope", ""),
        execution_id=config.get("execution_id", ""),
        environment=config.get("environment", ""),
        automation_framework=config.get("automation_framework", ""),
        generated_at=generated_at_now(config),
        timezone=config.get("timezone", "UTC"),
        source=f'{config["results_path"]} + {config["library_path"]}',
        overall_status=overall_status,
        overall_status_class=classify_overall(overall_status),
        sut_reached=sut_reached,
        trustworthy_verdicts=trustworthy,
        total_count=total,
        pass_count=counts["pass"], fail_count=counts["fail"], blocked_count=counts["blocked"],
        not_run_count=counts["not-run"], not_verified_count=counts["not-verified"],
        execution_coverage=execution_coverage, pass_rate=pass_rate,
        executive_summary_text=config.get("executive_summary_text", ""),
        human_action_items=human_action_items,
        coverage_rows=full_build_coverage(rows),
        module_options=sorted({r["module"] for r in rows}),
        rows=rows,
        investigation_items=investigation_items,
        blocked_notrun_items=blocked_notrun_items,
        gaps=gaps, gap_ids=gap_ids,
        followups=followups,
        preflight_checks=preflight_checks,
        runtime_and_command=runtime_and_command,
        raw_execution_logs=raw_execution_logs,
        generated_by=config.get("generated_by", "Test Executor"),
    ), output_path)
    print(f"wrote {output_path} (full, {len(rows)} test cases, "
          f"{len(human_action_items)} action items, {len(gaps)} open gaps)")


# --------------------------------------------------------------------- cli --

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="report_config.json", help="path to report_config.json")
    ap.add_argument("--report-type", choices=["lite", "full"], help="override config's report_type")
    ap.add_argument("--output", help="override the output HTML path")
    args = ap.parse_args()

    config_path = Path(args.config)
    config = load_json(config_path)
    resolve = make_resolver(config_path.parent)

    report_type = args.report_type or config.get("report_type", "lite")
    default_output = "test_execution_report.html" if report_type == "lite" else f"test_execution_report_{report_type}.html"
    output_path = Path(args.output or config.get("output_path", default_output))

    if report_type == "lite":
        generate_lite(config, resolve, output_path)
    elif report_type == "full":
        generate_full(config, resolve, output_path)
    else:
        sys.exit(f"unknown report_type: {report_type!r} (expected 'lite' or 'full')")


if __name__ == "__main__":
    main()
