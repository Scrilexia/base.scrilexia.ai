import type { RequestHandler } from "express";
import { judilibreDecisionsImportationAbortController } from "../../../router";
import {
	JudilibreDecisions,
	JudilibreDecisionsQdrantReset,
	JudilibreDecisionsSqlReset,
} from "./judilibreDecisions";

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
