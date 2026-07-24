import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notifyKycApproved, notifyPayoutConcluded, notifyRefundConcluded, notifyReconciliationMismatches } from './notifications';
import { sendEmail, isEmailConfigured } from './client';
import { resolveOrgRecipients, resolveStaffRecipients } from './recipients';

vi.mock('./client', () => ({ sendEmail: vi.fn(), isEmailConfigured: vi.fn() }));
vi.mock('./recipients', () => ({ resolveOrgRecipients: vi.fn(), resolveStaffRecipients: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('notifications (fail-open orchestration)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('short-circuits entirely when email is not configured', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(false);
    await notifyKycApproved('org-1');
    expect(resolveOrgRecipients).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('resolves recipients and sends when configured', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    vi.mocked(resolveOrgRecipients).mockResolvedValue({ businessName: 'Acme', emails: ['owner@acme.com'] });
    await notifyKycApproved('org-1');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({ to: ['owner@acme.com'] });
  });

  it('sends nothing (no throw) when there are no recipients', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    vi.mocked(resolveOrgRecipients).mockResolvedValue({ businessName: 'Acme', emails: [] });
    await notifyKycApproved('org-1');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('never throws even if sendEmail rejects', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    vi.mocked(resolveOrgRecipients).mockResolvedValue({ businessName: 'Acme', emails: ['owner@acme.com'] });
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('boom'));
    await expect(notifyKycApproved('org-1')).resolves.toBeUndefined();
  });

  it('picks the failed template for a failed payout and completed for a completed one', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    vi.mocked(resolveOrgRecipients).mockResolvedValue({ businessName: 'Acme', emails: ['o@a.com'] });

    await notifyPayoutConcluded({ organizationId: 'org-1', status: 'failed', amount: 500, phone: '254712345678', resultDesc: 'x', mpesaReceipt: null } as never);
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toMatch(/failed/i);

    vi.mocked(sendEmail).mockClear();
    await notifyPayoutConcluded({ organizationId: 'org-1', status: 'completed', amount: 500, phone: '254712345678', resultDesc: null, mpesaReceipt: 'LGR1' } as never);
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toMatch(/sent/i);
  });

  it('does not email for a non-completed refund', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    await notifyRefundConcluded({ organizationId: 'org-1', status: 'failed', amount: 500, mpesaReceipt: null } as never);
    expect(resolveOrgRecipients).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not email staff when there are zero reconciliation mismatches', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    await notifyReconciliationMismatches(0);
    expect(resolveStaffRecipients).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
