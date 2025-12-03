import { getEnvValue } from "../../../utils/environment";
import type { Result, Rows } from "../../database/manager";
import { Schema } from "../../database/schema";
import { BaseRepository } from "../repositoryManager";

export type JudilibreDecision = {
	id: string;
	jurisdiction: string;
	location: string;
	chamber: string;
	number: string;
	decisionDate: string;
	type: string;
	solution: string;
	summary: string;
	themes: string[];
	visas: string[];
};

class JudilibreRepository extends BaseRepository {
	protected override dbName: string;

	constructor() {
		super();
		const dbName = getEnvValue("dbJudilibre");
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

		if (!(await this.client.tableExists("jl_decision"))) {
			const schema = new Schema();
			schema.addColumn("id", "VARCHAR(60) PRIMARY KEY NOT NULL");
			schema.addColumn("jurisdiction", "TEXT NOT NULL");
			schema.addColumn("location", "TEXT NOT NULL");
			schema.addColumn("chamber", "TEXT NOT NULL");
			schema.addColumn("number", "TEXT NOT NULL");
			schema.addColumn("decision_date", "DATETIME");
			schema.addColumn("type", "TEXT NOT NULL");
			schema.addColumn("solution", "TEXT NOT NULL");
			schema.addColumn("summary", "TEXT NOT NULL");
			schema.addColumn("themes", "JSON NOT NULL");
			schema.addColumn("visas", "JSON NOT NULL");
			await this.client.createTable("jl_decision", schema);
		}
	}

	// CRUD methods for code would go here
	// create
	async create(decision: JudilibreDecision): Promise<void> {
		this.connect();

		await this.client.query<Result>(
			`INSERT INTO jl_decision (id, jurisdiction, location, chamber, number, decision_date, type, solution, summary, themes, visas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				decision.id,
				decision.jurisdiction,
				decision.location,
				decision.chamber,
				decision.number,
				decision.decisionDate,
				decision.type,
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
			"SELECT * FROM jl_decision WHERE id = ?",
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
			solution: row.solution,
			summary: row.summary,
			themes: JSON.parse(row.themes),
			visas: JSON.parse(row.visas),
		};
	}

	async readByKeywords(keywords: string[]): Promise<JudilibreDecision[]> {
		this.connect();

		// search decisions matching one or more keywords in themes
		const keywordsJson = JSON.stringify(keywords);

		const [rows] = await this.client.query<Rows>(
			"SELECT * FROM jl_decision WHERE JSON_OVERLAPS(themes, ?)",
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
			`UPDATE jl_decision 
             SET jurisdiction = ?, location = ?, chamber = ?, number = ?, decision_date = ?, type = ?, solution = ?, summary = ?, themes = ?, visas = ?
             WHERE id = ?`,
			[
				decision.jurisdiction,
				decision.location,
				decision.chamber,
				decision.number,
				decision.decisionDate,
				decision.type,
				decision.solution,
				decision.summary,
				JSON.stringify(decision.themes),
				JSON.stringify(decision.visas),
				decision.id,
			],
		);
	}

	// delete
	async delete(id: string): Promise<void> {
		this.connect();

		await this.client.query("DELETE FROM jl_decision WHERE id = ?", [id]);
	}

	// delete Table
	async deleteTable(): Promise<void> {
		this.connect();
		await this.client.deleteTable("jl_decision");
	}
}

export const judilibreRepository = new JudilibreRepository();
