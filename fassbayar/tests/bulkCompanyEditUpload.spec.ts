import fs from 'node:fs';
import { test, expect } from '../fixtures/pages';
import { loginAsAdmin } from '../flows/loginFlow';
import { BulkEditTargetCompanyId, BulkEditTemplate } from '../testdata/constants';
import { uniqueTag } from '../../common/utils/random';
import { testCase } from '../../common/utils/testCase';

const parseRows = (content: string): string[][] =>
  content.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(BulkEditTemplate.separator));

test.describe('All Companies - Bulk Company Upload (Edit)', () => {

  test.beforeEach(async ({ loginPage, homePage, bulkCompanyEditUploadPage }) => {
    await loginAsAdmin(loginPage);
    await test.step('Open All Companies > Bulk Company Upload (Edit)', async () => {
      await homePage.openAllCompanies();
      await bulkCompanyEditUploadPage.open();
    });
  });

  test(
    'Download the bulk company edit template',
    testCase({ id: 'TC-FASSBAYAR-005', module: 'Company Management', priority: 'Medium' }),
    async ({ bulkCompanyEditUploadPage }) => {

      const file = await test.step('Click "download template"', () =>
        bulkCompanyEditUploadPage.downloadTemplate());

      await test.step('Verify the downloaded template', async () => {
        expect(file.fileName).toBe(BulkEditTemplate.fileName);
        const rows = parseRows(file.content);
        expect(rows.length, 'Template file is empty').toBeGreaterThan(0);
        expect(rows[0].map((c) => c.trim())).toEqual([...BulkEditTemplate.header]);
      });

      await bulkCompanyEditUploadPage.holdForViewing('Bulk Company Upload (Edit)');
    }
  );

  test(
    'Upload the edit template with new special fields and apply changes',
    testCase({ id: 'TC-FASSBAYAR-006', module: 'Company Management', priority: 'High' }),
    async ({ page, bulkCompanyEditUploadPage, companyDetailsPage }) => {
      const companyId = BulkEditTargetCompanyId;

      // Business name of the target company (the CSV carries it too)
      const businessName = await test.step(`Read company ${companyId} business name`, async () => {
        const back = page.url();
        await companyDetailsPage.goto(companyId);
        const name = (await companyDetailsPage.value('Business Name').innerText()).trim();
        expect(name, `Company ${companyId} not found`).not.toBe('');
        await page.goto(back);
        return name;
      });

      const file = await test.step('Download the template', () =>
        bulkCompanyEditUploadPage.downloadTemplate());

      // New random, unique Reference 1-5 values
      const tag = uniqueTag().toUpperCase();
      const references = [1, 2, 3, 4, 5].map((n) => `R${n}-${tag}`);

      const editFile = await test.step('Fill the template: company + new references', async () => {
        const [header] = parseRows(file.content);
        const row = [companyId, businessName, ...references];
        const fileName = `bulkEdit-${tag}.csv`;
        const path = test.info().outputPath(fileName);
        fs.writeFileSync(path, [header, row].map((r) => r.join(BulkEditTemplate.separator)).join('\n') + '\n');
        await test.info().attach(fileName, { path, contentType: 'text/csv' });
        return { fileName, path };
      });

      await test.step('Upload CSV and click Upload', async () => {
        await bulkCompanyEditUploadPage.chooseCsv(editFile.path, editFile.fileName);
        await bulkCompanyEditUploadPage.upload();
      });

      await test.step('CSV List: 1 row, 0 errors, ready to apply', async () => {
        await bulkCompanyEditUploadPage.verifyCsvList({ fileName: editFile.fileName, total: 1, rowsWithErrors: 0 });
        await bulkCompanyEditUploadPage.verifyReadyToApply();
      });

      await test.step('Apply Changes', async () => {
        await bulkCompanyEditUploadPage.applyChanges();
        await bulkCompanyEditUploadPage.verifySpecialFieldsUpdated(editFile.fileName, 1);
      });

      await test.step(`Company ${companyId} shows the new Reference 1-5`, async () => {
        await companyDetailsPage.goto(companyId);
        await companyDetailsPage.verifyReferences(references);
      });

      await companyDetailsPage.holdForViewing('Company Details');
    }
  );

  test(
    'Upload the edit template unchanged is rejected (sample company does not exist)',
    testCase({ id: 'TC-FASSBAYAR-007', module: 'Company Management', priority: 'Medium' }),
    async ({ bulkCompanyEditUploadPage }) => {

      const file = await test.step('Download the template', () =>
        bulkCompanyEditUploadPage.downloadTemplate());

      await test.step('Upload it unchanged', async () => {
        await bulkCompanyEditUploadPage.chooseCsv(file.path, file.fileName);
        await bulkCompanyEditUploadPage.upload();
      });

      await test.step('CSV List: 1 row with error, nothing applied', async () => {
        const total = parseRows(file.content).length - 1;
        await bulkCompanyEditUploadPage.verifyCsvList({ fileName: file.fileName, total, rowsWithErrors: total });
        await bulkCompanyEditUploadPage.verifyRejected([BulkEditTemplate.sampleRowError]);
      });

      await bulkCompanyEditUploadPage.holdForViewing('Upload result');
    }
  );
});
