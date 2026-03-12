import { test, expect } from '../../framework/fixtures';

test('verify core imports and fixtures', async ({ basePage, apiClient }) => {
    expect(basePage).toBeDefined();
    expect(apiClient).toBeDefined();
});
