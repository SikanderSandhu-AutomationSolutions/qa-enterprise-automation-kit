# Automation Implementation Steps

Blending API data setup with UI automation is the gold standard for testing an ERP system like ERPNext because it ensures your UI tests are fast, isolated, and highly reliable.

Here is a detailed, step-by-step breakdown of how to implement the automation action plan.

---

## Step 1: Write an API login script

To interact with the ERPNext API to create data, you first need to be authenticated. Frappe uses cookie-based authentication via the `sid` (session ID) cookie.

You'll need to expand your `framework/core/APIClient.ts` to include a `login` method. Since Playwright's `APIRequestContext` automatically manages cookies for subsequent requests, once you call `login()`, any further `post()` or `get()` requests made with that same instance will be authenticated.

**Action needed in `APIClient.ts`:**
```typescript
import { APIRequestContext, APIResponse } from '@playwright/test';

export class APIClient {
    private request: APIRequestContext;
    private baseURL: string;

    constructor(request: APIRequestContext, baseURL: string = '') {
        this.request = request;
        this.baseURL = baseURL.replace(/\/$/, '');
    }

    // ... existing get and post methods ...

    /**
     * Authenticate with Frappe / ERPNext
     */
    async login(usr: string, pwd: string): Promise<APIResponse> {
        const response = await this.post('api/method/login', {
            // Frappe expects 'usr' and 'pwd'. Sending as form data is the most reliable method.
            form: {
                usr: usr,
                pwd: pwd
            }
        });
        
        if (!response.ok()) {
            throw new Error(`Login failed: ${response.status()} ${response.statusText()}`);
        }
        
        return response;
    }
}
```

---

## Step 2: Create a Setup Fixture

Now you need a script that runs *before* your UI tests to create the necessary "Master Data" using the authenticated API client. Playwright has a great feature called [Project Dependencies / Setup Projects](https://playwright.dev/docs/test-global-setup) designed exactly for this.

**1. Create a setup script (e.g., `tests/setup/global-data.setup.ts`):**
```typescript
import { test as setup, expect } from '@playwright/test';
import { APIClient } from '../../framework/core/APIClient';

setup('Seed master data for tests', async ({ request, baseURL }) => {
    const api = new APIClient(request, baseURL as string);

    // 1. Log in via API
    await api.login('Administrator', 'admin'); // Use your actual admin credentials

    // 2. Create a Test Customer
    const customerPayload = {
        customer_name: "Auto Customer 001",
        customer_type: "Company",
        customer_group: "Commercial",
        territory: "All Territories"
    };
    
    const customerRes = await api.post('api/resource/Customer', { data: customerPayload });
    // In actual practice, you might want to handle 409 Conflict if it already exists, 
    // or generate a unique name using a timestamp (e.g. \`Auto Customer \${Date.now()}\`)
    expect(customerRes.ok()).toBeTruthy();

    // 3. Create a Test Item
    const itemPayload = {
        item_code: "AUTO-ITEM-001",
        item_name: "Automation Test Laptop",
        item_group: "Products",
        is_stock_item: 1,
        stock_uom: "Nos"
    };

    const itemRes = await api.post('api/resource/Item', { data: itemPayload });
    expect(itemRes.ok()).toBeTruthy();

    // 4. (Optional but recommended) Save the authenticated state
    // This allows your UI tests to skip the login screen entirely!
    await request.storageState({ path: 'playwright/.auth/admin.json' });
});
```

*(Note: You'll also need to configure your `playwright.config.ts` to run this setup file before your E2E project runs).*

---

## Step 3: Write the First UI Test

With the API having seeded `Auto Customer 001` and `AUTO-ITEM-001`, your UI test can focus entirely on the core business flow: Creating a Sales Order.

**Create your UI test (e.g., `tests/e2e/sales-order.spec.ts`):**

```typescript
import { test, expect } from '@playwright/test';

// If you saved the storageState in Step 2, you can load it here to start already logged in
test.use({ storageState: 'playwright/.auth/admin.json' });

test('Create a Sales Order via UI using API-seeded Data', async ({ page }) => {
    // 1. Navigate to the Sales Order list (or directly to the New Sales Order form)
    // Playwright will use the cookies from storageState, bypassing the login screen
    await page.goto('/app/sales-order/new');

    // 2. Wait for the page form to load
    await expect(page.locator('h3:has-text("New Sales Order")')).toBeVisible();

    // 3. Fill in the Customer
    // Frappe uses custom dropdowns (awesomplete). You usually type, wait for the dropdown, and click.
    const customerInput = page.locator('input[data-fieldname="customer"]');
    await customerInput.fill('Auto Customer 001');
    // Wait for the dropdown suggestion to appear and click it
    await page.locator('ul.awesomplete > li:has-text("Auto Customer 001")').click();

    // 4. Set Delivery Date (required by default in ERPNext)
    await page.locator('input[data-fieldname="delivery_date"]').fill('2026-12-31');

    // 5. Add an Item to the Items Table
    // Click the "Add Row" button in the items grid
    await page.locator('button.grid-add-row').click();
    
    // Fill the item code in the newly added row
    const itemInput = page.locator('div[data-fieldname="items"] input[data-fieldname="item_code"]').last();
    await itemInput.fill('AUTO-ITEM-001');
    await page.locator('ul.awesomplete > li:has-text("AUTO-ITEM-001")').click();

    // Fill the quantity
    await page.locator('div[data-fieldname="items"] input[data-fieldname="qty"]').last().fill('5');

    // 6. Save and Submit
    const saveButton = page.locator('button[data-label="Save"]');
    await saveButton.click();

    // Wait for it to become submit
    const submitButton = page.locator('button[data-label="Submit"]');
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    // Confirm submission dialogue
    await page.locator('button:has-text("Yes")').click();

    // 7. Assert Success
    // Ensure the status changes to "To Deliver and Bill" or similar depending on ERPNext configuration
    await expect(page.locator('span.indicator-pill:has-text("To Deliver")')).toBeVisible();
});
```

---

## Summary of Next Steps

1. Make these edits to `APIClient.ts`.
2. Configure your `playwright.config.ts` to support the "Setup Project" pattern.
3. Write the actual files into your repository so you can run `npx playwright test`. 
