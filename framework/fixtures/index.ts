import { test as base } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { APIClient } from '../core/APIClient';

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
