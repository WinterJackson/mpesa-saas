import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, clampLimit, cursorWhere, toPage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination';

describe('cursor encode/decode', () => {
  it('round-trips a createdAt+id key', () => {
    const key = { createdAt: new Date('2026-07-01T12:00:00.000Z'), id: 'tx_123' };
    const decoded = decodeCursor(encodeCursor(key));
    expect(decoded?.id).toBe('tx_123');
    expect(decoded?.createdAt.toISOString()).toBe('2026-07-01T12:00:00.000Z');
  });

  it('handles ids containing a pipe by splitting on the last separator', () => {
    const key = { createdAt: new Date('2026-07-01T12:00:00.000Z'), id: 'a|b|c' };
    expect(decodeCursor(encodeCursor(key))?.id).toBe('a|b|c');
  });

  it('returns null for a garbage cursor', () => {
    expect(decodeCursor('!!!not-base64!!!')).toBeNull();
    expect(decodeCursor(Buffer.from('no-separator', 'utf8').toString('base64url'))).toBeNull();
  });
});

describe('clampLimit', () => {
  it('defaults when missing/invalid', () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit('abc')).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(0)).toBe(DEFAULT_PAGE_SIZE);
  });
  it('caps at MAX_PAGE_SIZE', () => {
    expect(clampLimit(1000)).toBe(MAX_PAGE_SIZE);
    expect(clampLimit('30')).toBe(30);
  });
});

describe('cursorWhere', () => {
  it('is empty without a cursor', () => {
    expect(cursorWhere(null)).toEqual({});
    expect(cursorWhere(undefined)).toEqual({});
  });
  it('builds a keyset OR clause from a valid cursor', () => {
    const c = encodeCursor({ createdAt: new Date('2026-07-01T00:00:00.000Z'), id: 'x' });
    const where = cursorWhere(c) as { OR: unknown[] };
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toHaveLength(2);
  });
});

describe('toPage', () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ id: `id${i}`, createdAt: new Date(2026, 0, 10 - i) }));

  it('returns a nextCursor when there is a look-ahead row', () => {
    const page = toPage(rows, 5);
    expect(page.data).toHaveLength(5);
    expect(page.nextCursor).not.toBeNull();
  });

  it('returns null nextCursor when the page is not full', () => {
    const page = toPage(rows.slice(0, 3), 5);
    expect(page.data).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });
});
