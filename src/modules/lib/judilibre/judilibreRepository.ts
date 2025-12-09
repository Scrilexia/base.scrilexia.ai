import { getEnvValue } from "../../../utils/environment";
import type { Result, Rows } from "../../database/manager";
import { Schema } from "../../database/schema";
import { BaseRepository } from "../repositoryManager";
import type { TextZoneSegment } from "./judilibreTypes";

export type JudilibreDecision = {
	id: string;
	jurisdiction: string;
	location: string;
	chamber: string;
	number: string;
	decisionDate: string;
	type: string;
	text: string;
	motivations: TextZoneSegment[];
	solution: string;
	summary: string;
	themes: string[];
	visas: string[];
};

export type JudilibreDecisionCache = {
	id: string;
	decisionDate: string;
};

export class JudilibreRepository extends BaseRepository {
	protected override dbName: string;
	private jurisdiction: string;

	constructor(jurisdiction: string) {
		super();
		const dbName = getEnvValue("dbJudilibre");
		if (!dbName) {
			throw new Error(
				"LegiFrance database name is not defined in environment variables.",
			);
		}
		this.dbName = dbName;
		this.jurisdiction = jurisdiction;
	}

	async initializeDatabase(): Promise<void> {
		await this.initializeClient();
		this.connect();

		if (!(await this.client.tableExists(`jdl_decision_${this.jurisdiction}`))) {
			const schema = new Schema();
			schema.addColumn("id", "VARCHAR(60) PRIMARY KEY NOT NULL");
			schema.addColumn("jurisdiction", "TEXT NOT NULL");
			schema.addColumn("location", "TEXT NOT NULL");
			schema.addColumn("chamber", "TEXT NOT NULL");
			schema.addColumn("number", "TEXT NOT NULL");
			schema.addColumn("decision_date", "DATETIME");
			schema.addColumn("type", "TEXT NOT NULL");
			schema.addColumn("text", "LONGTEXT NOT NULL");
			schema.addColumn("motivations", "JSON NOT NULL");
			schema.addColumn("solution", "TEXT NOT NULL");
			schema.addColumn("summary", "TEXT NOT NULL");
			schema.addColumn("themes", "JSON NOT NULL");
			schema.addColumn("visas", "JSON NOT NULL");
			await this.client.createTable(
				`jdl_decision_${this.jurisdiction}`,
				schema,
			);
		}
	}

	// CRUD methods for code would go here
	// create
	async create(decision: JudilibreDecision): Promise<void> {
		this.connect();

		await this.client.query<Result>(
			`INSERT INTO jdl_decision_${this.jurisdiction} (id, jurisdiction, location, chamber, number, decision_date, type, text, motivations, solution, summary, themes, visas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				decision.id,
				decision.jurisdiction,
				decision.location,
				decision.chamber,
				decision.number,
				decision.decisionDate,
				decision.type,
				decision.text,
				JSON.stringify(decision.motivations),
				decision.solution,
				decision.summary,
				JSON.stringify(decision.themes),
				JSON.stringify(decision.visas),
			],
		);
	}

	// read
	async read(id: string): Promise<JudilibreDecision | null> {
		this.connect();

		const [rows] = await this.client.query<Rows>(
			`SELECT * FROM jdl_decision_${this.jurisdiction} WHERE id = ?`,
			[id],
		);
		if (rows.length === 0) {
			return null;
		}
		const row = rows[0];
		return {
			id: row.id,
			jurisdiction: row.jurisdiction,
			location: row.location,
			chamber: row.chamber,
			number: row.number,
			decisionDate: row.decision_date,
			type: row.type,
			text: row.text,
			motivations: JSON.parse(row.motivations),
			solution: row.solution,
			summary: row.summary,
			themes: JSON.parse(row.themes),
			visas: JSON.parse(row.visas),
		};
	}

	async readAll(offset: number, size: number): Promise<JudilibreDecision[]> {
		this.connect();

		const [rows] = await this.client.query<Rows>(
			`SELECT * FROM jdl_decision_${this.jurisdiction} LIMIT ? OFFSET ?`,
			[size, offset],
		);

		return rows.map((row) => ({
			id: row.id,
			jurisdiction: row.jurisdiction,
			location: row.location,
			chamber: row.chamber,
			number: row.number,
			decisionDate: row.decision_date,
			type: row.type,
			text: row.text,
			motivations: JSON.parse(row.motivations),
			solution: row.solution,
			summary: row.summary,
			themes: JSON.parse(row.themes),
			visas: JSON.parse(row.visas),
		}));
	}
	async readByKeywords(keywords: string[]): Promise<JudilibreDecision[]> {
		this.connect();

		// search decisions matching one or more keywords in themes
		const keywordsJson = JSON.stringify(keywords);

		const [rows] = await this.client.query<Rows>(
			`SELECT * FROM jdl_decision_${this.jurisdiction} WHERE JSON_OVERLAPS(themes, ?)`,
			[keywordsJson],
		);

		return rows.map((row) => ({
			id: row.id,
			jurisdiction: row.jurisdiction,
			location: row.location,
			chamber: row.chamber,
			number: row.number,
			decisionDate: row.decision_date,
			type: row.type,
			text: row.text,
			motivations: JSON.parse(row.motivations),
			solution: row.solution,
			summary: row.summary,
			themes: JSON.parse(row.themes),
			visas: JSON.parse(row.visas),
		}));
	}

	// update
	async update(decision: JudilibreDecision): Promise<void> {
		this.connect();

		await this.client.query(
			`UPDATE jdl_decision_${this.jurisdiction} 
             SET jurisdiction = ?, location = ?, chamber = ?, number = ?, decision_date = ?, type = ?, text = ?, motivations = ?, solution = ?, summary = ?, themes = ?, visas = ?
             WHERE id = ?`,
			[
				decision.jurisdiction,
				decision.location,
				decision.chamber,
				decision.number,
				decision.decisionDate,
				decision.type,
				decision.text,
				JSON.stringify(decision.motivations),
				decision.solution,
				decision.summary,
				decision.id,
				JSON.stringify(decision.themes),
				JSON.stringify(decision.visas),
			],
		);
	}

	// delete
	async delete(id: string): Promise<void> {
		this.connect();

		await this.client.query(
			`DELETE FROM jdl_decision_${this.jurisdiction} WHERE id = ?`,
			[id],
		);
	}

	// delete Table
	async deleteTable(): Promise<void> {
		this.connect();
		await this.client.deleteTable(`jdl_decision_${this.jurisdiction}`);
	}
}

export class JudilibreCacheRepository extends BaseRepository {
	protected override dbName: string;
	private jurisdiction: string;

	constructor(jurisdiction: string) {
		super();
		const dbName = getEnvValue("dbJudilibre");
		if (!dbName) {
			throw new Error(
				"LegiFrance database name is not defined in environment variables.",
			);
		}
		this.dbName = dbName;
		this.jurisdiction = jurisdiction;
	}

	async initializeDatabase(): Promise<void> {
		await this.initializeClient();
		this.connect();

		if (
			!(await this.client.tableExists(
				`jdl_decision_cache_${this.jurisdiction}`,
			))
		) {
			const schema = new Schema();
			schema.addColumn("id", "VARCHAR(60) PRIMARY KEY NOT NULL");
			schema.addColumn("decision_date", "DATETIME");
			await this.client.createTable(
				`jdl_decision_cache_${this.jurisdiction}`,
				schema,
			);
		}
	}

	// CRUD methods for code would go here
	// create
	async create(cache: JudilibreDecisionCache): Promise<void> {
		this.connect();

		await this.client.query<Result>(
			`INSERT INTO jdl_decision_cache_${this.jurisdiction} (id, decision_date)
			 VALUES (?, ?)`,
			[cache.id, cache.decisionDate],
		);
	}

	// read
	async read(id: string): Promise<JudilibreDecisionCache | null> {
		this.connect();

		const [rows] = await this.client.query<Rows>(
			`SELECT * FROM jdl_decision_cache_${this.jurisdiction} WHERE id = ?`,
			[id],
		);
		if (rows.length === 0) {
			return null;
		}
		const row = rows[0];
		return {
			id: row.id,
			decisionDate: row.decision_date,
		};
	}

	// read all
	async readAll(
		offset: number,
		size: number,
	): Promise<JudilibreDecisionCache[]> {
		this.connect();

		const [rows] = await this.client.query<Rows>(
			`SELECT * FROM jdl_decision_cache_${this.jurisdiction} LIMIT ? OFFSET ?`,
			[size, offset],
		);

		return rows.map((row) => ({
			id: row.id,
			decisionDate: row.decision_date,
		}));
	}

	// count
	async count(): Promise<number> {
		this.connect();

		const [rows] = await this.client.query<Rows>(
			`SELECT COUNT(*) as count FROM jdl_decision_cache_${this.jurisdiction}`,
		);

		return rows[0].count;
	}

	//update
	async update(cache: JudilibreDecisionCache): Promise<void> {
		this.connect();

		await this.client.query(
			`UPDATE jdl_decision_cache_${this.jurisdiction} 
			 SET decision_date = ?	
			 WHERE id = ?`,
			[cache.decisionDate, cache.id],
		);
	}

	// delete
	async delete(id: string): Promise<void> {
		this.connect();
		await this.client.query(
			`DELETE FROM jdl_decision_cache_${this.jurisdiction} WHERE id = ?`,
			[id],
		);
	}

	// delete Table
	async deleteTable(): Promise<void> {
		this.connect();
		await this.client.deleteTable(`jdl_decision_cache_${this.jurisdiction}`);
	}
}
