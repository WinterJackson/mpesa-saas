// Base URL for Daraja Result/QueueTimeout callbacks. These callbacks point at
// PaySwift's OWN routes (same for every organization), unlike the STK callback
// which is stored per-org. Prefer MPESA_CALLBACK_BASE_URL; otherwise derive the
// origin from the STK callback URL.
export function callbackBaseUrl(): string {
  const explicit = process.env.MPESA_CALLBACK_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const stk = process.env.MPESA_CALLBACK_URL;
  if (!stk) {
    throw new Error('No callback base URL configured (set MPESA_CALLBACK_BASE_URL or MPESA_CALLBACK_URL).');
  }
  return new URL(stk).origin;
}

export const b2cResultUrl = () => `${callbackBaseUrl()}/api/mpesa/b2c/result`;
export const b2cTimeoutUrl = () => `${callbackBaseUrl()}/api/mpesa/b2c/timeout`;
export const c2bConfirmationUrl = () => `${callbackBaseUrl()}/api/mpesa/c2b/confirmation`;
export const c2bValidationUrl = () => `${callbackBaseUrl()}/api/mpesa/c2b/validation`;
export const transactionStatusResultUrl = () => `${callbackBaseUrl()}/api/mpesa/transaction-status/result`;
export const transactionStatusTimeoutUrl = () => `${callbackBaseUrl()}/api/mpesa/transaction-status/timeout`;
export const accountBalanceResultUrl = () => `${callbackBaseUrl()}/api/mpesa/account-balance/result`;
export const accountBalanceTimeoutUrl = () => `${callbackBaseUrl()}/api/mpesa/account-balance/timeout`;
export const reversalResultUrl = () => `${callbackBaseUrl()}/api/mpesa/reversal/result`;
export const reversalTimeoutUrl = () => `${callbackBaseUrl()}/api/mpesa/reversal/timeout`;
