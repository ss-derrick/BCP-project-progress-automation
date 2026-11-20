
import fs from 'node:fs';
import path from 'node:path';
import { buildNotes, type Declared, type Gap, type HumanAction, type LibraryEntry, type RunResult } from './reportNotes';
import { spawnSync } from 'node:child_process';
import type {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
  TestResult
} from '@playwright/test/reporter';

// Custom reporter: after every run, writes the data files used by the
// "Test Execution Report" template package and renders the HTML report.
//
// Output (inside `outputDir`):
//   data/test_case_library.json       every test in this run
//   data/last_execution_results.json  status / time / duration / notes
//   evidence/<TC-ID>.png              last screenshot of each test
//   report_config.json                config for generate_report.py
//   test_execution_report.html        the finished report

export interface ExecutionReportOptions {
  outputDir?: string;
  projectName?: string;
  systemLabel?: string;
  runContext?: string;
  scopeLabel?: string;
  timezone?: string;
  timezoneShort?: string;
  notesDir?: string;        // hand-written optional cards (see report-notes/)
  generatorPath?: string;   // path to generate_report.py
  python?: string;          // python executable
}

type LiteStatus = 'pass' | 'fail' | 'blocked-env' | 'skipped' | 'not-run';

// One screenshot in a test's gallery
interface GalleryEntry {
  file: string;      // path relative to the report, e.g. evidence/TC-1/01-x.png
  caption: string;   // e.g. "Home page loaded"
}

// Attachment name prefix used by BasePage.captureScreen()
const SCREEN_PREFIX = 'screen: ';

const DEFAULT_GENERATOR = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? '',
  'skills',
  '02 automation test execution report template package - legacy',
  'generate_report.py'
);

// Remove terminal colour codes from error messages
const stripAnsi = (text: string): string =>
  text.replace(/\u001b\[[0-9;]*m/g, '');

// Order rows by Test Case ID (TC-APH-002 before TC-APH-010),
// regardless of which file each test lives in
function sortById<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    String((a as { id: string }).id).localeCompare(
      String((b as { id: string }).id),
      undefined,
      { numeric: true }
    )
  );
}

// ISO timestamp with the machine's local offset, e.g. 2026-11-05T10:30:36+08:00
function toLocalIso(date: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

export default class ExecutionReportReporter implements Reporter {
  private readonly options: ExecutionReportOptions;
  private rootDir = process.cwd();
  private tests: TestCase[] = [];
  private results = new Map<TestCase, TestResult>();
  private gallery: Record<string, GalleryEntry[]> = {};

  constructor(options: ExecutionReportOptions = {}) {
    this.options = options;
  }

  // Let the normal list reporter keep printing to the terminal
  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.rootDir = config.configFile
      ? path.dirname(config.configFile)
      : process.cwd();

    this.tests = suite.allTests();
  }

  // With retries this is called once per attempt; keep the last one
  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.set(test, result);
  }

  async onEnd(): Promise<void> {
    // Report folder: set in playwright.config.ts (REPORT_DIR overrides it)
    const outputDir = path.resolve(
      this.rootDir,
      this.options.outputDir ?? 'execution-report'
    );
    const dataDir = path.join(outputDir, 'data');

    if (this.results.size > 0) {
      this.writeRunData(dataDir, path.join(outputDir, 'evidence'));
    } else if (fs.existsSync(path.join(dataDir, 'last_execution_results.json'))) {
      // Nothing executed (`npm run report:rebuild` / `--list`):
      // re-render the report from the last run's results
      console.log('[execution-report] No tests executed - rebuilding report from the last run');
      this.refreshLibrary(dataDir);
    } else {
      return;
    }

    const configPath = path.join(outputDir, 'report_config.json');
    this.writeJson(configPath, {
      report_type: 'lite',
      project_name: this.options.projectName ?? 'Playwright Automation',
      system_label: this.options.systemLabel ?? 'System under test',
      run_context: this.options.runContext ?? 'after the last Playwright run',
      ...(this.options.scopeLabel && { scope_label: this.options.scopeLabel }),
      timezone: this.options.timezone ?? 'UTC',
      timezone_short: this.options.timezoneShort ?? '',
      library_path: 'data/test_case_library.json',
      results_path: 'data/last_execution_results.json',
      ...this.optionalCards(dataDir)
    });

    this.renderHtml(configPath, path.join(outputDir, 'test_execution_report.html'));
  }

  // Rebuild only: take title / module / priority from the current code
  // so renamed tests show their new names without re-running them
  private refreshLibrary(dataDir: string): void {
    const libraryPath = path.join(dataDir, 'test_case_library.json');
    if (!fs.existsSync(libraryPath)) return;

    const library: { id: string }[] = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
    const current = new Map<string, object>();

    for (const test of this.tests) {
      const annotation = (type: string) =>
        test.annotations.find((a) => a.type === type)?.description;
      const id = annotation('id') ?? this.fallbackId(test);
      current.set(id, {
        id,
        module: annotation('module') ?? (test.parent.title || 'General'),
        title: test.title,
        priority: annotation('priority') ?? ''
      });
    }

    this.writeJson(libraryPath, sortById(library.map((entry) => current.get(entry.id) ?? entry)));
  }

  // Write this run's test case library, results and screenshots
  private writeRunData(dataDir: string, evidenceDir: string): void {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(evidenceDir, { recursive: true });

    const library: object[] = [];
    const executions: object[] = [];
    const seenIds = new Set<string>();

    for (const test of this.tests) {
      const result = this.results.get(test);
      const annotations = [
        ...test.annotations,
        ...(result?.annotations ?? [])
      ];
      const annotation = (type: string) =>
        annotations.find((a) => a.type === type)?.description;

      const id = annotation('id') ?? this.fallbackId(test);

      if (seenIds.has(id)) {
        console.warn(`[execution-report] duplicate test case id: ${id}`);
      }
      seenIds.add(id);

      library.push({
        id,
        module: annotation('module') ?? (test.parent.title || 'General'),
        title: test.title,
        priority: annotation('priority') ?? ''
      });

      if (!result) continue;   // not executed -> report shows "Not run"

      const { status, notes } = this.toStatus(test, result, annotation);

      executions.push({
        id,
        status,
        last_executed: toLocalIso(result.startTime),
        duration_seconds: Math.round(result.duration / 10) / 100,
        evidence: this.copyEvidence(result, id, evidenceDir, status === 'pass'),
        notes
      });
    }

    this.writeJson(path.join(dataDir, 'test_case_library.json'), sortById(library));
    this.writeJson(path.join(dataDir, 'last_execution_results.json'), sortById(executions));

    // Screenshot order + captions per test, used by the report viewer
    this.writeJson(path.join(evidenceDir, 'manifest.json'), this.gallery);
  }

  // Map a Playwright result to the report's status vocabulary
  private toStatus(
    test: TestCase,
    result: TestResult,
    annotation: (type: string) => string | undefined
  ): { status: LiteStatus; notes: string } {
    const blockedReason = annotation('blocked-env');
    if (blockedReason) {
      return { status: 'blocked-env', notes: blockedReason };
    }

    const errorLine = stripAnsi(result.error?.message ?? '')
      .split('\n')
      .find((line) => line.trim() !== '')
      ?.trim() ?? '';

    switch (test.outcome()) {
      case 'expected':
        return { status: 'pass', notes: '' };
      case 'flaky':
        return { status: 'pass', notes: `Passed on retry ${result.retry}` };
      case 'skipped':
        return { status: 'skipped', notes: annotation('skip') ?? '' };
      default:
        if (result.status === 'interrupted') {
          return { status: 'not-run', notes: 'Run was interrupted' };
        }
        return {
          status: 'fail',
          notes: result.status === 'timedOut' ? `Test timed out. ${errorLine}`.trim() : errorLine
        };
    }
  }

  // Save the test's screenshots next to the report, in order:
  //   evidence/<TC-ID>/01-initiate-form-filled.png, 02-..., ...
  // Screens come from captureScreen() in the page objects. Playwright's
  // own end-of-test screenshot is added as "Final screen" when the test
  // did not pass (shows where it stopped) or took no screens at all.
  private copyEvidence(
    result: TestResult,
    id: string,
    evidenceDir: string,
    passed: boolean
  ): string | null {
    const images = result.attachments.filter(
      (a) =>
        a.contentType === 'image/png' &&
        (a.body || (a.path && fs.existsSync(a.path)))
    );
    const screens = images.filter((a) => a.name.startsWith(SCREEN_PREFIX));
    const final = images.filter((a) => !a.name.startsWith(SCREEN_PREFIX)).slice(-1);
    const chosen = [...screens, ...(!passed || screens.length === 0 ? final : [])];

    if (chosen.length === 0) return null;

    const folder = id.replace(/[^\w.-]/g, '_');
    fs.mkdirSync(path.join(evidenceDir, folder), { recursive: true });

    const entries = chosen.map((attachment, index) => {
      const caption = attachment.name.startsWith(SCREEN_PREFIX)
        ? attachment.name.slice(SCREEN_PREFIX.length)
        : 'Final screen';
      const slug = caption.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const fileName = `${String(index + 1).padStart(2, '0')}-${slug}.png`;
      const target = path.join(evidenceDir, folder, fileName);

      if (attachment.body) {
        fs.writeFileSync(target, attachment.body);
      } else {
        fs.copyFileSync(attachment.path as string, target);
      }

      return { file: `evidence/${folder}/${fileName}`, caption };
    });

    this.gallery[folder] = entries;
    return entries[0].file;
  }

  // Report cards. Human Action Required + Open Gaps / Limitations are built
  // AUTOMATICALLY on every run (common/reporters/reportNotes.ts) from:
  //   - this run's results (skips, environment problems, failures)
  //   - what tests declare they don't cover (testCase({ gaps, manual }))
  //   - hand-written report-notes/human_action_items.json / gaps.json (kept)
  // Nothing at all -> one "none" row, so the card is always there
  // (the summary page counts "none" rows as 0).
  // investigation_items.json -> "Investigation ..." card, only when the file exists.
  private optionalCards(dataDir: string): Record<string, string> {
    const notesDir = path.resolve(
      this.rootDir,
      this.options.notesDir ?? 'report-notes'
    );
    const readList = <T>(file: string): T[] => {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Array.isArray(data) ? data as T[] : [];
      } catch {
        return [];
      }
    };

    const declared: Declared[] = this.tests.map((test) => {
      const all = test.annotations;
      const parse = <T>(type: string): T[] => all.filter((a) => a.type === type)
        .map((a) => { try { return JSON.parse(a.description ?? '') as T; } catch { return null; } })
        .filter((x): x is T => x !== null);
      return {
        id: all.find((a) => a.type === 'id')?.description ?? this.fallbackId(test),
        gaps: parse('gap'),
        manual: parse('human-action')
      };
    });

    const { humanActions, gaps } = buildNotes(
      readList<LibraryEntry>(path.join(dataDir, 'test_case_library.json')),
      readList<RunResult>(path.join(dataDir, 'last_execution_results.json')),
      declared,
      readList<HumanAction>(path.join(notesDir, 'human_action_items.json')),
      readList<Gap>(path.join(notesDir, 'gaps.json'))
    );

    const humanPath = path.join(dataDir, 'human_action_items.json');
    const gapsPath = path.join(dataDir, 'gaps.json');
    this.writeJson(humanPath, humanActions.length ? humanActions : [{
      id: '-', module: '-', title: 'No human action required',
      reason: 'Every test case in this run is automated and ran.', recommended_handling: '-'
    }]);
    this.writeJson(gapsPath, gaps.length ? gaps : [{
      id: '-', status: 'None', description: 'No open gaps or limitations recorded.', impact: '-'
    }]);
    console.log(`[execution-report] Human action items: ${humanActions.length}, gaps / limitations: ${gaps.length}`);

    const cards: Record<string, string> = { human_action_path: humanPath, gaps_path: gapsPath };
    const investigation = path.join(notesDir, 'investigation_items.json');
    if (readList(investigation).length) cards.investigation_path = investigation;
    return cards;
  }

  // Used only when a test has no testCase({ id }) metadata
  private fallbackId(test: TestCase): string {
    const file = path.basename(test.location.file).replace(/\.spec\.ts$/, '');
    return `AUTO-${file}-L${test.location.line}`;
  }

  private writeJson(filePath: string, data: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  // Turn each "screenshot" link into a gallery link, e.g. "screenshots (6)",
  // and add the viewer + small style tweaks to the page.
  // embed = true: images are put inside the HTML (single shareable file).
  private decorateHtml(
    rawHtml: string,
    outputDir: string,
    embed: boolean
  ): string {
    const manifestPath = path.join(outputDir, 'evidence', 'manifest.json');
    const manifest: Record<string, GalleryEntry[]> = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : {};

    const galleries: Record<string, { src: string; caption: string }[]> = {};

    const html = rawHtml.replace(
      /<a href="(evidence\/[^"]+)" target="_blank">screenshot<\/a>/g,
      (match, href: string) => {
        const key = href.split('/')[1];
        const entries = manifest[key] ?? [{ file: href, caption: 'Screenshot' }];

        const images = entries
          .map((entry) => ({
            src: embed ? this.toDataUri(path.join(outputDir, entry.file)) : entry.file,
            caption: entry.caption
          }))
          .filter((image) => image.src);

        if (images.length === 0) return match;

        galleries[key] = images;
        const label = images.length === 1
          ? 'screenshot'
          : `screenshots (${images.length})`;

        return `<a href="${embed ? '#' : href}" data-gallery="${key}">${label}</a>`;
      }
    );

    // Keep "</script>" inside the data from closing the script tag
    const galleriesJson = JSON.stringify(galleries).replace(/</g, '\u003c');

    // Test Case ID -> its row in the Excel test case sheet (if mapped)
    const linkedHtml = this.linkToSheet(html);

    const viewer = `
<style>
  /* Coverage by module: center the number columns and their headers */
  th.num,
  table:has(th.num) td.num { text-align: center; }
  a[data-gallery] { white-space: nowrap; }
  td { vertical-align: baseline; }

  /* Screenshot gallery */
  #screenshot-viewer {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column; gap: 10px;
    padding: 16px 24px; box-sizing: border-box;
    background: #141414;
  }
  #screenshot-viewer[hidden] { display: none; }
  #screenshot-viewer .sv-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    color: #fff; font-size: 15px;
  }
  #screenshot-viewer .sv-caption { flex: 1; min-width: 200px; font-weight: 600; }
  #screenshot-viewer button {
    font: inherit; font-size: 14px; padding: 6px 14px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 6px;
    background: rgba(255, 255, 255, 0.12); color: #fff;
  }
  #screenshot-viewer button:disabled { opacity: 0.35; cursor: default; }
  #screenshot-viewer .sv-body { flex: 1; overflow: auto; text-align: center; }
  #screenshot-viewer .sv-body img {
    max-width: 100%; background: #fff; border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  #screenshot-viewer .sv-hint { margin: 0; color: #ddd; font-size: 13px; text-align: center; }
</style>
<div id="screenshot-viewer" hidden>
  <div class="sv-bar">
    <button type="button" data-sv="prev">&#8249; Previous</button>
    <span class="sv-caption"></span>
    <button type="button" data-sv="next">Next &#8250;</button>
    <button type="button" data-sv="close">&#10005; Close</button>
  </div>
  <div class="sv-body"><img alt="Test screenshot"></div>
  <p class="sv-hint">Use &larr; &rarr; to move between screens &middot; Esc to close</p>
</div>
<script>
(function () {
  var galleries = ${galleriesJson};
  var viewer = document.getElementById('screenshot-viewer');
  var body = viewer.querySelector('.sv-body');
  var image = viewer.querySelector('img');
  var caption = viewer.querySelector('.sv-caption');
  var prev = viewer.querySelector('[data-sv="prev"]');
  var next = viewer.querySelector('[data-sv="next"]');
  var current = null;
  var index = 0;

  function show() {
    var images = galleries[current];
    image.src = images[index].src;
    caption.textContent = (index + 1) + ' of ' + images.length + ' \u00b7 ' + images[index].caption;
    prev.hidden = next.hidden = images.length < 2;
    prev.disabled = index === 0;
    next.disabled = index === images.length - 1;
    body.scrollTop = 0;
  }

  function move(step) {
    var images = galleries[current];
    index = Math.min(images.length - 1, Math.max(0, index + step));
    show();
  }

  function close() {
    viewer.hidden = true;
    image.removeAttribute('src');
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-gallery]');
    if (link) {
      event.preventDefault();
      current = link.getAttribute('data-gallery');
      index = 0;
      viewer.hidden = false;
      show();
      return;
    }
    if (viewer.hidden) return;

    var action = event.target.closest('[data-sv]');
    if (action) {
      var name = action.getAttribute('data-sv');
      if (name === 'prev') move(-1);
      if (name === 'next') move(1);
      if (name === 'close') close();
    } else if (event.target === viewer || event.target === body) {
      close();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (viewer.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  });
})();
</script>`;

    return linkedHtml.replace('</body>', `${viewer}\n</body>`);
  }

  // "Test Case ID (<sheet>)" column next to the Automation ID in "All test cases":
  // the Excel test case ID(s) of the same scenario, each linked to its row in
  // the workbook (opens Excel Online at that row). Search also finds them.
  // Taken from ecom-automation (reporters/executionReport.ts), made generic:
  // any test ID, column title / workbook name from the mapping file.
  // Mapping: report-notes/<env>/sheet_links.json (or report-notes/sheet_links.json)
  //   { "workbookUrl": "...", "workbookName": "SSR-xxx_Test_Cases_v1.0.xlsx",
  //     "sheet": "Sheet name", "columnLabel": "Test Case ID (SSR-xxx v1.0)",
  //     "links": { "TC-COMP-001": [ { "sheetId": "TC-SP-COMP-001", "row": 5 } ] } }
  // No mapping file -> report unchanged. Test without a row in the sheet -> "-".
  private linkToSheet(html: string): string {
    const mappingPath = path.resolve(
      this.rootDir,
      this.options.notesDir ?? 'report-notes',
      'sheet_links.json'
    );
    if (!fs.existsSync(mappingPath)) return html;

    const mapping: {
      workbookUrl: string;
      workbookName?: string;
      sheet: string;
      columnLabel?: string;
      links: Record<string, { sheetId: string; row: number }[]>;
    } = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const workbook = mapping.workbookName ?? 'the test case workbook';
    const label = mapping.columnLabel ?? `Test Case ID (${mapping.sheet})`;
    const rowUrl = (row: number) =>
      `${mapping.workbookUrl}${mapping.workbookUrl.includes('?') ? '&' : '?'}activeCell=${encodeURIComponent(`'${mapping.sheet}'!A${row}`)}`;

    const sheetLinks = (id: string): string =>
      (mapping.links[id] ?? [])
        .map((link) =>
          `<a class="sheet-link" href="${esc(rowUrl(link.row))}" target="_blank" rel="noopener" ` +
          `title="Open ${esc(link.sheetId)} (row ${link.row}) in ${esc(workbook)}">` +
          `${esc(link.sheetId)} &#8599;</a>`)
        .join('<br>');
    const sheetIds = (id: string): string =>
      (mapping.links[id] ?? []).map((link) => link.sheetId).join(' ');

    const style = `
<style>
  a.sheet-link { white-space: nowrap; color: #1a5fb4; text-decoration: none; }
  a.sheet-link:hover { text-decoration: underline; }
  td.no-sheet-id { color: #999; }
</style>`;

    // Only the "All test cases" table (#tcTable)
    const start = html.indexOf('<table id="tcTable">');
    if (start === -1) return html.replace('</head>', `${style}
</head>`);
    const end = html.indexOf('</table>', start);
    const table = html.slice(start, end)
      // column 1 = Automation ID (script), column 2 = test case ID in the Excel sheet
      .replace('<th>Test Case ID</th>',
        `<th>Automation ID</th><th title="${esc(workbook)}, sheet '${esc(mapping.sheet)}'">${esc(label)}</th>`)
      // search box: also match the Excel IDs
      .replace(/data-search="([^\s"]+)/g, (match, id: string) => {
        const ids = sheetIds(id);
        return ids ? `data-search="${esc(ids)} ${id}` : match;
      })
      // first cell of each row: <td class="mono">TC-COMP-001</td> + sheet cell
      .replace(/(<tr[^>]*data-search="[^"]*"[^>]*>\s*)<td class="mono">([^<]+)<\/td>/g, (match, head: string, id: string) => {
        const links = sheetLinks(id);
        return `${head}<td class="mono">${id}</td>` + (links
          ? `<td class="mono">${links}</td>`
          : '<td class="mono no-sheet-id" title="Scenario not in the test case sheet">-</td>');
      });

    return (html.slice(0, start) + table + html.slice(end))
      .replace('</head>', `${style}
</head>`);
  }

  private toDataUri(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
  }

  // Run the template package's generate_report.py
  private renderHtml(configPath: string, htmlPath: string): void {
    const generator =
      this.options.generatorPath ?? process.env.REPORT_GENERATOR ?? DEFAULT_GENERATOR;

    if (!fs.existsSync(generator)) {
      console.warn(
        `[execution-report] generate_report.py not found at "${generator}". ` +
        'Data files were written; set REPORT_GENERATOR to render the HTML.'
      );
      return;
    }

    const run = spawnSync(
      this.options.python ?? process.env.PYTHON ?? 'python',
      [generator, '--config', configPath, '--output', htmlPath],
      { encoding: 'utf8' }
    );

    if (run.status === 0) {
      const outputDir = path.dirname(htmlPath);
      const rawHtml = fs.readFileSync(htmlPath, 'utf8');

      // Local report: screenshots load from the evidence/ folder
      fs.writeFileSync(htmlPath, this.decorateHtml(rawHtml, outputDir, false), 'utf8');
      console.log(`\nTest Execution Report: ${htmlPath}`);

      // Shareable copy: one HTML file with all screenshots inside,
      // named by date, e.g. Test_Execution_Report_2026-11-06.html
      const sharePath = path.join(
        outputDir,
        `Test_Execution_Report_${toLocalIso(new Date()).slice(0, 10)}.html`
      );
      fs.writeFileSync(sharePath, this.decorateHtml(rawHtml, outputDir, true), 'utf8');
      console.log(`Shareable single-file copy: ${sharePath}`);
    } else {
      console.warn(
        '[execution-report] Could not render HTML report:\n' +
        (run.error?.message ?? run.stderr ?? '')
      );
    }
  }
}
