import { test, expect } from '@playwright/test';
import type { CommonAddParentCompanyPage } from '../pages/company/AddParentCompanyPage';
import type { CreatedCompany } from '../pages/company/CompanyFormPage';
import type { ParentCompanyData } from '../creation/parentCompanyData';

// "Add a Parent Company" journey, the same on every portal:
//   fill the form -> Submit -> check Review & Confirm -> Confirm -> Complete
// Be on the Add a Parent Company form first (addParentCompanyPage.open()).
//
// confirm: false = DRY RUN, stops on Review & Confirm: nothing is created.
export async function addParentCompany(
  addParentCompanyPage: CommonAddParentCompanyPage,
  data: ParentCompanyData,
  { confirm = true }: { confirm?: boolean } = {}
): Promise<CreatedCompany | undefined> {

  await test.info().attach('parent-company-data', {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json'
  });

  await test.step(`Fill Business, Authoriser, settings, Merchant Type ${data.merchantType}`, () =>
    addParentCompanyPage.fillParentCompanyDetails(data));

  await test.step('Submit', () =>
    addParentCompanyPage.submitCompanyDetails());

  await test.step('Review & Confirm shows the entered data', () =>
    addParentCompanyPage.verifyParentReview(data));

  if (!confirm) return undefined;

  // Confirm = the parent company is CREATED here
  await test.step('Confirm', () => addParentCompanyPage.confirm());

  return test.step('Complete - parent company added', async () => {
    const created = await addParentCompanyPage.readCreatedCompany();
    console.log('Created parent company:', created);

    expect(created.businessName, 'Business Name').toBe(data.businessName);
    expect(created.mid, 'A parent company has no MID').toBe('N/A');
    expect(created.userId, 'Authoriser User ID').toMatch(new RegExp(`^${data.userIdPrefix}\\d{3}$`, 'i'));
    expect(created.itemId, 'itemid of the new parent company').not.toBe('');

    test.info().annotations.push({
      type: 'note',
      description: `Created parent company (${data.merchantType}) itemid=${created.itemId}, User ID ${created.userId}`
    });
    return created;
  });
}
