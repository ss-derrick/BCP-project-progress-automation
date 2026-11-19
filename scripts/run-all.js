// Run the suite on several portals one after the other, then ONE summary
// with all of them (test_summary.html).
//   npm run test:all                       -> UAT-APH, then UAT-FASSBAYAR
//   npm run test:all -- UAT-FASSBAYAR      -> only the portals named
// Each portal still gets its own execution-report-<env>/ folder.
// DEMO / other settings come from the terminal as usual ($env:DEMO='false').
const { spawnSync } = require('node:child_process');

const envs = process.argv.slice(2).length ? process.argv.slice(2) : ['UAT-APH', 'UAT-FASSBAYAR'];
let exitCode = 0;

envs.forEach((env, i) => {
  const last = i === envs.length - 1;
  console.log(`\n===== ${env} =====`);
  const run = spawnSync('npx', ['playwright', 'test'], {
    stdio: 'inherit',
    shell: true,
    // the summary of the LAST run shows every portal of this command
    env: { ...process.env, ENV_NAME: env, SUMMARY_ENVS: last ? envs.join(',') : env }
  });
  if (run.status !== 0) exitCode = run.status ?? 1;
});

process.exit(exitCode);
