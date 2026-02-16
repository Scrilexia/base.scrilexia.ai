import mysql, { type QueryResult } from "mysql2/promise";
import type { Schema } from "./schema.js";

export type DbClient = mysql.Pool;
export type DbConnection = mysql.Connection;

export type Result = mysql.ResultSetHeader;
export type Rows = mysql.RowDataPacket[];

export interface IDatabaseQuery {
	query<T extends QueryResult>(
		sql: string,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		params?: any,
	): Promise<[T, mysql.FieldPacket[]]>;

	close(): Promise<void>;
}

export interface IDatabaseConnection extends IDatabaseQuery {
	databaseExists(database: string): Promise<boolean>;
	createDatabase(database: string): Promise<void>;
	deleteDatabase(database: string): Promise<void>;
	useDatabase(database: string): Promise<void>;
	userExists(userName: string): Promise<boolean>;
	createUser(userName: string, password: string): Promise<void>;
	grantAllPrivileges(userName: string): Promise<void>;
	deleteUser(userName: string): Promise<void>;
}

export interface IDatabase extends IDatabaseQuery {
	tableExists(name: string): Promise<boolean>;
	createTable(name: string, schema: Schema): Promise<void>;
	deleteTable(name: string): Promise<void>;
}

class DatabaseQuery implements IDatabaseQuery {
	protected client: DbClient | DbConnection | undefined;
	constructor(client: DbClient | DbConnection | undefined) {
		this.client = client;
	}

	async query<T extends QueryResult>(
		sql: string,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		params?: any,
	): Promise<[T, mysql.FieldPacket[]]> {
		if (!this.client) {
			throw new Error("Database client is not established.");
		}

		return await this.client.query<T>(sql, params);
	}

	async close(): Promise<void> {
		if (this.client) {
			console.debug("Closing database client connection.");
			await this.client.end();
			this.client = undefined;
			console.debug(`Client: ${this.client}`);
		}
	}

	protected sanitizeIdentifier(name: string): string {
		if (!/^[a-zA-Z0-9_]+$/.test(name)) {
			throw new Error("Nom de base invalide");
		}
		return `\`${name}\``; // backticks pour éviter les conflits
	}
}

class DatabaseClient extends DatabaseQuery implements IDatabase {
	private connectDatabase: () => DbClient;
	constructor(connectDatabase: () => DbClient) {
		super(connectDatabase());
		this.connectDatabase = connectDatabase;
	}

	async tableExists(name: string): Promise<boolean> {
		console.debug(`Checking if table exists: ${name}`);
		console.debug(`Client: ${this.client}`);

		let rows: Rows = [];
		let tries = 0;
		const maxRetries = 3;
		while (tries < maxRetries) {
			try {
				if (!this.client) {
					this.client = this.connectDatabase();
				}

				[rows] = await this.client.query<Rows>(
					"SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?",
					[name],
				);
			} catch (error) {
				console.error("Error in checking table existence:", error);
				tries++;
				console.debug(`Retrying... (${tries}/${maxRetries})`);
				this.client = this.connectDatabase();
			}
		}
		return rows.length > 0;
	}

	async createTable(name: string, schema: Schema): Promise<void> {
		let tries = 0;
		const maxRetries = 3;
		while (tries < maxRetries) {
			try {
				if (!this.client) {
					this.client = this.connectDatabase();
				}

				await this.deleteTable(name);

				const tableName = this.sanitizeIdentifier(name);
				const query = `CREATE TABLE ${tableName} (${schema.toString()}) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`;
				await this.client.query<Result>(query);
				break;
			} catch (error) {
				console.error("Error in creating table:", error);
				tries++;
				console.debug(`Retrying... (${tries}/${maxRetries})`);
				this.client = this.connectDatabase();
			}
		}
	}

	async deleteTable(name: string): Promise<void> {
		if (!(await this.tableExists(name))) {
			return;
		}

		let tries = 0;
		const maxRetries = 3;
		while (tries < maxRetries) {
			try {
				if (!this.client) {
					this.client = this.connectDatabase();
				}
				const tableName = this.sanitizeIdentifier(name);
				await this.client.query(`DROP TABLE IF EXISTS ${tableName}`);
			} catch (error) {
				console.error("Error in deleting table:", error);
				tries++;
				console.debug(`Retrying... (${tries}/${maxRetries})`);
				this.client = this.connectDatabase();
			}
		}
	}
}

class DatabaseConnection extends DatabaseQuery implements IDatabaseConnection {
	async databaseExists(database: string): Promise<boolean> {
		if (!this.client) {
			throw new Error("Database connection is not established.");
		}

		const dbName = this.sanitizeIdentifier(database);
		const [rows] = await this.client.query<Rows>(
			"SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
			[database],
		);
		return rows.length > 0;
	}

	async createDatabase(database: string): Promise<void> {
		if (!this.client) {
			throw new Error("Database connection is not established.");
		}

		await this.deleteDatabase(database);

		const dbName = this.sanitizeIdentifier(database);
		await this.client.query<Result>(
			`CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
		);
	}

	async deleteDatabase(database: string): Promise<void> {
		if (!this.client) {
			throw new Error("Database connection is not established.");
		}

		const dbName = this.sanitizeIdentifier(database);
		await this.client.query(`DROP DATABASE IF EXISTS ${dbName}`);
	}

	async useDatabase(database: string): Promise<void> {
		if (!this.client) {
			throw new Error("Database connection is not established.");
		}
		const dbName = this.sanitizeIdentifier(database);
		await this.client.query<Result>(`USE ${dbName}`);
	}

	async userExists(userName: string): Promise<boolean> {
		if (!this.client) {
			throw new Error("Database connection is not established.");
		}

		const [rows] = await this.client.query<Rows>(
			"SELECT User FROM mysql.user WHERE User = ?",
			[userName],
		);

		return rows.length > 0;
	}

	async createUser(userName: string, password: string): Promise<void> {
		if (!this.client) {
			throw new Error("Database connection is not established.");
		}

		await this.client.query<Result>(
			"CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?",
			[userName, password],
		);
	}

	async grantAllPrivileges(userName: string): Promise<void> {
		if (!this.client) {
			throw new Error("Database connection is not established.");
		}

		await this.client.query<Result>("GRANT ALL PRIVILEGES ON *.* TO ?@'%'", [
			userName,
		]);

		await this.client.query<Result>("FLUSH PRIVILEGES");
	}

	async deleteUser(userName: string): Promise<void> {
		if (!this.client) {
			throw new Error("Database connection is not established.");
		}
		await this.client.query<Result>("DROP USER IF EXISTS ?@'%'", [userName]);
	}
}

export function openDatabase(
	host: string,
	port: number,
	user: string,
	password: string,
	database: string,
): IDatabase {
	return new DatabaseClient(() =>
		mysql.createPool({
			host,
			port,
			user,
			password,
			database,
		}),
	);
}

export async function openConnection(
	host: string,
	port: number,
	user: string,
	password: string,
): Promise<IDatabaseConnection> {
	const connection = await mysql.createConnection({
		host,
		port,
		user,
		password,
	});

	return new DatabaseConnection(connection);
}

/*
 Optional compatibility object to preserve the previous usage pattern
 (DatabaseManager.openDatabase / DatabaseManager.openConnection).
*/
export const DatabaseManager = {
	openDatabase,
	openConnection,
};
