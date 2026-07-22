import { test, expect } from '@playwright/test';

test.describe('E2E Onboarding & Checkout', () => {
  test('Complete flow: Sign up -> Onboarding -> Demo Store -> Checkout initiated', async ({ page }) => {
    // 1. Sign up
    await page.goto('/sign-up');

    // Create unique test user for Clerk test bypass
    const testEmail = `playwright_${Date.now()}+clerk_test@example.com`;

    await page.getByLabel(/Email address|Email/i).fill(testEmail);
    await page.getByRole('button', { name: /Continue|Sign Up/i }).click();

    // Wait for the OTP input
    const otpInput = page.locator('input[name="code"], input[aria-label*="digit"], input.cl-internal-1x6vntf');
    await otpInput.first().waitFor();
    await page.keyboard.type('424242'); // Clerk test OTP

    // 2. Onboarding — a 5-step wizard (components/onboarding/onboarding-wizard.tsx).
    // Step 1 (Business Info) creates the Organization; steps 2-4 (KYC, Payment
    // Setup, Webhook) are all skippable via their own "Continue" button since
    // none are required to reach the dashboard in Phase 1.
    await page.waitForURL('**/onboarding');
    await page.getByLabel(/Business Name/i).fill('E2E Test Business');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: KYC Documents — skip.
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3: Payment Setup — skip, keep the pooled sandbox credentials.
    await page.getByRole('button', { name: 'Continue with pooled sandbox' }).click();

    // Step 4: Webhook — skip (optional field).
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 5: Review — this is the step that actually navigates to the dashboard.
    await page.getByRole('button', { name: 'Go to Dashboard' }).click();

    // 3. Dashboard — business name is rendered in app/(dashboard)/layout.tsx
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=E2E Test Business')).toBeVisible();

    // 4. Demo Store — the real page heading is "Latest Tech Accessories"
    // (app/(public)/demo-store/demo-store-client.tsx); "PaySwift Demo" only
    // ever appears in the page's <title> metadata, never in visible content.
    await page.goto('/demo-store');
    await expect(page.getByRole('heading', { name: 'Latest Tech Accessories' })).toBeVisible();

    // Open the checkout dialog by picking the first product — there is no
    // amount field anywhere; price is fixed per selected product.
    await page.getByRole('button', { name: 'Buy with M-Pesa' }).first().click();

    // Fill the checkout dialog. The label is "M-Pesa Phone Number".
    await page.getByLabel('M-Pesa Phone Number').fill('254700000000');

    // The submit button's accessible name is "Send M-Pesa Prompt", not "Pay".
    await page.getByRole('button', { name: 'Send M-Pesa Prompt' }).click();

    // 5. Confirm the STK push was accepted and the UI moved to the polling
    // state. This is the deterministic stopping point for CI — it proves
    // the full chain (auth -> onboarding -> dashboard -> demo store ->
    // checkout -> Daraja STK initiate) works end-to-end without depending
    // on Safaricom's sandbox actually resolving the push within the test run.
    await expect(page.getByText('Awaiting Payment')).toBeVisible({ timeout: 15000 });

    // --- Optional extension (uncomment only if your team has confirmed
    // Safaricom's sandbox test number 254708374149 reliably auto-resolves
    // STK pushes within a CI-reasonable window): ---
    // await expect(page.getByText('Payment Successful!')).toBeVisible({ timeout: 60000 });
    // await page.goto('/dashboard/transactions');
    // await expect(page.locator('text=completed').first()).toBeVisible({ timeout: 15000 });
  });
});
