import { test as base } from '@playwright/test';
import { BasePage } from './BasePage';
import { APIClient } from './APIClient';

type FrameworkFixtures = {
    basePage: BasePage;
    apiClient: APIClient;
};

export const test = base.extend<FrameworkFixtures>({
    basePage: async ({ page }, use) => {
        await use(new BasePage(page));
    },
    apiClient: async ({ request }, use) => {
        await use(new APIClient(request));
    },
});

export { expect } from '@playwright/test';
