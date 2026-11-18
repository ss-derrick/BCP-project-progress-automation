// All host profiles + the Service Provider codes / names the form uses.
export type { HostProfile, PaymentTypeKey } from './types';
import { AeonCredit } from './aeonCredit';
import { HongLeongBank } from './hongLeongBank';
import { AmBank } from './ambank';
import { GlobalPayment } from './globalPayment';
import { FasspayQrHost } from './fasspayQrHost';
import { Tpa } from './tpa';
import { Uob } from './uob';
import { Maybank } from './maybank';
import { Cimb } from './cimb';
import { Ocbc } from './ocbc';
import { Aeon360 } from './aeon360';
import { Ndps } from './ndps';

export { AeonCredit, HongLeongBank, AmBank, GlobalPayment, FasspayQrHost, Tpa, Uob, Maybank, Cimb, Ocbc, Aeon360, Ndps };
export { MAYBANK_AMEX_MID } from './maybank';

// Every host known on any portal. Which portal offers which = portals.config.ts
export const ALL_HOSTS = [AeonCredit, HongLeongBank, FasspayQrHost, AmBank, Tpa, GlobalPayment, Uob, Maybank, Cimb, Ocbc, Aeon360, Ndps];

// Service Provider dropdown values (APH order first, then Fassbayar-only)
export const ServiceProvider = {
  AEON_CREDIT: 'ACS',
  HONG_LEONG_BANK: 'HLB',
  FASSPAY_QR_HOST: 'FP',
  AMBANK: 'AMB',
  TPA: 'TPA',
  GLOBAL_PAYMENT: 'GP',
  UOB: 'UOB',
  MAYBANK: 'MBB',
  CIMB: 'CIMB',
  // Fassbayar only (codes confirmed by the scan of 18 Nov 2026)
  OCBC: 'OCBC',
  AEON360: 'AEON360',
  NDPS: 'NDPS'
} as const;
export type ServiceProviderCode = typeof ServiceProvider[keyof typeof ServiceProvider];

// Service Provider names as the page shows them
export const ServiceProviderName = Object.fromEntries(
  ALL_HOSTS.map((h) => [h.code, h.name])
) as Record<ServiceProviderCode, string>;

export const hostByCode = (code: string) => ALL_HOSTS.find((h) => h.code === code);
