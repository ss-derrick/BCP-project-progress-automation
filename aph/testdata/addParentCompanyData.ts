import { Portals } from '../../common/config/portals';
import {
  createParentCompanyData,
  type ParentCompanyData, type MerchantType
} from '../../common/creation/parentCompanyData';
import { AUTHORISER_EMAIL } from './addCompanyData';

// Test data for "Add a Parent Company" - shared with every portal:
// common/creation/parentCompanyData.ts. Every call makes NEW values so
// each run creates a different parent company. Here only the APH defaults
// (portal profile + AUTHORISER_EMAIL).

export type NewParentCompany = ParentCompanyData;

export function createParentCompany(merchantType: MerchantType): NewParentCompany {
  return createParentCompanyData(Portals.aph, { merchantType, notifyEmail: AUTHORISER_EMAIL });
}
