import { describe, it, expect } from 'vitest';
import * as t from './templates';

describe('email templates', () => {
  it('every builder returns a non-empty subject, html, and text', () => {
    const samples: t.RenderedEmail[] = [
      t.welcomeEmail('Acme'),
      t.kycSubmittedEmail('Acme'),
      t.kycApprovedEmail('Acme'),
      t.kycRejectedEmail('Acme', 'Blurry ID'),
      t.goLiveApprovedEmail('Acme'),
      t.payoutCompletedEmail({ businessName: 'Acme', amount: 500, phone: '254712345678', receipt: 'LGR1' }),
      t.payoutFailedEmail({ businessName: 'Acme', amount: 500, phone: '254712345678', reason: 'insufficient' }),
      t.refundCompletedEmail({ businessName: 'Acme', amount: 500, receipt: 'LGR1' }),
      t.invoiceIssuedEmail({ businessName: 'Acme', amount: 5000 }),
      t.invoicePaidEmail({ businessName: 'Acme', amount: 5000 }),
      t.apiKeyCreatedEmail({ businessName: 'Acme', scope: 'read_write', keyPrefix: 'pk_live_ab' }),
      t.webhookSecretRotatedEmail('Acme'),
      t.dataExportReadyEmail('Acme'),
      t.dataDeletionRequestedEmail('Acme'),
      t.staffNewKycEmail({ businessName: 'Acme', documentType: 'id' }),
      t.staffGoLiveRequestedEmail('Acme'),
      t.staffReconciliationEmail({ count: 3 }),
    ];
    for (const s of samples) {
      expect(s.subject.length).toBeGreaterThan(0);
      expect(s.html).toContain('<!doctype html>');
      expect(s.html).toContain('PaySwift');
      expect(s.text.length).toBeGreaterThan(0);
    }
  });

  it('masks the customer phone in payout emails (never the raw number)', () => {
    const email = t.payoutCompletedEmail({ businessName: 'Acme', amount: 500, phone: '254712345678', receipt: 'LGR1' });
    expect(email.html).not.toContain('254712345678');
    expect(email.text).not.toContain('254712345678');
    expect(email.html).toContain('2547');
  });

  it('never places a full API key in the body — only the non-secret prefix', () => {
    const email = t.apiKeyCreatedEmail({ businessName: 'Acme', scope: 'read_write', keyPrefix: 'pk_live_ab' });
    expect(email.html).toContain('pk_live_ab');
    // A full generated key would be much longer; the template must not invent one.
    expect(email.html).not.toMatch(/pk_live_[a-z0-9]{20,}/i);
  });

  it('escapes HTML in merchant-supplied values (no injection via business name)', () => {
    const email = t.welcomeEmail('<script>alert(1)</script>');
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('formats amounts as KES', () => {
    expect(t.invoiceIssuedEmail({ businessName: 'Acme', amount: 12345 }).subject).toContain('KES');
  });
});
