import { buildInitiatorAuth, postInitiatorCommand, type DarajaCommandResponse } from '@/lib/daraja-initiator';
import { transactionStatusResultUrl, transactionStatusTimeoutUrl } from '@/lib/daraja-urls';

/**
 * General Transaction Status Query (not STK-specific) — asks Safaricom for the
 * authoritative status of any M-Pesa transaction by receipt. Result arrives
 * asynchronously at the result callback; used for reconciliation, never to
 * auto-heal a failure (guardrail #4).
 */
export async function queryTransactionStatus(params: {
  organizationId: string;
  environment: 'sandbox' | 'live';
  transactionReceipt: string;
  remarks?: string;
}): Promise<DarajaCommandResponse> {
  const { organizationId, environment, transactionReceipt, remarks } = params;
  const auth = await buildInitiatorAuth(organizationId, environment);

  const payload = {
    Initiator: auth.initiatorName,
    SecurityCredential: auth.securityCredential,
    CommandID: 'TransactionStatusQuery',
    TransactionID: transactionReceipt,
    PartyA: auth.shortcode,
    IdentifierType: '4', // organization shortcode
    ResultURL: transactionStatusResultUrl(),
    QueueTimeOutURL: transactionStatusTimeoutUrl(),
    Remarks: (remarks ?? 'Status query').substring(0, 100),
    Occasion: '',
  };

  return postInitiatorCommand(environment, '/mpesa/transactionstatus/v1/query', payload, auth.accessToken, 'Transaction Status');
}
