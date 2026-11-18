// Payment Type checkboxes in MID Settings, as the page labels them ->
// checkbox name prefix. The real checkbox name is prefix + MID row number,
// e.g. MID row 0 "Retail" = input[name="retailCheckbox0"].
// Same names on every portal; a portal that lacks one simply has no such box
// (see common/config/portals.ts).
export const PaymentTypeCheckbox = {
  Retail: 'retailCheckbox',
  QR: 'qrCheckbox',
  'Member Info/Top up': 'memberCheckbox',
  IPP: 'ippCheckbox',
  'Fasspay Wallet': 'fasspayWalletCheckbox',
  MyDebit: 'myDebitCheckbox',
  TPA: 'tpaCheckbox',
  CashOut: 'cashOutCheckbox',
  PreAuth: 'preAuthCheckbox',
  'DuitNow Static QR': 'duitNowQRStaticCheckbox',
  AMEX: 'amexCheckbox',
  Superks: 'superksCheckbox',
  'NDPS Wallet': 'ndpsQrCheckbox'
} as const;

export type PaymentType = keyof typeof PaymentTypeCheckbox;

// QR wallets: the list that opens under "Fasspay Wallet" / "QR".
// The page needs at least ONE ticked ("Please choose one payment type").
// Label as shown -> checkbox name prefix (+ MID row number).
export const QrWalletCheckbox = {
  'Fasspay QR': 'fasspayQRCheckbox',
  'Alipay QR': 'alipayQRCheckbox',
  'Boost QR': 'boostQRCheckbox',
  'GrabPay QR': 'grabpayQRCheckbox',
  'Maybank QR': 'maybankQRCheckbox',
  'MCash QR': 'mcashQRCheckbox',
  'TnG QR': 'tngQRCheckbox',
  'UnionPay QR': 'unionpayQRCheckbox',
  'ShopeePay QR': 'shopeepayQRCheckbox',
  'WeChat Pay CN': 'wechatpaycnQRCheckbox',
  'DuitNow QR': 'duitNowQRCheckbox'
} as const;

export type QrWallet = keyof typeof QrWalletCheckbox;

export const ALL_PAYMENT_TYPES = Object.keys(PaymentTypeCheckbox) as PaymentType[];
