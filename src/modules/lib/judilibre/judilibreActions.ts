import type { RequestHandler } from "express";
import { judilibreDecisionsImportationAbortController } from "../../../router";
import {
	JudilibreDecisions,
	JudilibreDecisionsReset,
} from "./judilibreDecisions";

export const judilibreDecisionsImportation: RequestHandler = async (
	req,
	res,
	next,
) => {
	const judilibreDecisions = new JudilibreDecisions(
		req.body.jurisdiction,
		new Date(req.body.end_date),
		judilibreDecisionsImportationAbortController,
	);

	judilibreDecisions.addDecisions();
	res.status(200).send("Importation started");
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
	const legiFrance = new JudilibreDecisionsReset(
		judilibreDecisionsImportationAbortController,
	);
	await legiFrance.resetArticles();
	res.status(200).send("OK");
};
