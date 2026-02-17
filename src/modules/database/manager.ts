import mysql, { type QueryResult } from "mysql2/promise";
import type { Schema } from "./schema.js";
import { S } from "ollama/dist/shared/ollama.1bfa89da.mjs";

export type DbClient = mysql.Pool;
export type DbConnection = mysql.Connection;

export type Result = mysql.ResultSetHeader;
export type Rows = mysql.RowDataPacket[];

export interface IDatabaseQuery {
	close(): Promise<void>;
}

type SyncOrAsync<T> = T | Promise<T>;
type SyncOrAsyncFunction<T> = () => SyncOrAsync<T>;

export interface IDatabaseConnection extends IDatabaseQuery {
	query<T extends QueryResult>(
		sql: string,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		params?: any,
	): Promise<[T, mysql.FieldPacket[]]>;
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
	query<T extends QueryResult>(
		sql: string,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		params?: any,
	): Promise<[T, mysql.FieldPacket[]]>;
	tableExists(name: string): Promise<boolean>;
	createTable(name: string, schema: Schema): Promise<void>;
	deleteTable(name: string): Promise<void>;
}

class DatabaseQuery implements IDatabaseQuery {
	protected client: DbClient | DbConnection | undefined;
	protected host: string;
	protected port: number;
	protected user: string;
	protected password: string;
	protected database?: string;

	constructor(
		host: string,
		port: number,
		user: string,
		password: string,
		database?: string,
	) {
		this.host = host;
		this.port = port;
		this.user = user;
		this.password = password;
		this.database = database;
		this.client = undefined;
	}

	protected async initializeClient(): Promise<DbClient | DbConnection> {
		throw new Error("Method not implemented.");
	}

	protected async trySeveralTimes<T>(
		functionSyncOrAsync: SyncOrAsyncFunction<T>,
		catchError: () => Promise<void>,
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
				await catchError();
			}
		}
		throw new Error("Maximum retry attempts reached.");
	}

	async close(): Promise<void> {
		if (this.client) {
			try {
				await this.client.end();
			} catch (error) {
				console.error("Error closing database connection:", error);
			}
		}
		this.client = undefined;
	}

	protected sanitizeIdentifier(name: string): string {
		if (!/^[a-zA-Z0-9_]+$/.test(name)) {
			throw new Error("Nom de base invalide");
		}
		return `\`${name}\``; // backticks pour éviter les conflits
	}
}

class DatabaseClient extends DatabaseQuery implements IDatabase {
	constructor(
		host: string,
		port: number,
		user: string,
		password: string,
		database: string,
	) {
		super(host, port, user, password, database);
		this.client = mysql.createPool({
			host: this.host,
			port: this.port,
			user: this.user,
			password: this.password,
			database: this.database,
		});
	}

	protected override async initializeClient(): Promise<
		DbClient | DbConnection
	> {
		console.log("Initializing database client...");
		return mysql.createPool({
			host: this.host,
			port: this.port,
			user: this.user,
			password: this.password,
			database: this.database,
		});
	}

	async query<T extends QueryResult>(
		sql: string,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		params?: any,
	): Promise<[T, mysql.FieldPacket[]]> {
		return await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				return await this.client.query<T>(sql, params);
			},
			async () => {
				if (this.client) {
					try {
						const connection = await (this.client as DbClient).getConnection();
						connection.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}

	async tableExists(name: string): Promise<boolean> {
		const rows = await this.trySeveralTimes<Rows>(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				const [rowsToReturn] = await this.client.query<Rows>(
					"SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?",
					[name],
				);
				return rowsToReturn;
			},
			async () => {
				if (this.client) {
					try {
						const connection = await (this.client as DbClient).getConnection();
						connection.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);

		if (rows.length === 0) {
			console.warn(`Table ${name} does not exist.`);
		}

		return rows.length > 0;
	}

	async createTable(name: string, schema: Schema): Promise<void> {
		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.deleteTable(name);
			},
			async () => {
				if (this.client) {
					try {
						const connection = await (this.client as DbClient).getConnection();
						connection.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);

		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				const query =
					"CREATE TABLE ? (?) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci";
				await this.client.query<Result>(query, [name, schema.toString()]);
			},
			async () => {
				if (this.client) {
					try {
						const connection = await (this.client as DbClient).getConnection();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}

	async deleteTable(name: string): Promise<void> {
		if (!(await this.tableExists(name))) {
			return;
		}

		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.client.query("DROP TABLE IF EXISTS ?", [name]);
			},
			async () => {
				if (this.client) {
					try {
						const connection = await (this.client as DbClient).getConnection();
						connection.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}
}

class DatabaseConnection extends DatabaseQuery implements IDatabaseConnection {
	protected override async initializeClient(): Promise<
		DbClient | DbConnection
	> {
		console.log("Initializing database connection...");
		return await mysql.createConnection({
			host: this.host,
			port: this.port,
			user: this.user,
			password: this.password,
		});
	}

	async query<T extends QueryResult>(
		sql: string,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		params?: any,
	): Promise<[T, mysql.FieldPacket[]]> {
		return await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				return await this.client.query<T>(sql, params);
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}

	async databaseExists(database: string): Promise<boolean> {
		const rows = await this.trySeveralTimes<Rows>(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				const [rowsToReturn] = await this.client.query<Rows>(
					"SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
					[database],
				);
				return rowsToReturn;
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);

		if (rows.length === 0) {
			console.warn(`Database ${database} does not exist.`);
		}

		return rows.length > 0;
	}

	async createDatabase(database: string): Promise<void> {
		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.client.query<Result>(
					"CREATE DATABASE ? CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci",
					[database],
				);
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}

	async deleteDatabase(database: string): Promise<void> {
		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.client.query("DROP DATABASE IF EXISTS ?", [database]);
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}

	async useDatabase(database: string): Promise<void> {
		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.client.query("USE ?", [database]);
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}

	async userExists(userName: string): Promise<boolean> {
		const rows = await this.trySeveralTimes<Rows>(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				const [rowsToReturn] = await this.client.query<Rows>(
					"SELECT User FROM mysql.user WHERE User = ?",
					[userName],
				);

				return rowsToReturn;
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);

		if (rows.length === 0) {
			console.warn(`User ${userName} does not exist.`);
		}

		return rows.length > 0;
	}

	async createUser(userName: string, password: string): Promise<void> {
		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.client.query<Result>(
					"CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?",
					[userName, password],
				);
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}

	async grantAllPrivileges(userName: string): Promise<void> {
		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.client.query<Result>(
					"GRANT ALL PRIVILEGES ON *.* TO ?@'%'",
					[userName],
				);
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);

		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.client.query("FLUSH PRIVILEGES");
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}

	async deleteUser(userName: string): Promise<void> {
		await this.trySeveralTimes(
			async () => {
				if (!this.client) {
					this.client = await this.initializeClient();
				}

				await this.client.query<Result>("DROP USER IF EXISTS ?@'%'", [
					userName,
				]);
			},
			async () => {
				if (this.client) {
					try {
						this.client.destroy();
					} catch (error) {
						console.error("Error closing database connection:", error);
					}
				}

				this.client = await this.initializeClient();
			},
		);
	}
}

export function openDatabase(
	host: string,
	port: number,
	user: string,
	password: string,
	database: string,
): IDatabase {
	return new DatabaseClient(host, port, user, password, database);
}

export async function openConnection(
	host: string,
	port: number,
	user: string,
	password: string,
): Promise<IDatabaseConnection> {
	return new DatabaseConnection(host, port, user, password);
}

export const DatabaseManager = {
	openDatabase,
	openConnection,
};
