import { describe, it, expect } from 'vitest';
import { whatsappUrl, SUPPORT_WHATSAPP_NUMBER } from './support';

describe('support config', () => {
  it('SUPPORT_WHATSAPP_NUMBER is digits-only (no "+" or spaces)', () => {
    expect(SUPPORT_WHATSAPP_NUMBER).toMatch(/^\d+$/);
  });

  it('whatsappUrl builds a wa.me deep link with a URL-encoded prefilled message', () => {
    const url = whatsappUrl('Hi there & help');
    expect(url.startsWith(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=`)).toBe(true);
    // "&" and spaces must be percent-encoded so they don't break the query.
    expect(url).toContain('Hi%20there%20%26%20help');
    expect(url).not.toContain(' ');
  });

  it('whatsappUrl uses a sensible default message when none is given', () => {
    expect(whatsappUrl()).toContain('text=');
  });
});
