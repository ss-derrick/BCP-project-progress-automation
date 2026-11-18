import type { Locator } from '@playwright/test';
import { AddCompanyFormPage } from '../../common/pages/AddCompanyFormPage';
import type { NewHostCompany } from '../../common/creation/hostCompanyData';

// APH version of "Add a Company": only what APH has on top of the shared form.
//   MID row: "Host Swing Priority" (required on APH, 1-2 digits)
export class AphAddCompanyFormPage extends AddCompanyFormPage {
  protected override async fillPortalMidFields(row: Locator, n: number, data: NewHostCompany): Promise<void> {
    await this.typeInto(row.locator(`[name="hostSwingPriority${n}"]`), String(data.hostSwingPriority), { pressTab: true });
  }
}
