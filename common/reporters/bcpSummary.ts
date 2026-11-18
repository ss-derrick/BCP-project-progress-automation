import fs from 'node:fs';
import path from 'node:path';

// BCP summary page: ONE page at the BCP folder with every environment's
// latest results (pass / fail per system, failed tests, last run time) and
// links to each environment's full Test Execution Report.
//
// Rebuilt automatically at the end of every run (see executionReport.ts),
// from the data each report saves:
//   reports/<ENV>/execution-report/report_config.json
//   reports/<ENV>/execution-report/data/last_execution_results.json
//   reports/<ENV>/execution-report/data/test_case_library.json
// Output: <BCP folder>/BCP_Test_Summary.html

export const SUMMARY_FILE = 'BCP_Test_Summary.html';

interface ResultRow {
  id: string;
  status: string;              // pass | fail | blocked-env | skipped | not-run
  last_executed?: string;
  notes?: string;
}

interface LibraryRow {
  id: string;
  title?: string;
  module?: string;
  priority?: string;
}

interface SystemSummary {
  folder: string;
  name: string;
  label: string;
  reportLink: string | null;
  lastRun: string | null;
  counts: Record<string, number>;
  total: number;
  failed: { id: string; title: string; status: string; note: string }[];
  actions: number;
  gaps: number;
}

const STATUS_ORDER = ['pass', 'fail', 'blocked-env', 'skipped', 'not-run'];
const STATUS_LABEL: Record<string, string> = {
  pass: 'Passed', fail: 'Failed', 'blocked-env': 'Blocked (environment)',
  skipped: 'Skipped', 'not-run': 'Not run'
};

const readJson = <T>(file: string): T | null => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; }
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Count entries in a report-notes file; the reporter's "None" placeholder
// (written under test-results/report-notes-none) counts as 0
function noteCount(file: string | undefined): number {
  if (!file || /report-notes-none/.test(file)) return 0;
  const data = readJson<unknown[]>(file);
  return Array.isArray(data) ? data.length : 0;
}

function formatTime(iso: string | null, timeZone: string): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    timeZone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function readSystem(bcpRoot: string, folder: string): SystemSummary {
  const reportDir = path.join(bcpRoot, 'reports', folder, 'execution-report');
  const config = readJson<Record<string, string>>(path.join(reportDir, 'report_config.json')) ?? {};
  const results = readJson<ResultRow[]>(path.join(reportDir, 'data', 'last_execution_results.json')) ?? [];
  const library = readJson<LibraryRow[]>(path.join(reportDir, 'data', 'test_case_library.json')) ?? [];
  const titles = new Map(library.map((t) => [t.id, t.title ?? '']));

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const lastRun = results
    .map((r) => r.last_executed)
    .filter((t): t is string => !!t)
    .sort()
    .pop() ?? null;

  const html = path.join(reportDir, 'test_execution_report.html');
  return {
    folder,
    name: config.project_name ?? folder,
    label: config.system_label ?? '',
    reportLink: fs.existsSync(html) ? `reports/${folder}/execution-report/test_execution_report.html` : null,
    lastRun,
    counts,
    total: results.length,
    failed: results
      .filter((r) => r.status !== 'pass')
      .map((r) => ({
        id: r.id,
        title: titles.get(r.id) ?? '',
        status: r.status,
        note: (r.notes ?? '').replace(/^Error:\s*/, '').split('\n')[0].slice(0, 300)
      })),
    actions: noteCount(config.human_action_path),
    gaps: noteCount(config.gaps_path)
  };
}

// Systems = environments with a report: reports/<ENV>/execution-report
function findSystems(bcpRoot: string): string[] {
  const reports = path.join(bcpRoot, 'reports');
  if (!fs.existsSync(reports)) return [];
  return fs.readdirSync(reports, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(reports, d.name, 'execution-report', 'report_config.json')))
    .map((d) => d.name)
    .sort();
}

function render(systems: SystemSummary[], timeZone: string, tzShort: string): string {
  const total = systems.reduce((n, s) => n + s.total, 0);
  const passed = systems.reduce((n, s) => n + (s.counts.pass ?? 0), 0);
  const notPassed = total - passed;
  const generated = formatTime(new Date().toISOString(), timeZone);

  const card = (s: SystemSummary): string => {
    const pass = s.counts.pass ?? 0;
    const pct = s.total ? Math.round((pass / s.total) * 100) : 0;
    const state = s.total === 0 ? 'none' : pass === s.total ? 'ok' : 'bad';
    const chips = STATUS_ORDER
      .filter((st) => s.counts[st])
      .map((st) => `<span class="chip ${st}">${STATUS_LABEL[st]}: <b>${s.counts[st]}</b></span>`)
      .join(' ');
    const failedRows = s.failed.length
      ? `<table class="failed"><thead><tr><th>Test case</th><th>Title</th><th>Result</th><th>Reason</th></tr></thead><tbody>${
        s.failed.map((f) => `<tr><td class="mono">${esc(f.id)}</td><td>${esc(f.title)}</td>` +
          `<td><span class="chip ${f.status}">${esc(STATUS_LABEL[f.status] ?? f.status)}</span></td>` +
          `<td>${esc(f.note)}</td></tr>`).join('')
      }</tbody></table>`
      : (s.total ? '<p class="allpass">All test cases passed.</p>' : '<p class="muted">No results yet: run this environment first.</p>');

    return `
    <section class="card ${state}">
      <div class="card-head">
        <div>
          <h2>${esc(s.name)}</h2>
          <div class="muted">${esc(s.label)} · folder <span class="mono">${esc(s.folder)}/</span></div>
        </div>
        ${s.reportLink ? `<a class="button" href="${esc(s.reportLink)}">Open full report &#8599;</a>` : ''}
      </div>
      <div class="stats">
        <div class="stat"><span class="num">${s.total}</span><span>Test cases</span></div>
        <div class="stat pass"><span class="num">${pass}</span><span>Passed</span></div>
        <div class="stat fail"><span class="num">${s.total - pass}</span><span>Not passed</span></div>
        <div class="stat"><span class="num">${pct}%</span><span>Pass rate</span></div>
      </div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="meta">
        <span>Last run: <b>${esc(formatTime(s.lastRun, timeZone))}</b> ${esc(tzShort)}</span>
        <span>Human action items: <b>${s.actions}</b></span>
        <span>Open gaps: <b>${s.gaps}</b></span>
        <span>${chips}</span>
      </div>
      ${failedRows}
    </section>`;
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BCP Test Summary</title>
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
  <h1>BCP Test Automation: Summary</h1>
  <p>Latest results of every BCP system · updated ${esc(generated)} ${esc(tzShort)}</p>
</div></header>
<main>
  <div class="overall">
    <div>Systems<b>${systems.length}</b></div>
    <div>Test cases<b>${total}</b></div>
    <div style="color:var(--pass)">Passed<b>${passed}</b></div>
    <div style="color:var(--fail)">Not passed<b>${notPassed}</b></div>
  </div>
  ${systems.map(card).join('\n')}
  <footer>Each system's numbers come from its own last run, so they may be from different times (see "Last run").
  Full details, screenshots, gaps and human action items are in each system's report.</footer>
</main>
</body>
</html>
`;
}

// Build <bcpRoot>/BCP_Test_Summary.html. Returns its path, or null when
// bcpRoot is not the BCP folder (no common/ in it).
export function writeBcpSummary(
  bcpRoot: string,
  { timeZone = 'Asia/Kuala_Lumpur', tzShort = 'KL' } = {}
): string | null {
  if (!fs.existsSync(path.join(bcpRoot, 'common'))) return null;
  const systems = findSystems(bcpRoot).map((folder) => readSystem(bcpRoot, folder));
  if (!systems.length) return null;
  const out = path.join(bcpRoot, SUMMARY_FILE);
  fs.writeFileSync(out, render(systems, timeZone, tzShort), 'utf8');
  return out;
}
