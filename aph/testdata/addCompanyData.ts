import { Portals } from '../../common/config/portals';
import {
  createCompanyData as createCommonCompanyData,
  type CompanyData, type CompanyOptions
} from '../../common/creation/companyData';

// Test data for "Add a Company" - generator, value pools and shapes are
// shared with every portal: common/creation/companyData.ts.
// Hosts (Service Providers) and their card schemes / payment types:
// common/hosts/hosts.ts.
//
// Every call makes NEW values (name, BRN, email, random unique 15-digit
// MIDs) so each run creates a different company and nothing collides.

// TODO(config): authoriser email for companies created by automation.
// The portal sends the new authoriser's login details to this address
// (each run uses a "+tag" alias of it).
export const AUTHORISER_EMAIL = process.env.AUTHORISER_EMAIL ?? 'qa.automation@example.com';

// APH defaults: APH portal profile + AUTHORISER_EMAIL
//   createCompanyData({ hosts: ['GP'] })          1 MID on Global Payment
export function createCompanyData(opts: CompanyOptions = {}): CompanyData {
  return createCommonCompanyData(Portals.aph, { notifyEmail: AUTHORISER_EMAIL, ...opts });
}

// A company with 3 MIDs on 3 different hosts:
//   1 - Aeon Credit, 2 - Hong Leong Bank, 3 - AmBank   (Payment Type: Retail)
export function createCompanyWith3Mids(): CompanyData {
  return createCompanyData({ hosts: ['ACS', 'HLB', 'AMB'] });
}
