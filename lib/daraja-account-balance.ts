import { buildInitiatorAuth, postInitiatorCommand, type DarajaCommandResponse } from '@/lib/daraja-initiator';
import { accountBalanceResultUrl, accountBalanceTimeoutUrl } from '@/lib/daraja-urls';

/**
 * Account Balance query — the working balance arrives asynchronously at the
 * result callback, which snapshots it (AccountBalanceSnapshot) for ops alerting.
 */
export async function queryAccountBalance(params: {
  organizationId: string;
  environment: 'sandbox' | 'live';
  remarks?: string;
}): Promise<DarajaCommandResponse> {
  const { organizationId, environment, remarks } = params;
  const auth = await buildInitiatorAuth(organizationId, environment);

  const payload = {
    Initiator: auth.initiatorName,
    SecurityCredential: auth.securityCredential,
    CommandID: 'AccountBalance',
    PartyA: auth.shortcode,
    IdentifierType: '4', // organization shortcode
    Remarks: (remarks ?? 'Balance check').substring(0, 100),
    ResultURL: accountBalanceResultUrl(),
    QueueTimeOutURL: accountBalanceTimeoutUrl(),
  };

  return postInitiatorCommand(environment, '/mpesa/accountbalance/v1/query', payload, auth.accessToken, 'Account Balance');
}
