import { getEnvValue } from "../../utils/environment";
import type { Result, Rows } from "../database/manager";
import { Schema } from "../database/schema";
import { BaseRepository } from "./repositoryManager";

export type LegiFranceCode = {
	id: string;
	title: string;
	titleFull: string;
	state: string;
	startDate: Date | null;
	endDate: Date | null;
};

export type LegiFranceCodeArticle = {
	id: string;
	codeId: string;
	number: string;
	text: string;
	state: string;
	startDate: Date | null;
	endDate: Date | null;
};

class LegiFranceCodeRepository extends BaseRepository {
	protected override dbName: string;

	constructor() {
		super();
		const dbName = getEnvValue("dbLegiFrance");
		if (!dbName) {
			throw new Error(
				"LegiFrance database name is not defined in environment variables.",
			);
		}
		this.dbName = dbName;
	}

	async initializeDatabase(): Promise<void> {
		await this.initializeClient();
		this.connect();

		if (!(await this.client.tableExists("lf_code"))) {
			const schema = new Schema();
			schema.addColumn("id", "VARCHAR(60) PRIMARY KEY NOT NULL");
			schema.addColumn("title", "TEXT NOT NULL");
			schema.addColumn("title_full", "TEXT NOT NULL");
			schema.addColumn("state", "VARCHAR(30) NOT NULL");
			schema.addColumn("start_date", "DATETIME");
			schema.addColumn("end_date", "DATETIME");
			await this.client.createTable("lf_code", schema);
		}
	}

	// CRUD methods for code would go here
	// create
	async create(code: LegiFranceCode): Promise<void> {
		this.connect();

		await this.client.query<Result>(
			"INSERT INTO lf_code (id, title, title_full, state, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
			[
				code.id,
				code.title,
				code.titleFull,
				code.state,
				code.startDate,
				code.endDate,
			],
		);
	}

	// read
	async read(id: string): Promise<LegiFranceCode | null> {
		this.connect();

		const [rows] = await this.client.query<Rows>(
			"SELECT * FROM lf_code WHERE id = ?",
			[id],
		);

		if (rows.length === 0) {
			return null;
		}

		const row = rows[0];
		return {
			id: row.id,
			title: row.title,
			titleFull: row.title_full,
			state: row.state,
			startDate: row.start_date,
			endDate: row.end_date,
		};
	}

	async readAll(): Promise<LegiFranceCode[]> {
		this.connect();

		const [rows] = await this.client.query<Rows>("SELECT * FROM lf_code");
		return rows.map((row) => ({
			id: row.id,
			title: row.title,
			state: row.state,
			titleFull: row.title_full,
			startDate: row.start_date,
			endDate: row.end_date,
		}));
	}

	// update
	async update(code: LegiFranceCode): Promise<void> {
		this.connect();

		await this.client.query(
			"UPDATE lf_code SET title = ?, state = ?, start_date = ?, end_date = ? WHERE id = ?",
			[code.title, code.state, code.startDate, code.endDate, code.id],
		);
	}

	// delete
	async delete(id: string): Promise<void> {
		this.connect();

		await this.client.query("DELETE FROM lf_code WHERE id = ?", [id]);
	}

	async deleteTable(): Promise<void> {
		this.connect();
		await this.client.deleteTable("lf_code");
	}
}

export class LegiFranceCodeArticleRepository extends BaseRepository {
	protected override dbName: string;

	constructor() {
		super();
		const dbName = getEnvValue("dbLegiFrance");
		if (!dbName) {
			throw new Error(
				"LegiFrance database name is not defined in environment variables.",
			);
		}
		this.dbName = dbName;
	}

	async initializeDatabase(): Promise<void> {
		await this.initializeClient();
		this.connect();

		if (!(await this.client.tableExists("lf_code_article"))) {
			const schema = new Schema();
			schema.addColumn("id", "VARCHAR(60) PRIMARY KEY NOT NULL");
			schema.addColumn("code_id", "VARCHAR(60) NOT NULL");
			schema.addColumn("number", "VARCHAR(30) NOT NULL");
			schema.addColumn("text", "LONGTEXT NOT NULL");
			schema.addColumn("state", "VARCHAR(30) NOT NULL");
			schema.addColumn("start_date", "DATETIME");
			schema.addColumn("end_date", "DATETIME");
			schema.addForeignKeyConstraint("code_id", "lf_code", "id", "DELETE");
			await this.client.createTable("lf_code_article", schema);
		}
	}

	// CRUD methods for code articles would go here
	// create
	async create(article: LegiFranceCodeArticle): Promise<void> {
		this.connect();

		await this.client.query<Result>(
			"INSERT INTO lf_code_article (id, code_id, number, text, state, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
			[
				article.id,
				article.codeId,
				article.number,
				article.text,
				article.state,
				article.startDate,
				article.endDate,
			],
		);
	}

	// read
	async read(id: string): Promise<LegiFranceCodeArticle | null> {
		this.connect();
		const [rows] = await this.client.query<Rows>(
			"SELECT * FROM lf_code_article WHERE id = ?",
			[id],
		);
		if (rows.length === 0) {
			return null;
		}
		const row = rows[0];
		return {
			id: row.id,
			codeId: row.code_id,
			number: row.number,
			text: row.text,
			state: row.state,
			startDate: row.start_date,
			endDate: row.end_date,
		};
	}

	async readByCodeId(
		id: string,
		codeId: string,
	): Promise<LegiFranceCodeArticle | null> {
		this.connect();
		const [rows] = await this.client.query<Rows>(
			"SELECT * FROM lf_code_article WHERE id = ? AND code_id = ?",
			[id, codeId],
		);

		if (rows.length === 0) {
			return null;
		}
		const row = rows[0];
		return {
			id: row.id,
			codeId: row.code_id,
			number: row.number,
			text: row.text,
			state: row.state,
			startDate: row.start_date,
			endDate: row.end_date,
		};
	}

	async readByArticleNumberAndCodeTitle(
		articleNumber: string,
		codeTitle: string,
	): Promise<LegiFranceCodeArticle | null> {
		this.connect();
		const [rows] = await this.client.query<Rows>(
			`SELECT ar.* FROM lf_code_article ar
             INNER JOIN lf_code co ON ar.code_id = co.id
             WHERE ar.number = ? AND co.title = ?`,
			[articleNumber, codeTitle],
		);

		if (rows.length === 0) {
			return null;
		}
		const row = rows[0];
		return {
			id: row.id,
			codeId: row.code_id,
			number: row.number,
			text: row.text,
			state: row.state,
			startDate: row.start_date,
			endDate: row.end_date,
		};
	}

	// update
	async update(article: LegiFranceCodeArticle): Promise<void> {
		this.connect();

		await this.client.query<Result>(
			"UPDATE lf_code_article SET code_id = ?, number = ?, text = ?, state = ?, start_date = ?, end_date = ? WHERE id = ?",
			[
				article.codeId,
				article.number,
				article.text,
				article.state,
				article.startDate,
				article.endDate,
				article.id,
			],
		);
	}

	// delete
	async delete(id: string): Promise<void> {
		this.connect();
		await this.client.query<Result>(
			"DELETE FROM lf_code_article WHERE id = ?",
			[id],
		);
	}

	async deleteTable(): Promise<void> {
		this.connect();
		await this.client.deleteTable("lf_code_article");
	}
}

export const legiFranceCodeRepository = new LegiFranceCodeRepository();
export const legiFranceCodeArticleRepository =
	new LegiFranceCodeArticleRepository();
