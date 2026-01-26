import type { RequestHandler } from "express";
import { judilibreDecisionsImportationAbortController } from "../../../router.js";
import {
	JudilibreDecisions,
	JudilibreDecisionsQdrantReset,
	JudilibreDecisionsSearch,
	JudilibreDecisionsSqlReset,
} from "./judilibreDecisions.js";
import { Jurisdiction } from "./judilibreTypes.js";

export const judilibreDecisionsImportVector: RequestHandler = async (
	req,
	res,
	next,
) => {
	judilibreDecisionsImportationAbortController.reset();
	const judilibreDecisions = new JudilibreDecisions(
		req.body.jurisdiction ?? "cc",
		new Date(Date.now()),
		judilibreDecisionsImportationAbortController,
		req.body.start_index || 0,
		req.body.max_decisions_to_import || -1,
	);

	judilibreDecisions.addDecisionsToQdrant();
	res.status(200).send("Importation started");
};

export const judilibreDecisionsImportSql: RequestHandler = async (
	req,
	res,
	next,
) => {
	const judilibreDecisions = new JudilibreDecisions(
		req.body.jurisdiction,
		new Date(req.body.end_date ?? Date.now()),
		judilibreDecisionsImportationAbortController,
	);

	judilibreDecisions.addDecisionsToSql();
	res.status(200).send("Cache building started");
};

export const judilibreDecisionsImportSqlReset: RequestHandler = async (
	req,
	res,
	next,
) => {
	const judilibre = new JudilibreDecisionsSqlReset(req.body.jurisdiction);
	await judilibre.ImportSqlReset();
	res.status(200).send("Cache reset completed");
};

export const judilibreDecisionsImportAbort: RequestHandler = async (
	req,
	res,
	next,
) => {
	judilibreDecisionsImportationAbortController.controller.abort();
	res.status(200).send("OK");
};

export const judilibreDecisionsImportVectorReset: RequestHandler = async (
	req,
	res,
	next,
) => {
	judilibreDecisionsImportationAbortController.reset();
	const legiFrance = new JudilibreDecisionsQdrantReset(req.body.jurisdiction);
	await legiFrance.ImportQdrantReset();
	res.status(200).send("OK");
};

export const judilibreDecisionsBuildTrainingDatasetThemesAndDecisions: RequestHandler =
	async (req, res, next) => {
		judilibreDecisionsImportationAbortController.reset();
		const judilibreDecisions = new JudilibreDecisionsSearch(
			judilibreDecisionsImportationAbortController,
			req.body.jurisdiction ?? "cc",
		);

		const dataset =
			await judilibreDecisions.buildTrainingDatasetThemesDecisions();
		res.status(200).send(dataset);
	};

export const judilibreDecisionsBuildTrainingDatasetSummariesAndDecisions: RequestHandler =
	async (req, res, next) => {
		judilibreDecisionsImportationAbortController.reset();
		const judilibreDecisions = new JudilibreDecisionsSearch(
			judilibreDecisionsImportationAbortController,
			req.body.jurisdiction ?? "cc",
		);

		const dataset =
			await judilibreDecisions.buildTrainingDatasetSummariesDecisions();
		res.status(200).send(dataset);
	};

export const databaseDecisionsCc: RequestHandler = async (req, res, next) => {
	const judilibreDecisions = new JudilibreDecisionsSearch(
		judilibreDecisionsImportationAbortController,
		Jurisdiction.COUR_DE_CASSATION,
	);

	if (!req.body.chamber || typeof req.body.chamber !== "string") {
		res.status(400).send("chamber is required and must be a string");
		return;
	}

	const decisionDate =
		typeof req.body.decisionDate === "string"
			? (req.body.decisionDate as string)
			: null;
	const number =
		typeof req.body.number === "string" ? (req.body.number as string) : null;

	const decisions = await judilibreDecisions.retrieveDecisions(
		null,
		req.body.chamber as string,
		decisionDate,
		number,
	);

	res.status(200).json(decisions);
};

export const databaseDecisionsCa: RequestHandler = async (req, res, next) => {
	const judilibreDecisions = new JudilibreDecisionsSearch(
		judilibreDecisionsImportationAbortController,
		Jurisdiction.COURS_APPEL,
	);

	if (!req.body.chamber || typeof req.body.chamber !== "string") {
		res.status(400).send("chamber is required and must be a string");
		return;
	}

	if (!req.body.location || typeof req.body.location !== "string") {
		res.status(400).send("location is required and must be a string");
		return;
	}

	const decisionDate =
		typeof req.body.decisionDate === "string"
			? (req.body.decisionDate as string)
			: null;
	const number =
		typeof req.body.number === "string" ? (req.body.number as string) : null;

	const decisions = await judilibreDecisions.retrieveDecisions(
		req.body.location as string,
		req.body.chamber as string,
		decisionDate,
		number,
	);

	res.status(200).json(decisions);
};

export const databaseDecisionsCcById: RequestHandler = async (
	req,
	res,
	next,
) => {
	const judilibreDecisions = new JudilibreDecisionsSearch(
		judilibreDecisionsImportationAbortController,
		Jurisdiction.COUR_DE_CASSATION,
	);

	if (!req.body.id || typeof req.body.id !== "string") {
		res.status(400).send("id is required and must be a string");
		return;
	}
	const decision = await judilibreDecisions.retrieveDecisionById(
		req.body.id as string,
	);

	if (!decision) {
		res.status(404).send("Decision not found");
		return;
	}

	res.status(200).json(decision);
};

export const databaseDecisionsCaById: RequestHandler = async (
	req,
	res,
	next,
) => {
	const judilibreDecisions = new JudilibreDecisionsSearch(
		judilibreDecisionsImportationAbortController,
		Jurisdiction.COURS_APPEL,
	);

	if (!req.body.id || typeof req.body.id !== "string") {
		res.status(400).send("id is required and must be a string");
		return;
	}
	const decision = await judilibreDecisions.retrieveDecisionById(
		req.body.id as string,
	);

	if (!decision) {
		res.status(404).send("Decision not found");
		return;
	}

	res.status(200).json(decision);
};
