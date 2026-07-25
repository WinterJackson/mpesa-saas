/**
 * Plain-language M-Pesa failure reasons for non-technical merchants. Maps raw
 * Daraja STK `ResultCode`s (and, as a fallback, our own transaction status) to a
 * short label + a one-line explanation an ordinary shop owner can act on — never
 * expose a raw numeric code in the UI.
 *
 * Reference: Safaricom Daraja STK Push result codes. Only the common, meaningful
 * ones are enumerated; anything else falls through to a safe generic message.
 */

export interface FriendlyFailure {
  /** Short label, e.g. "Insufficient funds". */
  reason: string;
  /** One-line, customer-actionable explanation. */
  detail: string;
}

const RESULT_CODE_MAP: Record<number, FriendlyFailure> = {
  0: { reason: "Successful", detail: "Payment completed successfully." },
  1: {
    reason: "Insufficient funds",
    detail: "The customer’s M-Pesa balance was too low to complete the payment.",
  },
  17: {
    reason: "M-Pesa system error",
    detail: "M-Pesa reported an internal error. Ask the customer to try again.",
  },
  20: {
    reason: "M-Pesa busy",
    detail: "M-Pesa was temporarily busy. Ask the customer to try again shortly.",
  },
  26: {
    reason: "M-Pesa busy",
    detail: "M-Pesa was temporarily busy. Ask the customer to try again shortly.",
  },
  1001: {
    reason: "Another payment in progress",
    detail:
      "The customer had another M-Pesa transaction in progress. Ask them to finish it and try again.",
  },
  1019: {
    reason: "Request expired",
    detail: "The payment request expired before the customer completed it.",
  },
  1025: {
    reason: "M-Pesa system error",
    detail: "M-Pesa could not process the request. Ask the customer to try again.",
  },
  1032: {
    reason: "Cancelled by customer",
    detail: "The customer cancelled the M-Pesa prompt on their phone.",
  },
  1037: {
    reason: "No response from customer",
    detail: "The customer didn’t enter their PIN in time, or their phone was unreachable.",
  },
  2001: {
    reason: "Wrong M-Pesa PIN",
    detail: "The customer entered an incorrect M-Pesa PIN.",
  },
  9999: {
    reason: "M-Pesa system error",
    detail: "An unexpected M-Pesa error occurred. Ask the customer to try again.",
  },
};

const STATUS_FALLBACK: Record<string, FriendlyFailure> = {
  cancelled: {
    reason: "Cancelled by customer",
    detail: "The customer cancelled or didn’t complete the M-Pesa prompt.",
  },
  failed: {
    reason: "Payment failed",
    detail: "The payment didn’t go through. The customer can try again.",
  },
  pending: {
    reason: "Awaiting customer",
    detail: "Waiting for the customer to enter their M-Pesa PIN.",
  },
  expired: {
    reason: "Request expired",
    detail: "The payment request expired before it was completed.",
  },
};

const GENERIC: FriendlyFailure = {
  reason: "Payment not completed",
  detail: "The payment didn’t complete. The customer can try again.",
};

/**
 * Resolve a friendly reason from a Daraja result code, falling back to the
 * transaction status, then to a safe generic. Never throws.
 */
export function friendlyFailure(
  resultCode: number | null | undefined,
  status?: string | null
): FriendlyFailure {
  if (resultCode != null && RESULT_CODE_MAP[resultCode]) return RESULT_CODE_MAP[resultCode];
  if (status && STATUS_FALLBACK[status]) return STATUS_FALLBACK[status];
  return GENERIC;
}

export interface FailureReasonCount {
  reason: string;
  count: number;
}

/**
 * Collapses raw (resultCode, status, count) rows into friendly-labelled buckets,
 * summed by reason and sorted most-frequent first — the "top failure reasons"
 * breakdown for the dashboard and transactions summary.
 */
export function summarizeFailureReasons(
  rows: { resultCode: number | null; status: string; count: number }[]
): FailureReasonCount[] {
  const byReason = new Map<string, number>();
  for (const row of rows) {
    const { reason } = friendlyFailure(row.resultCode, row.status);
    byReason.set(reason, (byReason.get(reason) ?? 0) + row.count);
  }
  return [...byReason.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}
