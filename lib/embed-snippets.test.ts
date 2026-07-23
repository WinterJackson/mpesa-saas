import { describe, it, expect } from 'vitest';
import { buttonSnippet, popupSnippet } from './embed-snippets';

const PAY_URL = 'https://app.payswift.io/pay/abc123';
const SCRIPT_URL = 'https://app.payswift.io/pay-button.js';

describe('embed snippets', () => {
  it('buttonSnippet embeds the pay URL in an anchor with the M-Pesa label', () => {
    const snippet = buttonSnippet(PAY_URL);
    expect(snippet).toContain(`href="${PAY_URL}"`);
    expect(snippet).toContain('Pay with M-Pesa');
    expect(snippet).toContain('target="_blank"');
    expect(snippet).toContain('rel="noopener noreferrer"');
    // Zero-JS button — must not reference the popup script.
    expect(snippet).not.toContain('<script');
  });

  it('popupSnippet includes the data attribute and the script tag', () => {
    const snippet = popupSnippet(PAY_URL, SCRIPT_URL);
    expect(snippet).toContain(`data-payswift-url="${PAY_URL}"`);
    expect(snippet).toContain(`<script src="${SCRIPT_URL}" async></script>`);
    expect(snippet).toContain('Pay with M-Pesa');
  });
});
