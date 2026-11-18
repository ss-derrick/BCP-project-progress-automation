import { test, expect } from '../fixtures/pages';
import { loginAsAdmin } from '../flows/loginFlow';
import { BulkUploadTemplate } from '../testdata/constants';
import { testCase } from '../../common/utils/testCase';

test.describe('All Companies - Bulk Company Upload (Create)', () => {

  test(
    'Download the bulk company upload template',
    testCase({ id: 'TC-FASSBAYAR-003', module: 'Company Management', priority: 'Medium' }),
    async ({ loginPage, homePage, bulkCompanyUploadPage }) => {

      await loginAsAdmin(loginPage);

      await test.step('Open All Companies > Bulk Company Upload (Create)', async () => {
        await homePage.openAllCompanies();
        await bulkCompanyUploadPage.open();
      });

      const file = await test.step('Click "download template"', () =>
        bulkCompanyUploadPage.downloadTemplate());

      await test.step('Verify the downloaded template', async () => {
        expect(file.fileName).toBe(BulkUploadTemplate.fileName);
        expect(file.content.trim().length, 'Template file is empty').toBeGreaterThan(0);

        const header = file.content.split(/\r?\n/)[0].split(',').map((c) => c.trim());
        console.log(`Template ${file.fileName}: ${header.length} columns`);

        for (const column of BulkUploadTemplate.requiredColumns) {
          expect.soft(header, `Template header should have column "${column}"`).toContain(column);
        }
        expect(header[0]).toBe('Business Name');
      });

      await bulkCompanyUploadPage.holdForViewing('Bulk Company Upload');
    }
  );

  test(
    'Upload the downloaded bulk company template',
    testCase({ id: 'TC-FASSBAYAR-004', module: 'Company Management', priority: 'High' }),
    async ({ loginPage, homePage, bulkCompanyUploadPage }) => {

      await loginAsAdmin(loginPage);

      await test.step('Open All Companies > Bulk Company Upload (Create)', async () => {
        await homePage.openAllCompanies();
        await bulkCompanyUploadPage.open();
      });

      const file = await test.step('Download the template', () =>
        bulkCompanyUploadPage.downloadTemplate());

      await test.step('Upload CSV: choose the downloaded template', () =>
        bulkCompanyUploadPage.chooseCsv(file.path, file.fileName));

      await test.step('Click Upload', () =>
        bulkCompanyUploadPage.upload());

      await test.step('Verify "File successfully uploaded" page', () =>
        bulkCompanyUploadPage.verifyUploadSuccess());

      await bulkCompanyUploadPage.holdForViewing('Upload result');
    }
  );
});
