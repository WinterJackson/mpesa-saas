import { describe, it, expect } from 'vitest';
import { mapResultCodeToStatus } from './mpesa-status';

describe('mapResultCodeToStatus', () => {
  it('should return completed for 0', () => {
    expect(mapResultCodeToStatus(0)).toBe('completed');
  });

  it('should return cancelled for 1032', () => {
    expect(mapResultCodeToStatus(1032)).toBe('cancelled');
  });

  it('should return failed for 1037', () => {
    expect(mapResultCodeToStatus(1037)).toBe('failed');
  });

  it('should return failed for 2001', () => {
    expect(mapResultCodeToStatus(2001)).toBe('failed');
  });

  it('should return failed for 1', () => {
    expect(mapResultCodeToStatus(1)).toBe('failed');
  });

  it('should return failed for arbitrary unknown code', () => {
    expect(mapResultCodeToStatus(9999)).toBe('failed');
  });
});
