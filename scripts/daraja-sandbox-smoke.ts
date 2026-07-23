import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// MANUAL sandbox smoke test — exercises the real Safaricom sandbox against a
// chosen organization's stored credentials. NEVER run in CI (it hits Safaricom
// and depends on live sandbox availability). Run during go-live prep to confirm
// the full chain works end-to-end for one org.
//
// Usage:
//   npx tsx scripts/daraja-sandbox-smoke.ts <organizationId> [stk|b2c|balance]
//
// Requires the org to have sandbox credentials (all orgs do after onboarding),
// and for b2c/balance, sandbox initiator credentials + certs/sandbox.cer.

async function main() {
  const [, , organizationId, op = 'stk'] = process.argv;
  if (!organizationId) {
    console.error('Usage: npx tsx scripts/daraja-sandbox-smoke.ts <organizationId> [stk|b2c|balance]');
    process.exit(1);
  }

  // Imported lazily so dotenv is loaded first.
  const { getAccessToken, initiateSTKPush } = await import('../lib/daraja');
  const { initiateB2C } = await import('../lib/daraja-b2c');
  const { queryAccountBalance } = await import('../lib/daraja-account-balance');

  const SANDBOX_TEST_MSISDN = '254708374149';

  console.log(`\n=== Daraja sandbox smoke: org=${organizationId} op=${op} ===\n`);

  console.log('1. OAuth token…');
  const token = await getAccessToken(organizationId, 'sandbox');
  console.log(`   OK — token length ${token.length}\n`);

  if (op === 'stk') {
    console.log('2. STK Push (KES 1 to sandbox test number)…');
    const res = await initiateSTKPush({ organizationId, environment: 'sandbox', phone: SANDBOX_TEST_MSISDN, amount: 1, accountReference: 'Smoke', transactionDesc: 'Smoke test' });
    console.log('   OK —', JSON.stringify(res, null, 2));
  } else if (op === 'b2c') {
    console.log('2. B2C payout (KES 10 to sandbox test number)…');
    const res = await initiateB2C({ organizationId, environment: 'sandbox', amount: 10, phone: SANDBOX_TEST_MSISDN, remarks: 'Smoke payout' });
    console.log('   OK —', JSON.stringify(res, null, 2));
  } else if (op === 'balance') {
    console.log('2. Account Balance query…');
    const res = await queryAccountBalance({ organizationId, environment: 'sandbox' });
    console.log('   OK —', JSON.stringify(res, null, 2));
  } else {
    console.error(`Unknown op "${op}". Use stk | b2c | balance.`);
    process.exit(1);
  }

  console.log('\nNote: async results (STK/B2C/balance) arrive at the callback routes, not here.');
}

main().then(() => process.exit(0)).catch((e) => { console.error('\nSMOKE FAILED:', e); process.exit(1); });
