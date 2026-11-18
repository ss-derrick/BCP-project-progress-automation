import { test, expect } from '@playwright/test';
import type { CommonAddCompanyPage } from '../pages/company/AddCompanyPage';
import type { CreatedCompany } from '../pages/company/CompanyFormPage';
import type { CompanyData } from '../creation/companyData';
import { Hosts } from '../hosts/hosts';

// "Add a Company" journey, the same on every portal:
//   fill the form -> Submit -> check Review & Confirm -> Confirm -> Complete
// Be on the Add a Company form first (each portal opens it its own way).
//
// confirm: false = DRY RUN, stops on Review & Confirm: nothing is created.
export async function addCompany(
  addCompanyPage: CommonAddCompanyPage,
  data: CompanyData,
  { confirm = true }: { confirm?: boolean } = {}
): Promise<CreatedCompany | undefined> {

  await test.info().attach('company-data', {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json'
  });

  const hosts = data.mids.map((m) => Hosts[m.host].name).join(', ');

  await test.step(`Fill Company Details (${data.mids.length} MID: ${hosts})`, () =>
    addCompanyPage.fillCompanyDetails(data));

  await test.step('Submit Company Details', () =>
    addCompanyPage.submitCompanyDetails());

  await test.step('Review & Confirm shows the entered data', () =>
    addCompanyPage.verifyCompanyReview(data));

  if (!confirm) return undefined;

  // Confirm = the company is CREATED here
  await test.step('Confirm', () => addCompanyPage.confirm());

  return test.step('Complete - company added', async () => {
    const created = await addCompanyPage.readCreatedCompany();
    console.log('Created company:', created);

    expect(created.businessName, 'Business Name').toBe(data.businessName);
    expect(created.mid, 'MID').toContain(data.mids[0].mid);
    expect(created.userId, 'Authoriser User ID').toMatch(new RegExp(`^${data.userIdPrefix}\\d{3}$`));
    expect(created.itemId, 'itemid of the new company').not.toBe('');

    test.info().annotations.push({
      type: 'note',
      description: `Created company itemid=${created.itemId}, User ID ${created.userId}, ` +
        `MID ${data.mids.map((m) => `${m.mid} (${Hosts[m.host].name})`).join(', ')}`
    });
    return created;
  });
}
