import { describe, it, expect } from 'vitest';
import { parseWorkingBalance } from './account-balance';

describe('parseWorkingBalance', () => {
  it('parses the Working Account balance from a Daraja balance string', () => {
    const raw = 'Working Account|KES|481000.00|481000.00|0.00|0.00&Utility Account|KES|100.00|100.00|0.00|0.00';
    expect(parseWorkingBalance(raw)).toBe(481000);
  });

  it('falls back to the first account when there is no Working Account', () => {
    expect(parseWorkingBalance('Utility Account|KES|250.50|250.50|0.00|0.00')).toBe(251);
  });

  it('returns null when the balance value is not numeric', () => {
    expect(parseWorkingBalance('Working Account|KES|N/A|')).toBeNull();
  });
});
