import mysql from 'mysql2/promise';
import { logger } from '../utils/Logger';

export class Database {
    private connection: mysql.Connection | null = null;
    private config: mysql.ConnectionOptions;

    /**
     * Initialize the Database helper with connection parameters.
     * Defaults to the ERPNext Demo docker-compose settings.
     */
    constructor(config?: mysql.ConnectionOptions) {
        this.config = config || {
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'admin',
            // In a fresh ERPNext install, the DB name is random (site config). 
            // If empty, we can connect to the server and execute 'USE site1.local' or similar later.
            database: process.env.DB_NAME || undefined,
            waitForConnections: true,
            connectionLimit: 10,
        };
    }

    /**
     * Establish the connection to the database.
     */
    async connect(): Promise<void> {
        try {
            this.connection = await mysql.createConnection(this.config);
            logger.info(`Successfully connected to database at ${this.config.host}:${this.config.port}`);

            // If a specific database wasn't provided, try to find the Frappe generated one
            if (!this.config.database) {
                const [databases]: any = await this.connection.execute("SHOW DATABASES;");
                // Frappe DBs usually look like 16-character hex strings in single-bench setups
                const frappeDb = databases.find((d: any) => d.Database.match(/^[a-f0-9_]{16,}$/));
                if (frappeDb) {
                    logger.info(`Auto-resolved Frappe database name: ${frappeDb.Database}`);
                    await this.connection.execute(`USE \`${frappeDb.Database}\``);
                } else {
                    logger.warn("Could not auto-resolve a Frappe database name. Queries may fail if they rely on a specific schema.");
                }
            }

        } catch (error) {
            logger.error(`Failed to connect to database: ${error}`);
            throw error;
        }
    }

    /**
     * Execute a raw SQL query.
     * @param sql The SQL statement
     * @param values Optional array of values to parameterize
     * @returns The resulting rows (or ResultSetHeader for inserts/updates)
     */
    async query(sql: string, values?: any[]): Promise<any> {
        if (!this.connection) {
            await this.connect();
        }
        try {
            logger.info(`Executing SQL: ${sql}`);
            const [rows] = await this.connection!.execute(sql, values);
            return rows;
        } catch (error) {
            logger.error(`SQL Execution Error: ${error}`);
            throw error;
        }
    }

    /**
     * Close the database connection. Critical to run in afterAll() blocks
     * so Playwright doesn't hang waiting for connections to clear.
     */
    async disconnect(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
            logger.info('Database connection closed.');
        }
    }
}
