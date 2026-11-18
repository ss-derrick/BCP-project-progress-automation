// Run Playwright for one environment, the same on Windows and CI:
//   node scripts/pw.js UAT-APH [playwright args...]
//   node scripts/pw.js UAT-FASSBAYAR test --grep "@add-company|@login"
// (npm run test:aph / test:fassbayar use this)
// Starts the Playwright CLI directly (no shell), so arguments such as a
// --grep with "|" are passed exactly as typed.
const { spawnSync } = require('node:child_process');

const [envName, ...args] = process.argv.slice(2);
if (!envName) {
  console.error('Usage: node scripts/pw.js <ENV_NAME> [playwright args]');
  process.exit(2);
}

const cli = require.resolve('@playwright/test/cli');
const result = spawnSync(process.execPath, [cli, ...(args.length ? args : ['test'])], {
  stdio: 'inherit',
  env: { ...process.env, ENV_NAME: envName }
});
process.exit(result.status ?? 1);
