import { Page } from '@playwright/test';

/**
 * Represents the base class for all Page Object Models (POM).
 * Encapsulates common Playwright page interactions to reduce code duplication
 * and provide a centralized place for generic page operations.
 */
export class BasePage {
    protected page: Page;

    /**
     * Creates an instance of BasePage.
     * 
     * @param page - Playwright's Page instance representing a single tab or window.
     */
    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Navigates the browser to the specified URL.
     * 
     * @param url - The URL to navigate to. Can be an absolute URL or a path relative to the baseURL.
     * @returns A promise that resolves when the page has successfully navigated.
     */
    async navigateTo(url: string): Promise<void> {
        await this.page.goto(url);
    }
}
