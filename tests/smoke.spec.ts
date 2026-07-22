import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage renders', async ({ page }) => {
    await page.goto('/');
    // Check for some text or element that exists on the landing page
    await expect(page.locator('text=PaySwift')).toBeVisible();
  });

  test('sign-in page is accessible', async ({ page }) => {
    await page.goto('/sign-in');
    // We expect Clerk's sign-in to load
    await expect(page).toHaveTitle(/Sign In/i);
  });
});
