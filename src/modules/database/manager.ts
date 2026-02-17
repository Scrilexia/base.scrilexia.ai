import mysql, { type QueryResult } from "mysql2/promise";
import type { Schema } from "./schema.js";
import { S } from "ollama/dist/shared/ollama.1bfa89da.mjs";

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

type SyncOrAsync<T> = T | Promise<T>;
type SyncOrAsyncFunction<T> = () => SyncOrAsync<T>;

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
	protected databaseConnection: SyncOrAsyncFunction<
		DbClient | DbConnection | undefined
	>;

	constructor(
		databaseConnection: SyncOrAsyncFunction<
			DbClient | DbConnection | undefined
		>,
	) {
		this.databaseConnection = databaseConnection;
	}

	protected async trySeveralTimes<T>(
		functionSyncOrAsync: SyncOrAsyncFunction<T>,
		maxRetries = 3,
	): Promise<T> {
		let tries = 0;
		while (tries < maxRetries) {
			try {
				return await functionSyncOrAsync();
			} catch (error) {
				console.error("Database error:", error);
				tries++;
				console.debug(`Retrying... (${tries}/${maxRetries})`);
				await this.initializeClient();
			}
		}
		throw new Error("Maximum retry attempts reached.");
	}

	protected async initializeClient(): Promise<void> {
		this.client = await this.databaseConnection();
	}

	async query<T extends QueryResult>(
		sql: string,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		params?: any,
	): Promise<[T, mysql.FieldPacket[]]> {
		return await this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			return await this.client.query<T>(sql, params);
		});
	}

	async close(): Promise<void> {
		if (this.client) {
			await this.client.end();
			this.client = undefined;
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
	async tableExists(name: string): Promise<boolean> {
		let rows: Rows = [];

		[rows] = await this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			return await this.client.query<Rows>(
				"SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?",
				[name],
			);
		});

		if (rows.length === 0) {
			console.warn(`Table ${name} does not exist.`);
		}

		return rows.length > 0;
	}

	async createTable(name: string, schema: Schema): Promise<void> {
		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			await this.deleteTable(name);

			const query =
				"CREATE TABLE ? (?) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci";
			await this.client.query<Result>(query, [name, schema.toString()]);
		});
	}

	async deleteTable(name: string): Promise<void> {
		if (!(await this.tableExists(name))) {
			return;
		}

		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			await this.client.query("DROP TABLE IF EXISTS ?", [name]);
		});
	}
}

class DatabaseConnection extends DatabaseQuery implements IDatabaseConnection {
	async databaseExists(database: string): Promise<boolean> {
		let rows: Rows = [];

		[rows] = await this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			return await this.client.query<Rows>(
				"SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
				[database],
			);
		});

		if (rows.length === 0) {
			console.warn(`Database ${database} does not exist.`);
		}

		return rows.length > 0;
	}

	async createDatabase(database: string): Promise<void> {
		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			await this.client.query<Result>(
				"CREATE DATABASE ? CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci",
				[database],
			);
		});
	}

	async deleteDatabase(database: string): Promise<void> {
		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			await this.client.query("DROP DATABASE IF EXISTS ?", [database]);
		});
	}

	async useDatabase(database: string): Promise<void> {
		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			const dbName = this.sanitizeIdentifier(database);
			await this.client.query("USE ?", [database]);
		});
	}

	async userExists(userName: string): Promise<boolean> {
		let rows: Rows = [];
		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			[rows] = await this.client.query<Rows>(
				"SELECT User FROM mysql.user WHERE User = ?",
				[userName],
			);
		});

		if (rows.length === 0) {
			console.warn(`User ${userName} does not exist.`);
		}

		return rows.length > 0;
	}

	async createUser(userName: string, password: string): Promise<void> {
		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			await this.client.query<Result>(
				"CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?",
				[userName, password],
			);
		});
	}

	async grantAllPrivileges(userName: string): Promise<void> {
		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			await this.client.query<Result>("GRANT ALL PRIVILEGES ON *.* TO ?@'%'", [
				userName,
			]);

			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			await this.client.query<Result>("FLUSH PRIVILEGES");
		});
	}

	async deleteUser(userName: string): Promise<void> {
		this.trySeveralTimes(async () => {
			if (!this.client) {
				await this.initializeClient();
			}

			if (!this.client) {
				throw new Error("Database client is not initialized.");
			}

			await this.client.query<Result>("DROP USER IF EXISTS ?@'%'", [userName]);
		});
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
	return new DatabaseConnection(
		async () =>
			await mysql.createConnection({
				host,
				port,
				user,
				password,
			}),
	);
}

export const DatabaseManager = {
	openDatabase,
	openConnection,
};
