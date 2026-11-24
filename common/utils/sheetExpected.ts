import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV_NAME } from '../../portals.config';

// What the Excel sheet expects for an automated test (TC ID, row, title, steps, Expected Result), read from
// report-notes/<env>/sheet_expected.json. That file is made from the workbook by
// tools/workbook-results/export_expected.py, refreshed here when the workbook is newer. It stays local
// (git-ignored): the sheet text is internal and the repo is public.

export interface SheetCase { sheetId: string; row: number; title: string; steps: string; expected: string }

const root = path.resolve(__dirname, '..', '..');
const envDir = ENV_NAME.toLowerCase();
const cacheFile = path.join(root, 'report-notes', envDir, 'sheet_expected.json');
let cache: Record<string, SheetCase[]> | null = null;

function refresh(): void {
  // the workbook path of this environment, e.g. UAT_APH_WORKBOOK (a run may point it elsewhere: keep the cache then)
  const workbook = process.env[`${ENV_NAME.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_WORKBOOK`] ?? '';
  const mapping = path.join(root, 'report-notes', envDir, 'sheet_links.json');
  if (!workbook || !fs.existsSync(workbook) || !fs.existsSync(mapping)) return;
  const stale = !fs.existsSync(cacheFile) || fs.statSync(cacheFile).mtimeMs < Math.max(fs.statSync(workbook).mtimeMs, fs.statSync(mapping).mtimeMs);
  if (!stale) return;
  spawnSync(process.env.PYTHON ?? 'python', [path.join(root, 'tools', 'workbook-results', 'export_expected.py'),
    '--workbook', workbook, '--mapping', mapping, '--out', cacheFile], { encoding: 'utf8' });
}

export function sheetCases(automationId: string): SheetCase[] {
  if (!cache) {
    try { refresh(); } catch { /* keep the old cache */ }
    try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { cache = {}; }
  }
  return cache![automationId] ?? [];
}
