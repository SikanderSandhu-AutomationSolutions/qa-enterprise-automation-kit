# QA Enterprise Automation Kit — Framework Vision

> [!IMPORTANT]
> **This document is the "Source of Truth" for the architectural vision of this project.** 
> All future modifications, features, and target applications MUST align with the principles defined here. 
> **AI/Agents:** Read this document BEFORE proposing or executing any structural changes.

## 🌟 The Vision: "Platform over Project"

This repository is not just a collection of tests for one application; it is a **platform-grade QA Automation Framework**. 

The core philosophy is **Decoupling**:
1. **The Framework (Product)**: Reusable core logic, drivers, and utilities that represent the value proposition.
2. **The App (Target)**: The specific system being tested (e.g., ERPNext, Salesforce).
3. **The Tests (Value)**: Domain-specific scenarios that use the Framework to validate the App.

This architecture allows the framework to scale horizontally. Adding a new target system (e.g., HubSpot) becomes a matter of adding a new folder in `apps/` without duplicating core logic.

---

## 📂 Directory Structure & Roles

### `framework/` (The Core)
- **Role**: Reusable, app-agnostic automation engine.
- **Contents**: 
  - Base Page Objects/Components.
  - API Client wrappers.
  - Custom Loggers / Reporting engines.
  - Database connection helpers.
  - Data generators.

### `apps/` (The Targets)
- **Role**: Contains the "Target Systems Under Test" (SUT).
- **Contents**: 
  - Docker Compose files to spin up the target app.
  - App-specific configuration.
  - Dummy data generators specific to that app.
  - Example: `apps/erpnext-demo/`.

### `tests/` (The Scenarios)
- **Role**: Business-logic verification layer.
- **Contents**: 
  - Organized by domain/business process (e.g., `tests/crm/`, `tests/sales/`).
  - High-level test scripts that `import` from `framework/`.

### `docker/` (Common Infra)
- **Role**: Shared infrastructure used by the framework or across multiple apps.
- **Contents**: 
  - Playwright/Selenium Grid setup.
  - Allure Report server.
  - Mock API servers.

### `ci/` (The Pipeline)
- **Role**: Continuous Integration & Deployment.
- **Contents**: 
  - GitHub Actions / GitLab CI templates.
  - Reusable pipeline steps for running tests in parallel.

---

## 🛡️ Governance Rules for AI & Developers

1. **Don't pollute the Framework**: If a helper is specific ONLY to ERPNext, it belongs in `apps/erpnext-demo/` or `tests/erpnext/`, NOT in `framework/`.
2. **Path References**: Always use relative paths starting from the project root or environment-agnostic resolvers.
3. **Isolation**: Breaking one `apps/` container should not prevent the `framework/` or other `apps/` from functioning.
