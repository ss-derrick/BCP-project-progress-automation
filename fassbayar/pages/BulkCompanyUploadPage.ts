import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { Timeouts } from '../../common/config/testConfig';

// A downloaded file, saved under the test's output folder
export interface DownloadedFile {
  fileName: string;
  path: string;
  content: string;
}

// Expected "CSV List" summary after uploading an Edit CSV
export interface CsvListSummary {
  fileName: string;
  total: number;
  rowsWithErrors: number;
}

// The two bulk upload pages share one layout:
//   "download template" link, "Upload CSV" (Browse) and an "Upload" button
export type BulkUploadMode = 'create' | 'edit';

const MODES = {
  // All Companies > Bulk Company Upload (Create) -> /company/upload
  create: {
    title: 'Bulk Company Upload (Create)',
    path: '/company/bulkupload',
    url: /\/company\/bulkupload/
  },
  // All Companies > Bulk Company Upload (Edit): validates the CSV first
  // ("CSV List"), then "Apply Changes" -> /company/doBulkEditUpload
  edit: {
    title: 'Bulk Company Upload (Edit)',
    path: '/company/bulkEditUpload',
    url: /\/company\/bulkEditUpload/
  }
} as const;

export class BulkCompanyUploadPage extends BasePage {
  readonly downloadTemplateLink = this.page.locator('a.dl', { hasText: 'download template' });
  // "Browse" is a styled hidden <input type=file>; the text box shows the file name
  readonly uploadInput = this.page.locator('#realupload');
  readonly uploadFileName = this.page.locator('#fakeupload');
  readonly uploadButton = this.page.getByRole('link', { name: 'Upload', exact: true });

  // Create: result page
  readonly uploadSuccessMessage = this.page.getByText(
    'File successfully uploaded, you will receive an email after few minutes.'
  );

  // Edit: "CSV List" validation result + Apply Changes
  readonly csvListHeading = this.page.getByText('CSV List', { exact: true });
  readonly allRowsValidMessage = this.page.getByText('All rows are valid and ready to apply.');
  readonly fileHasErrorsMessage = this.page.getByText(
    'The file has errors and cannot be applied until they are fixed. No changes have been made.'
  );
  readonly applyChangesButton = this.page.getByRole('link', { name: 'Apply Changes' });
  readonly specialFieldsUpdatedMessage = this.page.getByText('Special fields updated successfully.');

  constructor(page: BasePage['page'], readonly mode: BulkUploadMode = 'create') {
    super(page);
  }

  // Value next to a label: <div class="confirmLabel">TOTAL</div><div class="confirmValue">1</div>
  value(label: string) {
    return this.page.locator(
      `xpath=//div[contains(@class,"confirmLabel")][normalize-space(.)="${label}"]/following-sibling::div[1]`
    ).first();
  }

  private get config() {
    return MODES[this.mode];
  }

  // Quicklinks > "Bulk Company Upload (Create / Edit)" (on any All Companies page)
  async open(): Promise<void> {
    await this.page.locator(`a[href="${this.config.path}"]`).filter({ visible: true }).first().click();
    await this.page.waitForURL(this.config.url, { timeout: Timeouts.pageLoad });
    await expect(this.page.getByText('Registration Details')).toBeVisible();
    await expect(this.downloadTemplateLink).toBeVisible();
    await this.captureScreen(this.config.title);
  }

  // Click "download template", save the file and attach it to the report
  async downloadTemplate(): Promise<DownloadedFile> {
    await this.scrollToElement(this.downloadTemplateLink);
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: Timeouts.pageLoad }),
      this.downloadTemplateLink.click()
    ]);

    expect(await download.failure(), 'Template download failed').toBeNull();

    const fileName = download.suggestedFilename();
    const path = test.info().outputPath(fileName);
    await download.saveAs(path);

    // Strip the UTF-8 BOM the server may add at the start of the CSV
    const content = fs.readFileSync(path, 'utf8').replace(/^﻿/, '');

    await test.info().attach(fileName, { path, contentType: 'text/csv' });
    await this.captureScreen('Template downloaded');

    return { fileName, path, content };
  }

  // "Upload CSV": choose the file (same as Browse > Open)
  async chooseCsv(filePath: string, fileName: string): Promise<void> {
    await this.scrollToElement(this.uploadFileName);
    await this.uploadInput.setInputFiles(filePath);
    await expect(this.uploadFileName).toHaveValue(new RegExp(escapeRegex(fileName)));
    await this.captureScreen('CSV file chosen');
  }

  // Click "Upload" (form post). Any validation alert = rejected -> fail.
  async upload(): Promise<void> {
    let alert = '';
    this.page.once('dialog', async (d) => { alert = d.message(); await d.accept(); });

    await Promise.all([
      this.page.waitForEvent('load', { timeout: Timeouts.pageLoad }).catch(() => { /* checked below */ }),
      this.uploadButton.click()
    ]);

    expect(alert, `Upload was rejected with an alert: "${alert}"`).toBe('');
  }

  // ---------- Create ----------

  async verifyUploadSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/company\/upload$/, { timeout: Timeouts.pageLoad });
    await expect(this.uploadSuccessMessage).toBeVisible();
    await this.captureScreen('File successfully uploaded');
  }

  // ---------- Edit ----------

  async verifyCsvList(expected: CsvListSummary): Promise<void> {
    await expect(this.csvListHeading).toBeVisible({ timeout: Timeouts.pageLoad });
    await expect(this.value('Filename')).toHaveText(expected.fileName);
    await expect(this.value('TOTAL')).toHaveText(String(expected.total));
    await expect(this.value('Row(s) With Error(s)')).toHaveText(String(expected.rowsWithErrors));
    await this.captureScreen('CSV List');
  }

  // Valid file: message + "Apply Changes" offered
  async verifyReadyToApply(): Promise<void> {
    await expect(this.allRowsValidMessage).toBeVisible();
    await expect(this.applyChangesButton).toBeVisible();
    await expect(this.fileHasErrorsMessage).toBeHidden();
  }

  // Invalid file: error message, row errors listed, nothing to apply
  async verifyRejected(rowErrors: (string | RegExp)[]): Promise<void> {
    await expect(this.fileHasErrorsMessage).toBeVisible();
    for (const error of rowErrors) {
      await expect(this.page.getByText(error)).toBeVisible();
    }
    await expect(this.applyChangesButton).toBeHidden();
    await this.captureScreen('File has errors - no changes made');
  }

  async applyChanges(): Promise<void> {
    await this.scrollToElement(this.applyChangesButton);
    await this.applyChangesButton.click();
    await this.page.waitForURL(/\/company\/doBulkEditUpload/, { timeout: Timeouts.pageLoad });
  }

  async verifySpecialFieldsUpdated(fileName: string, total: number): Promise<void> {
    await expect(this.specialFieldsUpdatedMessage).toBeVisible();
    await expect(this.value('Filename')).toHaveText(fileName);
    await expect(this.value('TOTAL')).toHaveText(String(total));
    await this.captureScreen('Special fields updated successfully');
  }
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
