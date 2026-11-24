import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter } from '@playwright/test/reporter';

// Test Summary page: ONE page with the latest result of every system
// (here: every environment / portal), in the style of BCP_Test_Summary.html.
//
// It reads what the Test Execution Report reporter already wrote, so it has
// to run AFTER it (it is listed after it in playwright.config.ts):
//   execution-report-<env>/report_config.json            system label, notes paths
//   execution-report-<env>/data/test_case_library.json   titles
//   execution-report-<env>/data/last_execution_results.json  status per test case
//
// Output: test_summary.html in the project folder (SUMMARY_FILE overrides).
// Rebuild without running tests:  npm run report:summary
//
// In this merged project each environment's report also lists the other
// portal's scenarios as "skipped - Not verified on <env> yet". Those are NOT
// counted as test cases of that system; they are shown as a separate number.

export interface SummaryReportOptions {
  title?: string;           // page title, default "<project name>: Summary"
  outputFile?: string;      // default test_summary.html
  timezone?: string;        // default Asia/Kuala_Lumpur
  timezoneShort?: string;   // default KL
  // Report folders (execution-report-<env>) to show, e.g. only the portal(s)
  // of this run. Not set = every execution-report-* folder found.
  folders?: string[];
}

interface Result { id: string; status: string; last_executed?: string; notes?: string }
interface LibraryEntry { id: string; title: string; module?: string }

interface SystemSummary {
  folder: string;
  projectName?: string;
  name: string;
  label: string;
  runCategory?: string;     // "Smoke run", "Full run"... (executionReport.ts)
  fullReport?: string;
  total: number;
  passed: number;
  notPassed: Result[];
  otherPortal: number;
  otherPortalIds: string[];
  counts: Record<string, number>;
  lastRun?: Date;
  humanActions: number;
  openGaps: number;
  titles: Map<string, string>;
}

// Skips that mean "not this portal's scenario", not counted as test cases:
//   "Not verified on <env> yet"              (the other portal's own scenario)
//   "Applicable for <portal> only: <why>"    (shared scenario the portal doesn't offer, e.g. HSBC VISA on APH)
const OTHER_PORTAL = /^(Not verified on |Applicable for .+ only)/;

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const readJson = <T>(file: string, fallback: T): T => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
};

export default class SummaryReporter implements Reporter {
  private rootDir = process.cwd();

  constructor(private readonly options: SummaryReportOptions = {}) {}

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig): void {
    this.rootDir = config.configFile ? path.dirname(config.configFile) : process.cwd();
  }

  async onEnd(): Promise<void> {
    const folders = this.options.folders
      ?? fs.readdirSync(this.rootDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith('execution-report-'))
        .map((d) => d.name);
    const systems = folders
      .filter((f) => fs.existsSync(path.join(this.rootDir, f)))
      .map((f) => this.readSystem(f))
      .filter((s): s is SystemSummary => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (systems.length === 0) return;

    const file = path.resolve(this.rootDir, process.env.SUMMARY_FILE ?? this.options.outputFile ?? 'test_summary.html');
    fs.writeFileSync(file, this.render(systems), 'utf8');
    console.log(`Test Summary: ${file}`);
  }

  // ---------- read one system (one execution-report-<env> folder) ----------

  private readSystem(folder: string): SystemSummary | null {
    const dir = path.join(this.rootDir, folder);
    const results = readJson<Result[]>(path.join(dir, 'data', 'last_execution_results.json'), []);
    if (results.length === 0) return null;

    const config = readJson<Record<string, string>>(path.join(dir, 'report_config.json'), {});
    const library = readJson<LibraryEntry[]>(path.join(dir, 'data', 'test_case_library.json'), []);
    const fullReport = ['test_execution_report.html']
      .map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));

    const own = results.filter((r) => !(r.status === 'skipped' && OTHER_PORTAL.test(r.notes ?? '')));
    const counts: Record<string, number> = {};
    for (const r of own) counts[r.status] = (counts[r.status] ?? 0) + 1;

    const times = results.map((r) => r.last_executed).filter(Boolean).map((t) => new Date(t as string));
    const label = config.system_label ?? folder;

    // Human action items: every entry except "None" placeholders
    const actions = config.human_action_path
      ? readJson<{ title?: string }[]>(config.human_action_path, [])
        .filter((a) => !/^No human action/i.test(a.title ?? '')).length
      : 0;
    // Gaps: entries still open (no status = open)
    const gaps = config.gaps_path
      ? readJson<{ status?: string }[]>(config.gaps_path, [])
        .filter((g) => !/^closed$/i.test(g.status ?? 'Open') && !/^none$/i.test(g.status ?? '')).length
      : 0;

    return {
      folder,
      projectName: config.project_name,
      name: label.split(' (')[0],
      label,
      runCategory: config.run_category,
      fullReport: fullReport ? `${folder}/${path.basename(fullReport)}` : undefined,
      total: own.length,
      passed: counts.pass ?? 0,
      notPassed: own.filter((r) => r.status !== 'pass'),
      otherPortal: results.length - own.length,
      otherPortalIds: results.filter((r) => !own.includes(r)).map((r) => r.id),
      counts,
      lastRun: times.length ? new Date(Math.max(...times.map((t) => t.getTime()))) : undefined,
      humanActions: actions,
      openGaps: gaps,
      titles: new Map(library.map((e) => [e.id, e.title]))
    };
  }

  // ---------- HTML ----------

  private when(date?: Date): string {
    if (!date) return '-';
    const tz = this.options.timezone ?? 'Asia/Kuala_Lumpur';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(date);
    const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
    return `${p('day')} ${p('month')} ${p('year')}, ${p('hour')}:${p('minute')}`;
  }

  private chipLabel(status: string): string {
    return ({ pass: 'Passed', fail: 'Failed', 'blocked-env': 'Blocked (environment)',
      skipped: 'Skipped', 'not-run': 'Not run' } as Record<string, string>)[status] ?? status;
  }

  private card(s: SystemSummary): string {
    const rate = s.total ? Math.round((s.passed / s.total) * 100) : 0;
    const ok = s.notPassed.length === 0;
    const tzShort = this.options.timezoneShort ?? 'KL';

    const chips = Object.entries(s.counts)
      .sort(([a], [b]) => (a === 'pass' ? -1 : b === 'pass' ? 1 : a.localeCompare(b)))
      .map(([st, n]) => `<span class="chip ${esc(st)}">${esc(this.chipLabel(st))}: <b>${n}</b></span>`)
      .join(' ');

    const button = s.fullReport
      ? `<a class="button" href="${esc(s.fullReport)}" title="Opens ${esc(s.fullReport)}: works only when this summary is opened from the unzipped report package">Open full report &#8599;</a>`
      : `<span class="button off" title="generate_report.py was not found when this report was made, so only its data and screenshots exist">Full report not generated</span>`;

    const failedTable = ok
      ? `<p class="allpass">All test cases passed.</p>`
      : `<table class="failed"><thead><tr><th>Test case</th><th>Title</th><th>Result</th><th>Reason</th></tr></thead><tbody>${
        s.notPassed.map((r) => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(s.titles.get(r.id) ?? '')}</td>` +
          `<td><span class="chip ${esc(r.status)}">${esc(this.chipLabel(r.status))}</span></td><td>${esc(r.notes || '-')}</td></tr>`).join('')
      }</tbody></table>`;

    return `
    <section class="card ${ok ? 'ok' : 'bad'}">
      <div class="card-head">
        <div>
          <h2>${esc(s.name)}</h2>
          <div class="muted">${esc(s.label)} · folder <span class="mono">${esc(s.folder)}/</span></div>
        </div>
        ${button}
      </div>
      <div class="stats">
        <div class="stat"><span class="num">${s.total}</span><span>Test cases</span></div>
        <div class="stat pass"><span class="num">${s.passed}</span><span>Passed</span></div>
        <div class="stat fail"><span class="num">${s.notPassed.length}</span><span>Not passed</span></div>
        <div class="stat"><span class="num">${rate}%</span><span>Pass rate</span></div>
      </div>
      <div class="bar"><div style="width:${rate}%"></div></div>
      <div class="meta">
        ${s.runCategory ? `<span>Run: <b>${esc(s.runCategory)}</b></span>` : ''}
        <span>Last run: <b>${esc(this.when(s.lastRun))}</b> ${esc(tzShort)}</span>
        <span>Human action items: <b>${s.humanActions}</b></span>
        <span>Open gaps: <b>${s.openGaps}</b></span>
        ${s.otherPortal ? `<span>Not applicable to this portal (skipped, not counted): <b>${s.otherPortal}</b> (${esc(s.otherPortalIds.join(', '))})</span>` : ''}
        <span>${chips}</span>
      </div>
      ${failedTable}
    </section>`;
  }

  private render(systems: SystemSummary[]): string {
    const total = systems.reduce((n, s) => n + s.total, 0);
    const passed = systems.reduce((n, s) => n + s.passed, 0);
    // Title: option, else the project name the reports were made with
    const project = systems.find((s) => s.projectName)?.projectName;
    const title = this.options.title ?? (project ? `${project}: Summary` : 'Test Automation: Summary');
    const updated = this.when(new Date());
    const tzShort = this.options.timezoneShort ?? 'KL';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --bg:#f4f5f2; --card:#fff; --ink:#1f2a1a; --muted:#66705f; --line:#dde2d6;
          --brand:#7a9a1a; --pass:#2e7d32; --fail:#c62828; --warn:#b26a00; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 "Segoe UI", Arial, sans-serif; }
  header { background:#1c3144; color:#fff; padding:22px 16px; }
  header .wrap, main { max-width:1100px; margin:0 auto; }
  h1 { margin:0 0 4px; font-size:24px; font-weight:600; }
  header p { margin:0; color:#c9d4dd; }
  main { padding:20px 16px 40px; }
  .overall { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:20px; }
  .overall div { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px 14px; }
  .overall b { display:block; font-size:26px; }
  .card { background:var(--card); border:1px solid var(--line); border-left:6px solid var(--muted);
          border-radius:8px; padding:18px; margin-bottom:18px; }
  .card.ok { border-left-color:var(--pass); }  .card.bad { border-left-color:var(--fail); }
  .card-head { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start; }
  h2 { margin:0; font-size:20px; color:var(--brand); }
  .muted { color:var(--muted); font-size:13px; }
  .mono { font-family:Consolas, monospace; font-size:13px; }
  .button { background:var(--brand); color:#fff; text-decoration:none; padding:8px 14px; border-radius:6px; white-space:nowrap; }
  .button.off { background:#c9cfc0; color:#4d5547; cursor:help; }
  .share-note { background:#fff8e1; border:1px solid #f0d58a; border-radius:8px; padding:10px 14px; margin:0 0 16px; font-size:14px; line-height:1.5; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:16px 0 8px; }
  .stat { background:var(--bg); border-radius:6px; padding:10px; text-align:center; font-size:13px; color:var(--muted); }
  .stat .num { display:block; font-size:24px; font-weight:600; color:var(--ink); }
  .stat.pass .num { color:var(--pass); } .stat.fail .num { color:var(--fail); }
  .bar { height:8px; background:#f1d4d4; border-radius:4px; overflow:hidden; }
  .bar div { height:100%; background:var(--pass); }
  .meta { display:flex; flex-wrap:wrap; gap:8px 18px; margin:12px 0; font-size:13px; color:var(--muted); }
  .chip { display:inline-block; padding:1px 8px; border-radius:10px; font-size:12px; background:#eceee8; color:var(--ink); }
  .chip.pass { background:#e3f1e4; color:var(--pass); } .chip.fail { background:#fbe4e4; color:var(--fail); }
  .chip.blocked-env, .chip.skipped, .chip.not-run { background:#fdf0dc; color:var(--warn); }
  table.failed { width:100%; border-collapse:collapse; font-size:13px; margin-top:6px; }
  table.failed th { text-align:left; background:#f6f7f3; color:var(--muted); font-weight:600; }
  table.failed th, table.failed td { padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  table.failed td.mono { white-space:nowrap; }
  .allpass { color:var(--pass); margin:6px 0 0; }
  footer { color:var(--muted); font-size:12px; text-align:center; }
  @media (max-width:640px) { .stats { grid-template-columns:repeat(2,1fr); } table.failed td:nth-child(2) { display:none; } }
</style>
</head>
<body>
<header><div class="wrap">
  <h1>${esc(title)}</h1>
  <p>Latest results of every system · updated ${esc(updated)} ${esc(tzShort)}</p>
</div></header>
<main>
  <div class="overall">
    <div>Systems<b>${systems.length}</b></div>
    <div>Test cases<b>${total}</b></div>
    <div style="color:var(--pass)">Passed<b>${passed}</b></div>
    <div style="color:var(--fail)">Not passed<b>${total - passed}</b></div>
  </div>
  <div class="share-note"><b>Opening the full reports:</b> the "Open full report" buttons work only when this page is
  opened from the unzipped report package, next to its <code>execution-report-&lt;system&gt;</code> folders
  (they hold each full report and its screenshots). If you received only this one file, the buttons show
  "404 / not found": ask for the zip <i>Test_Reports_&lt;date&gt;.zip</i>, right-click it, <b>Extract All</b>,
  then open <code>test_summary.html</code> from the extracted folder.</div>
  ${systems.map((s) => this.card(s)).join('\n')}
  <footer>Each system's numbers come from its own last run, so they may be from different times (see "Last run").
  Full details, screenshots, gaps and human action items are in each system's report.</footer>
</main>
</body>
</html>
`;
  }
}
