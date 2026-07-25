import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { findTransactionById, updateTransactionNote } from '@/lib/repositories/transactions';
import { requireRole } from '@/lib/rbac';
import { friendlyFailure } from '@/lib/metrics/failure-reasons';

const NOTE_ROLES = ['owner', 'admin', 'finance'] as const;
const MAX_NOTE = 1000;

/** Full transaction detail for the inspector drawer (any org member). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 });

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return NextResponse.json({ success: false, error: 'Organization not found.' }, { status: 404 });

  const { id } = await params;
  const tx = await findTransactionById(context.organization.id, id);
  if (!tx) return NextResponse.json({ success: false, error: 'Transaction not found.' }, { status: 404 });

  // Attach a plain-language reason for anything that didn't complete.
  const failure = tx.status === 'completed' ? null : friendlyFailure(tx.resultCode, tx.status);

  return NextResponse.json({ success: true, data: { ...tx, failure } });
}

/** Update the merchant-only internal note (owner/admin/finance). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 });

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return NextResponse.json({ success: false, error: 'Organization not found.' }, { status: 404 });

  const rbac = await requireRole(context.organization.id, userId, [...NOTE_ROLES]);
  if (!rbac.allowed) return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { note?: unknown };
  const raw = typeof body.note === 'string' ? body.note.trim() : '';
  const note = raw.length === 0 ? null : raw.slice(0, MAX_NOTE);

  const count = await updateTransactionNote(context.organization.id, id, note);
  if (count === 0) return NextResponse.json({ success: false, error: 'Transaction not found.' }, { status: 404 });

  return NextResponse.json({ success: true, data: { note } });
}
