import { expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';

// FASSBAYAR ONLY - Bill Payment Details (/transaction/billPaymentBatch?batchId=...)
// "You are currently viewing Batch No. : 000060", credit settlement message,
// Summary (PDF), Total Amount, and a Verification Method filter for the batch's
// transactions. The business name is NOT shown here.
// Read only: nothing on this page is clicked.
export class BillPaymentDetailsPage extends BasePage {
  readonly content = this.page.locator('#rightMainContent');

  async verifyOpenedFor(batchNo: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/transaction\/billPaymentBatch\?batchId=\d+/);
    await expect(this.page).toHaveTitle(/Bill Payment Details/);
    await expect(this.content).toContainText(new RegExp(`Batch No\\.\\s*:\\s*${batchNo}`));
    await expect(this.content).toContainText('Total Amount');
  }

  // Status "Successful" -> "The credit settlement for this batch was successful"
  async verifySettlementMessage(status: string): Promise<void> {
    await expect(this.content).toContainText(
      new RegExp(`credit settlement for this batch was ${status}`, 'i')
    );
  }
}
