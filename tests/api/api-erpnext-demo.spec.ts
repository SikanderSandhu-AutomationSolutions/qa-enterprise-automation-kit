import { test, expect } from '../../framework/fixtures/index';

/**
 * This test suite demonstrates how to use the core APIClient fixture to authenticate
 * with ERPNext/Frappe. 
 * 
 * Authentication is a prerequisite for most API interactions like data seeding.
 */
test.describe('ERPNext API Authentication', () => {

    test('should successfully login as Administrator', async ({ apiClient }) => {
        // Use the inject apiClient fixture
        // In a real scenario, use environment variables for credentials: 
        // process.env.ERP_USER, process.env.ERP_PASSWORD
        const response = await apiClient.login('Administrator', 'admin');

        // Assert that the response is successful (HTTP 200)
        expect(response.ok()).toBeTruthy();

        // Extra check: Frappe login returns a JSON object with a 'message' field on success
        const body = await response.json();
        expect(body.message).toBe('Logged In');
        
        console.log('Login successful! Session cookie is now stored in the request context.');
    });

    test('should fail to login with incorrect credentials', async ({ apiClient }) => {
        // We expect this to throw an error based on the implementation in APIClient.ts
        try {
            await apiClient.login('Administrator', 'wrong-password');
            // If it doesn't throw, explicitly fail the test
            test.fail();
        } catch (error: any) {
            expect(error.message).toContain('Login failed');
            console.log('Correctly handled login failure.');
        }
    });
});
