// Run the suite on several portals one after the other, then ONE summary
// with all of them (test_summary.html).
//   npm run test:all                       -> UAT-APH, then UAT-FASSBAYAR
//   npm run test:all -- UAT-FASSBAYAR      -> only the portals named
//   npm run test:aph:smoke                 -> --smoke = only tests tagged @smoke (test categories)
// Each portal still gets its own execution-report-<env>/ folder.
// DEMO / other settings come from the terminal as usual ($env:DEMO='false').
const { spawnSync } = require('node:child_process');

// --smoke (or --regression later) = run one test category: --grep "@smoke"
const args = process.argv.slice(2);
const categories = args.filter((a) => a.startsWith('--')).map((a) => a.slice(2));
const named = args.filter((a) => !a.startsWith('--'));
const envs = named.length ? named : ['UAT-APH', 'UAT-FASSBAYAR'];
const grep = categories.length ? ['--grep', `"${categories.map((c) => `@${c}`).join('|')}"`] : [];
let exitCode = 0;

envs.forEach((env, i) => {
  const last = i === envs.length - 1;
  console.log(`\n===== ${env} =====`);
  const run = spawnSync('npx', ['playwright', 'test', ...grep], {
    stdio: 'inherit',
    shell: true,
    // the summary of the LAST run shows every portal of this command
    env: { ...process.env, ENV_NAME: env, SUMMARY_ENVS: last ? envs.join(',') : env }
  });
  if (run.status !== 0) exitCode = run.status ?? 1;
});

// one shareable zip: the summary only opens the full reports when their folders travel with it
spawnSync('node', [require('node:path').join(__dirname, 'package-reports.js')], { stdio: 'inherit' });

process.exit(exitCode);
