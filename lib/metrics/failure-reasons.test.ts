import { describe, it, expect } from "vitest";
import { friendlyFailure, summarizeFailureReasons } from "./failure-reasons";

describe("friendlyFailure", () => {
  it("maps known Daraja result codes to plain language", () => {
    expect(friendlyFailure(1).reason).toBe("Insufficient funds");
    expect(friendlyFailure(1032).reason).toBe("Cancelled by customer");
    expect(friendlyFailure(1037).reason).toBe("No response from customer");
    expect(friendlyFailure(2001).reason).toBe("Wrong M-Pesa PIN");
  });

  it("never exposes a raw numeric code in the label", () => {
    for (const code of [1, 17, 1001, 1019, 1032, 1037, 2001, 9999]) {
      expect(friendlyFailure(code).reason).not.toMatch(/\d/);
    }
  });

  it("falls back to status when the code is unknown", () => {
    expect(friendlyFailure(4321, "cancelled").reason).toBe("Cancelled by customer");
    expect(friendlyFailure(null, "failed").reason).toBe("Payment failed");
  });

  it("falls back to a safe generic when nothing matches", () => {
    expect(friendlyFailure(null, undefined).reason).toBe("Payment not completed");
    expect(friendlyFailure(4321, "weird").reason).toBe("Payment not completed");
  });
});

describe("summarizeFailureReasons", () => {
  it("collapses rows into friendly buckets, summed and sorted by frequency", () => {
    const out = summarizeFailureReasons([
      { resultCode: 1, status: "failed", count: 3 },
      { resultCode: 1032, status: "cancelled", count: 5 },
      { resultCode: null, status: "cancelled", count: 2 }, // also "Cancelled by customer"
    ]);
    expect(out[0]).toEqual({ reason: "Cancelled by customer", count: 7 });
    expect(out[1]).toEqual({ reason: "Insufficient funds", count: 3 });
  });

  it("returns an empty array for no rows", () => {
    expect(summarizeFailureReasons([])).toEqual([]);
  });
});
