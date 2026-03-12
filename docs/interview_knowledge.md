# Interview Prep: Hybrid Test Architecture (API + UI)

This document explains the "Hybrid" testing pattern implemented in this framework. This knowledge is high-value for senior QA and SDET interviews.

---

## 1. The Core Concept: Hybrid Testing
Instead of performing every action in a test through the browser UI, we use the **API for prerequisites** (Login, Data Seeding) and the **UI for business logic validation**.

### The Problem it Solves
*   **Speed**: UI login/setup takes 10–20 seconds per test. In a suite of 100 tests, that's 30+ minutes of wasted time. API setup takes milliseconds.
*   **Flakiness**: 80% of test failures happen during setup, not during the actual feature validation. Removing UI setup removes 80% of flakiness.

---

## 2. Technical Data Flow (The "Playwright Way")

1.  **Global Setup (`auth.setup.ts`)**: 
    - The framework triggers an API call (`POST /api/method/login`) via the `APIClient`.
    - Upon success, the server returns a session cookie (`sid`).
    - The framework saves this cookie and other local storage data into a JSON file (`playwright/.auth/admin.json`).

2.  **Storage State (`playwright.config.ts`)**:
    - We tell Playwright: "Before starting the browser for E2E tests, inject the cookies found in `admin.json`."

3.  **UI Execution**:
    - The browser opens the application. Because it already has the valid `sid` cookie, the application treats the user as authenticated.
    - We navigate directly to internal URLs (e.g., `/app/selling`), bypassing the login screen entirely.

---

## 3. How to answer interview questions

### Q: "How do you handle authentication in your automation suites?"
**A:** "I use a hybrid approach leveraging Playwright's **Storage State**. Instead of logging in via the UI for every test, I have a **Global Setup project** that authenticates via an API call once per suite execution. It saves the session cookies to a JSON file, which is then injected into the browser context for all subsequent UI tests. This reduces execution time by roughly 10-15 seconds per test."

### Q: "How do you ensure test isolation if you share a login?"
**A:** "We share the **session state**, but not the **test data**. I use an `APIClient` fixture to seed unique master data (like a new Customer with a timestamped name) before each test run. The UI test then executes against that specific record. This gives us the speed of a shared session with the reliability of data isolation."

### Q: "What's the benefit of writing your own API wrapper (`APIClient`)?"
**A:** "It centralizes logic. If the developers change the API endpoint from `/api/login` to `/v2/auth`, I only have to update a single line in my `APIClient` class, and every test (setup, seeding, validation) is automatically updated."

---

## 4. Key Terminology for your Resume
*   **Storage State**: Playwright's mechanism for capturing/restoring authenticated browser states.
*   **Project Dependencies**: Configuring Playwright to run a setup project (Auth) before a main project (E2E).
*   **Data Seeding**: Using API to create prerequisites so UI tests are dedicated to UX/Business flow validation.
*   **Separation of Concerns**: UI tests for UI/UX; API setup for state/data management.
