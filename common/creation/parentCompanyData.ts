import type { PortalProfile } from '../config/portals';
import { createBusinessAndAuthoriser, CityMaxLength, type BusinessAndAuthoriser, type BusinessOptions } from './companyData';

// Data for "All Companies > Add a Parent Company" on EVERY portal.
// Business + Authoriser come from the same generator as Add a Company
// (common/creation/companyData.ts): new random, unique values on every call.
//   createParentCompanyData(Portals.aph, { merchantType: 'HQ Merchant' })

export type MerchantType = 'Master Merchant' | 'HQ Merchant';

export interface ParentCompanyData extends BusinessAndAuthoriser {
  merchantType: MerchantType;     // Business Configurations
  apiAuthentication?: boolean;    // "Enable API Authentication Setting" (every portal)
  sso?: boolean;                  // "Enable login via Single Sign On (SSO)" (FassBayar only)
}

export interface ParentCompanyOptions extends Omit<BusinessOptions, 'cityMaxLength'> {
  merchantType?: MerchantType;    // default Master Merchant
  overrides?: Partial<ParentCompanyData>;
}

export function createParentCompanyData(portal: PortalProfile, opts: ParentCompanyOptions = {}): ParentCompanyData {
  return {
    ...createBusinessAndAuthoriser(portal, { ...opts, cityMaxLength: CityMaxLength.parentCompany }),
    merchantType: opts.merchantType ?? 'Master Merchant',
    // Settings: the agreed example (both off), only those this portal has
    ...(portal.parentSettings.includes('apiAuthentication') ? { apiAuthentication: false } : {}),
    ...(portal.parentSettings.includes('sso') ? { sso: false } : {}),
    ...opts.overrides
  };
}
