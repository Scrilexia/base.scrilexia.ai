import { getEnvValue } from "../../utils/environment.js";
import {
	type IDatabase,
	openConnection,
	openDatabase,
} from "../database/manager.js";

export class BaseRepository {
	protected client: IDatabase;
	protected host: string;
	protected port: number;
	protected user: string;
	protected password: string;
	protected dbName: string;

	constructor() {
		this.client = undefined as unknown as IDatabase;
		const host = getEnvValue("dbLfHost");
		if (!host) {
			throw new Error("Database host is not defined in environment variables.");
		}
		this.host = host;
		const portString = getEnvValue("dbLfPort");
		if (!portString) {
			throw new Error("Database port is not defined in environment variables.");
		}
		this.port = Number.parseInt(portString, 10);
		const user = getEnvValue("dbLfUser");
		if (!user) {
			throw new Error("Database user is not defined in environment variables.");
		}
		this.user = user;
		const password = getEnvValue("dbLfPassword");
		if (!password) {
			throw new Error(
				"Database password is not defined in environment variables.",
			);
		}
		this.password = password;
		this.dbName = "";
	}

	async initializeClient(): Promise<void> {
		const userRoot = getEnvValue("dbUserRoot");
		if (!userRoot) {
			throw new Error(
				"Database root user is not defined in environment variables.",
			);
		}
		const passwordRoot = getEnvValue("dbLfPasswordRoot");
		if (!passwordRoot) {
			throw new Error(
				"Database password for root user is not defined in environment variables.",
			);
		}

		const connection = await openConnection(
			this.host,
			this.port,
			userRoot,
			passwordRoot,
		);
		if (!(await connection.userExists(this.user))) {
			await connection.createUser(this.user, this.password);
			await connection.grantAllPrivileges(this.user);
		}

		if (!(await connection.databaseExists(this.dbName))) {
			await connection.createDatabase(this.dbName);
		}
		await connection.close();
	}

	protected connect() {
		if (this.client) {
			return;
		}

		this.client = openDatabase(
			this.host,
			this.port,
			this.user,
			this.password,
			this.dbName,
		);
	}

	async disconnect(): Promise<void> {
		if (this.client) {
			await this.client.close();
			this.client = undefined as unknown as IDatabase;
		}
	}
}
