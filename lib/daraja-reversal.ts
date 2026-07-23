import { buildInitiatorAuth, postInitiatorCommand, type DarajaCommandResponse } from '@/lib/daraja-initiator';
import { reversalResultUrl, reversalTimeoutUrl } from '@/lib/daraja-urls';

/**
 * Transaction Reversal — undo a wrongly-sent transaction (e.g. a mistaken B2C
 * payout) by its M-Pesa receipt. Outcome arrives asynchronously at the result
 * callback, which flips the originating Payout to 'reversed'.
 */
export async function reverseTransaction(params: {
  organizationId: string;
  environment: 'sandbox' | 'live';
  transactionReceipt: string;
  amount: number;
  remarks?: string;
}): Promise<DarajaCommandResponse> {
  const { organizationId, environment, transactionReceipt, amount, remarks } = params;
  const auth = await buildInitiatorAuth(organizationId, environment);

  const payload = {
    Initiator: auth.initiatorName,
    SecurityCredential: auth.securityCredential,
    CommandID: 'TransactionReversal',
    TransactionID: transactionReceipt,
    Amount: amount,
    ReceiverParty: auth.shortcode,
    RecieverIdentifierType: '11', // organization shortcode (Daraja's spelling)
    ResultURL: reversalResultUrl(),
    QueueTimeOutURL: reversalTimeoutUrl(),
    Remarks: (remarks ?? 'Reversal').substring(0, 100),
    Occasion: '',
  };

  return postInitiatorCommand(environment, '/mpesa/reversal/v1/request', payload, auth.accessToken, 'Reversal');
}
