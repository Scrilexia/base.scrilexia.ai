import type { RequestHandler } from "express";
import { judilibreDecisionsImportationAbortController } from "../../../router";
import {
	JudilibreDecisions,
	JudilibreDecisionsCacheReset,
	JudilibreDecisionsReset,
} from "./judilibreDecisions";

export const judilibreDecisionsImportation: RequestHandler = async (
	req,
	res,
	next,
) => {
	judilibreDecisionsImportationAbortController.reset();
	const judilibreDecisions = new JudilibreDecisions(
		req.body.jurisdiction,
		new Date(req.body.end_date),
		judilibreDecisionsImportationAbortController,
	);

	judilibreDecisions.addDecisions();
	res.status(200).send("Importation started");
};

export const judilibreDecisionsCache: RequestHandler = async (
	req,
	res,
	next,
) => {
	const judilibreDecisions = new JudilibreDecisions(
		req.body.jurisdiction,
		new Date(),
		judilibreDecisionsImportationAbortController,
	);

	judilibreDecisions.buildDecisionIdsList();
	res.status(200).send("Cache building started");
};

export const judilibreDecisionsCacheReset: RequestHandler = async (
	req,
	res,
	next,
) => {
	const judilibre = new JudilibreDecisionsCacheReset(
		req.body.jurisdiction,
		judilibreDecisionsImportationAbortController,
	);
	await judilibre.resetCache();
	res.status(200).send("Cache reset completed");
};

export const judilibreDecisionsImportationStatus: RequestHandler = async (
	req,
	res,
	next,
) => {
	res.status(200).send("OK");
};

export const judilibreDecisionsImportationAbort: RequestHandler = async (
	req,
	res,
	next,
) => {
	judilibreDecisionsImportationAbortController.controller.abort();
	res.status(200).send("OK");
};

export const judilibreDecisionsImportationReset: RequestHandler = async (
	req,
	res,
	next,
) => {
	judilibreDecisionsImportationAbortController.reset();
	const legiFrance = new JudilibreDecisionsReset(
		judilibreDecisionsImportationAbortController,
		req.body.jurisdiction,
	);
	await legiFrance.resetDecisions();
	res.status(200).send("OK");
};
