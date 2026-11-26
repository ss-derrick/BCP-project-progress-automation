import { test, type Locator } from '@playwright/test';
import * as fs from 'node:fs';
import { AdministratorPage } from './AdministratorPage';
import { stopBeforeSaving } from '../utils/uatChanges';

// Manage Readers (same screens on APH and Fassbayar): Reader Summary (/reader/list), Reader Details,
// Status History pop-up, Suspend / Reinstate Reader forms, Register New Readers (CSV upload, 2 steps:
// Upload shows a summary, Submit saves). Reuses the list / Quicklink / form helpers of AdministratorPage,
// so every screen and every Submit gets a step screenshot.

export interface UploadSummary {
  file: string;
  found: number;
  approved: number;
  rejected: number;
  duplicated: number;
  text: string;           // whole result area, for messages
  canSubmit: boolean;
}

export const READER_COLUMNS = ['Reader Serial No.', 'Status', 'Created Date', 'MID(Business Name)', 'Quicklink'];
export const READER_STATUSES = ['Select One', 'Active', 'Suspended', 'Permanently Suspended'];
export const SUSPEND_REASONS = ['Lost', 'Not functioning', 'Deactivate - Reassignment', 'Terminate', 'Others'];
export const HISTORY_COLUMNS = ['Date / Time', 'User ID (Role)', 'Status', 'Reason', 'Description'];
export const CSV_HEADER = 'Reader Serial No.;MID;ServiceProvider';

export class ReadersPage extends AdministratorPage {
  protected override get menuPath(): string { return '/reader'; }

  readonly fileInput = this.page.locator('#realupload');
  readonly uploadButton = this.page.locator('#upload, a').filter({ hasText: /^\s*Upload\s*$/ }).first();
  readonly submitButton = this.main.locator('a.button, a').filter({ hasText: /^\s*Submit\s*$/ }).first();

  // Reader Summary row of a serial (exact match on the first cell)
  row(serial: string): Locator {
    return this.rows.filter({ has: this.page.locator('td:first-child', { hasText: new RegExp(`^\\s*${serial}\\s*$`, 'i') }) });
  }

  // Reader Summary, searched by serial ("Search for a Reader" box)
  async findSerial(serial: string): Promise<Locator> {
    await this.openQuicklink('Reader Summary');
    await this.search(serial);
    await this.captureStep(`Reader Summary: search ${serial}`);
    return this.row(serial);
  }

  // Cells of a row as { column: text }, keyed by READER_COLUMNS names (headers compared without spaces:
  // the screen shows "MID (Business Name)" / "MID(Business Name)")
  async rowCells(row: Locator): Promise<Record<string, string>> {
    const squash = (s: string) => s.replace(/\s+/g, '');
    // serial search results show "Activation Date/ Suspended Date" instead of "Created Date"
    const alias: Record<string, string> = { 'ActivationDate/SuspendedDate': 'Activation Date' };
    const cols = (await this.columns()).map((c) => READER_COLUMNS.find((r) => squash(r) === squash(c)) ?? alias[squash(c)] ?? c);
    const cells = (await row.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  }

  // ---------- Register New Readers ----------

  // Writes the CSV (as the template: ';' separated, CRLF) and uploads it. Upload only shows a summary.
  async upload(name: string, content: string): Promise<UploadSummary> {
    const file = test.info().outputPath(name);
    fs.writeFileSync(file, content);
    await test.info().attach(`file: ${name}`, { body: content || '(empty file)', contentType: 'text/plain' });
    await this.openQuicklink('Register New Readers');
    await this.fileInput.setInputFiles(file);
    await this.captureStep(`Register New Readers: ${name} chosen, before Upload`);
    await this.uploadButton.click();
    await this.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    const text = (await this.main.innerText()).replace(/\s+/g, ' ');
    const num = (label: string) => Number(text.match(new RegExp(`${label}\\s*(\\d+)`))?.[1] ?? NaN);
    const summary: UploadSummary = {
      file: name, text,
      found: num('No\\. of Reader\\(s\\) Found'), approved: num('Approved Reader\\(s\\)'),
      rejected: num('Rejected Reader\\(s\\)'), duplicated: num('Duplicated Reader\\(s\\)'),
      canSubmit: await this.submitButton.isVisible().catch(() => false)
    };
    await this.captureStep(`After Upload ${name}: found ${summary.found}, approved ${summary.approved}, rejected ${summary.rejected}, duplicated ${summary.duplicated}`);
    return summary;
  }

  // Step 2 of the upload: Submit saves the readers. Returns the text of the result page.
  async submitUpload(what: string): Promise<string> {
    await stopBeforeSaving(this, `Register New Readers Submit (${what})`);
    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    const text = (await this.main.innerText()).replace(/\s+/g, ' ');
    await this.captureStep(`After Register Submit (${what})`);
    return text;
  }

  async downloadTemplate(): Promise<string> {
    await this.openQuicklink('Register New Readers');
    const [dl] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 30_000 }),
      this.main.locator('a[href*="getTemplate"], a').filter({ hasText: /download template/i }).first().click()
    ]);
    const file = test.info().outputPath(`template-${dl.suggestedFilename()}`);
    await dl.saveAs(file);
    return fs.readFileSync(file, 'utf8');
  }

  // ---------- Suspend / Reinstate (Submit saves at once: Details -> Complete) ----------

  // Fill the opened Suspend / Reinstate form and Submit
  async submitStatusForm(action: 'Suspend' | 'Reinstate', serial: string, reason: string, remarks: string): Promise<void> {
    if (action === 'Suspend') await this.input('reason').selectOption({ label: reason });
    await this.fillCounted('description', remarks);
    await this.captureStep(`${action} Reader ${serial}: ${reason}, remarks "${remarks.slice(0, 30)}", before Submit`);
    await stopBeforeSaving(this, `${action} Reader Submit for ${serial} (Submit saves at once)`);
    await this.button('Submit').click();
    await this.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await this.captureStep(`After ${action} Submit for ${serial}`);
  }

  // From Reader Summary: Quicklink Suspend Reader / Reinstate Reader on the serial, fill, Submit
  async setStatus(action: 'Suspend' | 'Reinstate', serial: string, reason: string, remarks: string): Promise<void> {
    const row = await this.findSerial(serial);
    await this.quicklinkGo(row.first(), `${action} Reader`);
    await this.submitStatusForm(action, serial, reason, remarks);
  }

  // ---------- Reader Details ----------

  async openDetails(serial: string): Promise<void> {
    const row = await this.findSerial(serial);
    await this.quicklinkGo(row.first(), 'View Details');
  }
  // statusHistory() and exportCsv(): shared, in AdministratorPage
}
