import { NOTIFY_EMAIL } from '../../common/config/testConfig';
import { Portals } from '../../common/config/portals';
import {
  createParentCompanyData as createCommonParentCompanyData,
  type ParentCompanyData, type ParentCompanyOptions
} from '../../common/creation/parentCompanyData';

// Data for "All Companies > Add a Parent Company" - shared with every
// portal: common/creation/parentCompanyData.ts. Here only the FassBayar
// defaults (portal profile + NOTIFY_EMAIL).
//   createParentCompanyData({ merchantType: 'HQ Merchant' })

export * from '../../common/creation/parentCompanyData';

export function createParentCompanyData(opts: ParentCompanyOptions = {}): ParentCompanyData {
  return createCommonParentCompanyData(Portals.fassbayar, { notifyEmail: NOTIFY_EMAIL, ...opts });
}
