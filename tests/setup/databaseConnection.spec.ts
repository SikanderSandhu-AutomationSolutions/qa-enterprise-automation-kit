import { test, expect } from '@playwright/test';
import { Database } from '../framework/utils/Database';

test.describe('Database Connectivity Validation', () => {
    let db: Database;

    test.beforeAll(async () => {
        // Initialize the DB object
        db = new Database();
        await db.connect();
    });

    test.afterAll(async () => {
        // Always clean up the connection after the suite runs
        await db.disconnect();
    });

    test('should execute a basic query to verify the connection is active', async () => {
        // A simple query to ask the MariaDB server for its version
        const result = await db.query('SELECT VERSION() as version');

        console.log('Database Result:', result);

        // Assert that we got a result back and it's a version string (e.g. 10.6)
        expect(result).toBeDefined();
        expect(result[0].version).toContain('10.6'); // We configured mariadb:10.6 in pwd.yml
    });

    test('should query the schema to see Frappe tables natively', async () => {
        // Query the schema to count all the Frappe 'tab' tables in the database
        // ERPNext names all its DocType tables starting with 'tab'
        const result = await db.query("SHOW TABLES LIKE 'tab%';");

        console.log('Found Frappe Tables:', result);

        // Assert that the database actually contains the ERPNext schema
        expect(result.length).toBeGreaterThan(0);
        // `SHOW TABLES` returns an array of objects where the key is dynamically named after the database.
        // We just grab the first value of the first object to check the table name.
        const firstTableName = Object.values(result[0])[0] as string;
        expect(firstTableName).toMatch(/^tab/);
    });
});
