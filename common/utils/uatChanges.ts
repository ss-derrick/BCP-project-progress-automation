import { test } from '@playwright/test';
import type { BasePage } from '../pages/BasePage';

// Tests that CHANGE UAT data (create / edit / delete / suspend ...) only run when the team allows it:
//   .env:  ADM_ALLOW_UAT_CHANGES=true
// Otherwise they are skipped with the reason (report: Human Action; workbook: Blocked + reason).
export const UAT_CHANGES_ALLOWED = process.env.ADM_ALLOW_UAT_CHANGES === 'true';

// Preview (ADM_PREVIEW_CHANGES=true, only when changes are NOT allowed): the same tests run up to the point
// where they would save (Review & Confirm, or Suspend / Reinstate Submit), take a screenshot, go Back and
// stop as skipped "Preview: ... nothing saved". To see the screens without changing UAT data.
export const UAT_PREVIEW = !UAT_CHANGES_ALLOWED && process.env.ADM_PREVIEW_CHANGES === 'true';

export function requireUatChanges(what: string): void {
  test.skip(!UAT_CHANGES_ALLOWED && !UAT_PREVIEW,
    `Changes UAT data (${what}): not run by default; set ADM_ALLOW_UAT_CHANGES=true in .env to run it`);
}

// Call right before the click that saves. In preview: screenshot, then stop the test (nothing saved).
export async function stopBeforeSaving(page: BasePage, what: string): Promise<void> {
  if (!UAT_PREVIEW) return;
  await page.captureScreen(`Preview: ${what} (not saved)`);
  test.skip(true, `Preview: stopped before ${what}; nothing saved`);
}

// A disposable bank user for suspend / edit cases (never a real person's account): ADM_TEST_BANK_USER in .env
export const TEST_BANK_USER = process.env.ADM_TEST_BANK_USER ?? '';

// Team test mailbox (QA Lead, 23 Nov 2026) for the dummy bank users' activation / reset emails: ADM_TEST_EMAIL in .env
export const TEST_EMAIL = process.env.ADM_TEST_EMAIL ?? '';

// Cases the sheet marks HAR (device, payment, mailbox or time window): listed, never run.
// The workbook keeps their Status (Not Run); the report lists them under Human Action.
export function humanAction(why: string): void {
  test.skip(true, `Human action required: ${why}`);
}
