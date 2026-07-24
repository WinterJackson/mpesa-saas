import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { inngestFunctions } from '@/lib/inngest-functions';

// Inngest's own endpoint: it calls back into this route to actually run
// deliverWebhookFn (see lib/inngest-functions.ts). Dormant/unreachable in a
// meaningful way until INNGEST_EVENT_KEY/INNGEST_SIGNING_KEY are set — see
// lib/inngest.ts's isInngestConfigured and AGENTS.md.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
