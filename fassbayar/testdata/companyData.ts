import { NOTIFY_EMAIL } from '../../common/config/testConfig';
import { Portals } from '../../common/config/portals';
import {
  createCompanyData as createCommonCompanyData,
  createBusinessAndAuthoriser as createCommonBusinessAndAuthoriser,
  type CompanyOptions, type CompanyData, type BusinessAndAuthoriser, type BusinessOptions
} from '../../common/creation/companyData';

// Data for "All Companies > Add a Company" - generator, value pools and
// shapes are shared with every portal: common/creation/companyData.ts.
// Hosts (Service Providers) and their card schemes / payment types:
// common/hosts/hosts.ts.
//
// Here only the FassBayar defaults: FassBayar portal profile + NOTIFY_EMAIL.
//   createCompanyData()                         1 MID on TPA (TPA + PreAuth CNP)
//   createCompanyData({ hosts: ['GP'] })        1 MID on Global Payment
//   createCompanyData({ hosts: ['GP', 'CIMB'] }) 2 MIDs
// Every call: new random values, new random unique 15-digit MID(s).

export * from '../../common/creation/companyData';
export { PaymentTypeCheckbox, type PaymentType } from '../../common/hosts/paymentTypes';

export function createCompanyData(opts: CompanyOptions = {}): CompanyData {
  return createCommonCompanyData(Portals.fassbayar, { notifyEmail: NOTIFY_EMAIL, ...opts });
}

export function createBusinessAndAuthoriser(opts: BusinessOptions = {}): BusinessAndAuthoriser {
  return createCommonBusinessAndAuthoriser(Portals.fassbayar, { notifyEmail: NOTIFY_EMAIL, ...opts });
}
