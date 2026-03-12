import { test, expect } from '../../framework/fixtures/index';

/**
 * This test demonstrates the "Login Bypass" technique.
 * Because of the global setup in playwright.config.ts, this test
 * starts already authenticated.
 */
test.describe('E2E - Login Bypass Demo', () => {

    test('should navigate directly to the Selling module', async ({ basePage, page }) => {
        // 1. Use the BasePage fixture's navigateTo method
        await basePage.navigateTo('/app/selling');

        // 2. Check that we are NOT on the login page
        await expect(page).not.toHaveURL(/.*login/);

        // 3. Verify we see the page container
        await expect(page.locator('.page-container')).toBeVisible({ timeout: 15000 });

        console.log('Successfully navigated to Selling module while authenticated.');
    });

    test('should see the Customer list without logging in', async ({ basePage, page }) => {
        // Use navigateTo for consistency
        await basePage.navigateTo('/app/customer');
        console.log(`Current URL: ${page.url()}`);

        // Ensure the list head or generic body is visible
        await expect(page.locator('.page-container')).toBeVisible({ timeout: 15000 });

        console.log('Successfully loaded Customer list.');
    });
});
