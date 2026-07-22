import { test, expect } from '@playwright/test';

test.describe('E2E Onboarding & Checkout', () => {
  test('Complete flow: Sign up -> Onboarding -> Demo Store -> Dashboard', async ({ page }) => {
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

    // 2. Onboarding
    await page.waitForURL('**/onboarding');
    await page.getByLabel(/Business Name/i).fill(`E2E Test Business`);
    await page.getByRole('button', { name: /Complete Onboarding|Continue|Save/i }).click();

    // 3. Dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=E2E Test Business')).toBeVisible();

    // 4. Demo Store
    await page.goto('/demo-store');
    await expect(page.locator('text=PaySwift Demo')).toBeVisible();
    
    // Fill payment form
    await page.getByLabel(/Phone Number/i).fill('254700000000');
    await page.getByLabel(/Amount/i).fill('1');
    await page.getByRole('button', { name: /Pay/i }).click();
    
    // Expect success message or status to show pending/success
    await expect(page.locator('text=Status')).toBeVisible({ timeout: 15000 });
  });
});
