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
			schema.addColumn("text", "LONGTEXT NOT NULL");
			schema.addColumn("motivations", "JSON NOT NULL");
			schema.addColumn("solution", "TEXT NOT NULL");
			schema.addColumn("summary", "TEXT NOT NULL");
			await this.client.createTable("jl_decision", schema);
		}
	}

	// CRUD methods for code would go here
	// create
	async create(decision: JudilibreDecision): Promise<void> {
		this.connect();

		await this.client.query<Result>(
			`INSERT INTO jl_decision (id, jurisdiction, location, chamber, number, decision_date, type, text, motivations, solution, summary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
			text: row.text,
			motivations: JSON.parse(row.motivations),
			solution: row.solution,
			summary: row.summary,
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
			text: row.text,
			motivations: JSON.parse(row.motivations),
			solution: row.solution,
			summary: row.summary,
		}));
	}

	// update
	async update(decision: JudilibreDecision): Promise<void> {
		this.connect();

		await this.client.query(
			`UPDATE jl_decision 
             SET jurisdiction = ?, location = ?, chamber = ?, number = ?, decision_date = ?, type = ?, text = ?, motivations = ?, solution = ?, summary = ?
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
