import { test as setup, expect } from '../../framework/fixtures/index';

/**
 * Global Setup: Authenticates via API and saves the session state.
 * This script runs once before the E2E tests and allows all subsequent
 * tests to skip the login UI.
 */
const authFile = 'playwright/.auth/admin.json';

setup('authenticate as Administrator', async ({ apiClient, request }) => {
    // 1. Perform API Login
    const response = await apiClient.login('Administrator', 'admin');
    expect(response.ok()).toBeTruthy();

    // 2. Save the resulting cookies/session to a file
    await request.storageState({ path: authFile });
    
    console.log(`Auth setup complete. State saved to ${authFile}`);
});
