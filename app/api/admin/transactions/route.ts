import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-auth';
import { adminSearchTransactions } from '@/lib/repositories/admin-transactions';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminAuth = await requireAdmin(userId);
  if (!adminAuth.allowed) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const phone = searchParams.get('phone')?.trim() || undefined;
  const mpesaReceipt = searchParams.get('mpesaReceipt')?.trim() || undefined;
  const organizationName = searchParams.get('organizationName')?.trim() || undefined;
  const transactionId = searchParams.get('transactionId')?.trim() || undefined;
  
  // Enforce providing at least one search parameter to prevent unbounded queries
  if (!phone && !mpesaReceipt && !organizationName && !transactionId) {
    return NextResponse.json({ transactions: [] });
  }

  try {
    const transactions = await adminSearchTransactions(
      { phone, mpesaReceipt, organizationName, transactionId },
      adminAuth.admin.clerkUserId
    );

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('[Admin Transaction Search] Failed:', error);
    return NextResponse.json({ error: 'Failed to search transactions' }, { status: 500 });
  }
}
