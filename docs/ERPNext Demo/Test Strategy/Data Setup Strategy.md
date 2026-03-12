# ERPNext Automation Strategy: Setting up Real-World Scenarios

ERPNext is a comprehensive ERP, which makes it an incredible target for UI and API automation practice. Because it covers everything from accounting to HR, you can build highly realistic, interconnected end-to-end (E2E) test scenarios.

Here is a strategic guide on how to approach data setup and automation against your `http://localhost:8080/desk` instance.

---

## 1. The "First Login" Setup Wizard (UI Automation)

When you spin up the `apps/erpnext-demo` container and log in as `Administrator` for the very first time, Frappe usually presents a **Setup Wizard**.

### The Scenario
Automating the Setup Wizard is the ultimate first UI test. 
* **Goal**: Fill out the company name, abbreviation, base currency, chart of accounts, and financial year.
* **Why it matters**: Without this, you cannot create financial records like Sales Orders or Invoices.

> **Tip for Playwright**: The Setup Wizard uses a lot of dynamic slider panels and dropdowns (custom Frappe UI components, not standard HTML `<select>`). This is fantastic practice for handling complex, custom web components.

---

## 2. Recommended Modules for E2E Practice

To emulate corporate business scenarios, focus on the **"Procure-to-Pay"** and **"Order-to-Cash"** data journeys. These touch multiple departments and mirror real-world QA challenges.

### Scenario A: Order-to-Cash (Sales Journey)
This is the most standard business flow to automate.
1. **CRM**: Create a `Lead`.
2. **Selling**: Convert the Lead to a `Customer`.
3. **Selling**: Create a `Quotation` for the Customer for an `Item`.
4. **Selling**: Convert the Quotation to a `Sales Order`.
5. **Stock**: Create a `Delivery Note` to ship the item (reduces stock).
6. **Accounting**: Create a `Sales Invoice` from the Delivery Note.
7. **Accounting**: Create a `Payment Entry` to mark the invoice as paid.

### Scenario B: Procure-to-Pay (Purchasing Journey)
1. **Stock**: Create a `Material Request` (we need to buy more laptops).
2. **Buying**: Create a `Purchase Order` for a `Supplier`.
3. **Stock**: Create a `Purchase Receipt` (laptops arrived in the warehouse).
4. **Accounting**: Create a `Purchase Invoice`.
5. **Accounting**: Create a `Payment Entry` to pay the Supplier.

---

## 3. Data Setup Strategies

To run the scenarios above, your database needs "Master Data" (e.g., standard Items, Warehouses, Customers, Suppliers, and Tax rules). 

You have three ways to approach this in your automation framework:

### Strategy 1: The API Injection Setup (Highly Recommended)
Because we verified that the ERPNext Frappe REST API is fully functional, **you should use the API to seed data before UI tests run.**

* **How**: In your Playwright `test.beforeEach` or `test.beforeAll` hooks, use your `APIClient` to execute `POST /api/resource/Customer` and `POST /api/resource/Item`.
* **Pros**: Extremely fast. Makes your UI tests isolated and reliable. Instead of the UI test navigating menus to create an item, the API does it in 100ms, and the UI test can immediately go to the "Sales Order" screen.
* **Practice Value**: Teaches you how to blend API and UI automation into a single hybrid test framework.

### Strategy 2: CSV Data Import via UI
ERPNext has a core feature called **"Data Import"**.
* **How**: Write a Playwright test that navigates to the "Data Import" list, uploads a `.csv` file full of Customer data, and maps the columns to the database.
* **Pros**: Great practice for handling file uploads (`page.setInputFiles()`) and complex data grids in Playwright.

### Strategy 3: Pure UI Data Creation
* **How**: Write Playwright scripts that manually click through `Desk > Selling > Customer > New`, type in the fields, and hit Save.
* **Pros**: Good for practicing specific form interactions.
* **Cons**: Extremely slow if you do this for every test prerequisite. It leads to "flaky" tests if the Customer form changes.

---

## Summary Action Plan

To start building your actual tests:

1. **Write an API login script**: Expand your `APIClient.ts` to hit `/api/method/login` to retrieve the session cookie.
2. **Create a Setup Fixture**: Write a Playwright API script to create 1 `Customer` and 1 `Item`.
3. **Write the First UI Test**: Write a Playwright script that logs into `http://localhost:8080`, goes to the Sales Order list, and creates an order for the Customer and Item you generated via the API.
