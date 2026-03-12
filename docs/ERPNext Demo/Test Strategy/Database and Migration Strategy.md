# Data Migration and SQL Testing Strategy

To practice data migration testing and backend validation, we can interact directly with the ERPNext MariaDB database. This unlocks powerful QA scenarios where we compare the state of the UI/API against the raw tables.

## 1. Exposing the Database for Automation

By default, the `apps/erpnext-demo/pwd.yml` docker-compose file keeps the MariaDB port internal to the Docker network. To connect to it from our Playwright framework on the host machine, we need to map the port.

### Required Change in `pwd.yml`
You must add a `ports` mapping to the `db` service:

```yaml
  db:
    image: mariadb:10.6
    ...
    ports:
      - "3306:3306"  # Exposes MariaDB to localhost:3306
    environment:
      MYSQL_ROOT_PASSWORD: admin
      MARIADB_ROOT_PASSWORD: admin
```

After modifying the file, restart the container:
```sh
docker compose -f pwd.yml up -d
```

## 2. SQL Automation in Playwright

Once exposed, we can write robust backend validations in Node.js.

### The Setup
1. **Install a MySQL client**: `npm install mysql2`
2. **Create a DB Helper (`framework/utils/Database.ts`)**: Construct a helper class that opens a connection to `localhost:3306` using the `root` / `admin` credentials, executes raw SQL queries, and returns the rows.

### SQL Test Scenarios to Practice
- **Data Integrity**: Create a Customer via the UI, then run `SELECT * FROM tabCustomer WHERE name = 'John Doe'` to verify the record was saved correctly and the `creation` timestamp matches.
- **State Validation**: Complete a Sales Order in the UI, then verify the underlying SQL `docstatus` column changed from `0` (Draft) to `1` (Submitted).
- **Cleanup**: In a `test.afterAll()` hook, execute `DELETE FROM tabItem WHERE name LIKE 'test-auto-%'` to wipe the slate clean if the API teardown fails.

## 3. Data Migration Testing Strategy

Data Migration testing ensures that legacy data is correctly transformed and imported into the new system. ERPNext's primary mechanism for this is the **Data Import tool**.

### Scenario: The Legacy System Migration
Imagine the company is migrating from an old spreadsheet-based CRM to ERPNext.

#### The Practice Workflow
1. **The Source Data**: Create a `.csv` file in your `tests/fixtures/` directory containing 50 leads with intentional dirty data (e.g., missing phone numbers, strange characters).
2. **The Import (UI or API)**:
   - **UI Method**: Write a test that navigates to the "Data Import" workspace, uploads the CSV, maps the fields, and clicks "Start Import".
   - **API Method**: Write a script that reads the CSV, transforms the rows into JSON payloads, and loops through `POST /api/resource/Lead`.
3. **The Migration Validation (SQL)**:
   - Calculate the Expected State: Read the CSV in Node.js, count how many rows *should* have been valid.
   - Query the Actual State: Run `SELECT COUNT(*) FROM tabLead WHERE source = 'Data Import'`
   - Assert: Write `expect(actualDBCount).toBe(expectedCSVCount)`.

This approach gives you hands-on experience with ETL (Extract, Transform, Load) testing, which is a highly sought-after skill in enterprise QA.
