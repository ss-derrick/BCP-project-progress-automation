// Build ONE shareable zip of the latest reports: test_summary.html + each execution-report-<env>/
// (its test_execution_report.html and evidence/ screenshots). The summary's "Open full report" buttons
// are relative links to those folders, so they only work when the folders travel with it.
//   npm run report:package                 -> <Downloads>/Test_Reports_<date>.zip
//   REPORT_PACKAGE_DIR=C:\some\folder npm run report:package
// The zip is written OUTSIDE the project (never committed). Run automatically at the end of run-all.js.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });   // YYYY-MM-DD
const name = `Test_Reports_${date}`;
const outDir = process.env.REPORT_PACKAGE_DIR || path.join(os.homedir(), 'Downloads');
const zip = path.join(outDir, `${name}.zip`);
const stage = path.join(os.tmpdir(), name);

const summary = path.join(root, process.env.SUMMARY_FILE || 'test_summary.html');
if (!fs.existsSync(summary)) {
  console.warn(`[package] no ${summary}: run the tests (or npm run report:summary) first`);
  process.exit(0);
}
const html = fs.readFileSync(summary, 'utf8');
// the report folders the summary links to
const folders = [...new Set([...html.matchAll(/href="(execution-report-[^/"]+)\//g)].map((m) => m[1]))];

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
// SHORT paths inside the package: Windows refuses to extract a file whose full path is over 260 characters, and
// files opened from Teams already sit in "...\OneDrive - <company>\Microsoft Teams Chat Files\<zip name>\".
// Screenshots are copied as evidence/<TC-ID>/<NN>.<ext> (captions stay in the report) and every reference
// to the old name in the report / summary is rewritten.
let summaryHtml = html;
for (const f of folders) {
  const src = path.join(root, f);
  if (!fs.existsSync(path.join(src, 'test_execution_report.html'))) continue;
  fs.mkdirSync(path.join(stage, f), { recursive: true });
  let report = fs.readFileSync(path.join(src, 'test_execution_report.html'), 'utf8');
  const evidence = path.join(src, 'evidence');
  if (fs.existsSync(evidence)) {
    for (const tc of fs.readdirSync(evidence, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      fs.mkdirSync(path.join(stage, f, 'evidence', tc.name), { recursive: true });
      for (const file of fs.readdirSync(path.join(evidence, tc.name))) {
        const short = file.replace(/^(\d+)-.*(\.\w+)$/, '$1$2');            // "04-screen-....jpg" -> "04.jpg"
        fs.copyFileSync(path.join(evidence, tc.name, file), path.join(stage, f, 'evidence', tc.name, short));
        if (short === file) continue;
        const from = `evidence/${tc.name}/${file}`;
        const to = `evidence/${tc.name}/${short}`;
        report = report.split(from).join(to);
        summaryHtml = summaryHtml.split(`${f}/${from}`).join(`${f}/${to}`);
      }
    }
  }
  fs.writeFileSync(path.join(stage, f, 'test_execution_report.html'), report);
}
fs.writeFileSync(path.join(stage, 'test_summary.html'), summaryHtml);
fs.writeFileSync(path.join(stage, 'READ ME FIRST.txt'),
  'Unzip the whole zip first (right-click > Extract All), then open test_summary.html INSIDE this folder.\r\n' +
  'Click "Open full report" on a system to open its full report; screenshots load from the evidence folders next to it.\r\n' +
  'Do not move the HTML files out of this folder, or the links and screenshots stop working.\r\n');

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(zip, { force: true });
// The FOLDER itself (not only its contents): however it is unzipped, summary and report folders stay together.
// Windows' own tar (bsdtar) writes standard zip paths with "/" (PowerShell 5.1 Compress-Archive writes "\",
// which some unzip tools turn into flat file names, so a report folder can go missing after extracting).
const winTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const run = fs.existsSync(winTar)
  ? spawnSync(winTar, ['-a', '-c', '-f', zip, '-C', path.dirname(stage), path.basename(stage)], { stdio: 'inherit' })
  : spawnSync('powershell', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${stage.replace(/'/g, "''")}' -DestinationPath '${zip.replace(/'/g, "''")}' -CompressionLevel Optimal`],
  { stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });
if (run.status !== 0) { console.warn('[package] zip not created'); process.exit(0); }
console.log(`\nShareable report package (summary + ${folders.length} full report(s) + screenshots): ${zip} ` +
  `(${Math.round(fs.statSync(zip).size / 1048576)} MB). Send this zip, not test_summary.html alone.`);
