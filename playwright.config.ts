import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration File
 * 
 * This file orchestrates the entire test execution flow, including environment
 * settings, browser configurations, and project dependencies (Hybrid Auth Flow).
 * 
 * CONTROL FLOW SUMMARY:
 * 1. Playwright identifies all test files according to the 'projects' configuration.
 * 2. The 'setup' project runs first because the 'chromium' project lists it as a dependency.
 * 3. Once 'setup/auth.setup.ts' completes and saves the 'admin.json', the 'chromium' project begins.
 * 4. All tests in 'chromium' are injected with the authenticated storage state.
 */
export default defineConfig({
    // Directory where all test files are located
    testDir: './tests',

    // Run tests in files in parallel to optimize execution time
    fullyParallel: true,

    // Reporter to use. 'html' generates a detailed report viewable in a browser
    reporter: 'html',

    // Shared settings for all projects
    use: {
        // Base URL used in navigateTo() and APIClient calls to resolve relative paths
        baseURL: 'http://localhost:8080',
        
        // Collect trace when retrying a failed test. See https://playwright.dev/docs/trace-viewer
        trace: 'on-first-retry',

        // Set to false to see the browser UI during execution (useful for debugging)
        headless: false,
    },

    /**
     * Projects allow grouping tests with different configurations or dependencies.
     */
    projects: [
        /**
         * PROJECT: Global Setup
         * This project handles prerequisites like API Authentication or Data Seeding
         * that only need to happen once before the functional tests start.
         */
        {
            name: 'setup',
            // Only match files ending in .setup.ts
            testMatch: /.*\.setup\.ts/,
        },

        /**
         * PROJECT: Chromium (E2E Tests)
         * This is the main project where your functional UI tests run.
         */
        {
            name: 'chromium',
            use: {
                // Use standard desktop chrome settings
                ...devices['Desktop Chrome'],

                /**
                 * AUTHENTICATION INJECTION:
                 * This line tells the browser to load the cookies and local storage
                 * captured by the 'setup' project before starting any UI test.
                 */
                storageState: 'playwright/.auth/admin.json',
            },

            /**
             * ORCHESTRATION:
             * This ensures the 'setup' project completes successfully before 
             * 'chromium' tests are even triggered.
             */
            dependencies: ['setup'],
        },
    ],
});
