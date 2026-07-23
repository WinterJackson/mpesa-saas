/**
 * Shared opaque cursor pagination for list endpoints. Keyset (seek) pagination
 * ordered by (createdAt desc, id desc) — stable and index-friendly, no OFFSET.
 * The cursor is an opaque base64url token encoding the last row's createdAt+id;
 * callers must treat it as opaque and just echo back `nextCursor`.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface CursorKey {
  createdAt: Date;
  id: string;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export function encodeCursor(key: CursorKey): string {
  return Buffer.from(`${key.createdAt.toISOString()}|${key.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorKey | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    // Split on the FIRST separator — the ISO createdAt never contains a '|', so
    // everything after it is the id (which may itself contain '|').
    const sep = decoded.indexOf('|');
    if (sep === -1) return null;
    const createdAt = new Date(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Clamps a requested limit into [1, MAX_PAGE_SIZE], defaulting when absent/invalid. */
export function clampLimit(raw: number | string | null | undefined): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  if (!n || isNaN(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

/**
 * Prisma `where` fragment implementing "strictly after this cursor" under the
 * (createdAt desc, id desc) ordering. Returns {} when there's no cursor.
 */
export function cursorWhere(cursor: string | null | undefined): Record<string, unknown> {
  if (!cursor) return {};
  const key = decodeCursor(cursor);
  if (!key) return {};
  return {
    OR: [
      { createdAt: { lt: key.createdAt } },
      { AND: [{ createdAt: key.createdAt }, { id: { lt: key.id } }] },
    ],
  };
}

/**
 * Given rows fetched with `take: limit + 1`, splits off the extra look-ahead row
 * and returns the page plus the nextCursor (null when there are no more rows).
 */
export function toPage<T extends CursorKey>(rows: T[], limit: number): Page<T> {
  if (rows.length <= limit) {
    return { data: rows, nextCursor: null };
  }
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { data: page, nextCursor: encodeCursor(last) };
}
