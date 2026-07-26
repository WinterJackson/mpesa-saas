import { describe, it, expect } from 'vitest';
import { estimateComparisonCost, DEFAULT_PERCENTAGE_PROVIDER_RATE } from './pricing';

describe('estimateComparisonCost', () => {
  it('calculates 3% of the total volume correctly', () => {
    // 1000 KES volume * 3% = 30 KES
    expect(estimateComparisonCost(1000)).toBe(30);

    // 100,000 KES volume * 3% = 3,000 KES
    expect(estimateComparisonCost(100000)).toBe(3000);
  });

  it('rounds to the nearest whole number', () => {
    // 1,050 KES * 3% = 31.5 -> rounds to 32
    expect(estimateComparisonCost(1050)).toBe(32);
    
    // 1,040 KES * 3% = 31.2 -> rounds to 31
    expect(estimateComparisonCost(1040)).toBe(31);
  });

  it('allows overriding the benchmark rate', () => {
    // 1000 KES * 5% = 50 KES
    expect(estimateComparisonCost(1000, 0.05)).toBe(50);
  });

  it('returns 0 for 0 volume', () => {
    expect(estimateComparisonCost(0)).toBe(0);
  });
});
