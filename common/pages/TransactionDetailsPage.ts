import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

// System Portal - Transaction Details (/transaction/viewDetails?itemid=...).
// SHARED by every portal (scan of both, 18 Nov 2026):
//   "You are currently viewing Transaction ID: <id>", Transaction Details,
//   Batch No., Payment Status, Amount (APH "MYR 3.40" / Fassbayar "RM 38.00"),
//   Sales Description, Customer Details, Receipt Details.
//
// READ ONLY. The page has a "Void Payment Now" button: this page object
// deliberately has no locator for it, so no test can void a real transaction.
export class TransactionDetailsPage extends BasePage {
  readonly content = this.page.locator('#rightMainContent');

  async verifyOpenedFor(trxId: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/transaction\/viewDetails\?/);
    await expect(this.page).toHaveTitle(/Transaction Details/);
    await expect(this.content).toContainText(new RegExp(`Transaction ID:\\s*${trxId}`));
  }

  // "Payment Status" label followed by its value, e.g. Approved
  async verifyPaymentStatus(status: string): Promise<void> {
    await expect(this.content).toContainText(new RegExp(`Payment Status\\s*${status}`, 'i'));
  }
}
