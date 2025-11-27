import type { RequestHandler } from "express";
import {
	legiFranceAddArticlesAbortController,
	legiFranceAddArticlesAndLawsAbortController,
} from "../../router";
import { LegiFranceCodes, LegiFranceCodesReset } from "./legiFranceCodes";
import { LegiFranceLaws } from "./legiFranceLaws";

export const legiFranceAddArticles: RequestHandler = async (req, res, next) => {
	const legiFrance = new LegiFranceCodes(
		req.body.code,
		legiFranceAddArticlesAbortController,
	);
	legiFrance.addArticles();
	res.status(200).send("OK");
};

export const legiFranceAddArticlesStatus: RequestHandler = async (
	req,
	res,
	next,
) => {
	res.status(200).send("OK");
};

export const legiFranceAddArticlesAbort: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAbortController.controller.abort();
	res.status(200).send("OK");
};

export const legiFranceResetArticles: RequestHandler = async (
	req,
	res,
	next,
) => {
	const legiFrance = new LegiFranceCodesReset(
		legiFranceAddArticlesAbortController,
	);
	await legiFrance.resetArticles();
	res.status(200).send("OK");
};
export const legiFranceAddArticlesAndLaws: RequestHandler = async (
	req,
	res,
	next,
) => {
	const legiFrance = new LegiFranceLaws(
		legiFranceAddArticlesAndLawsAbortController,
	);
	legiFrance.addLaws();
	res.status(200).send("OK");
};

export const legiFranceAddAndLawsArticlesAbort: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAndLawsAbortController.controller.abort();
	res.status(200).send("OK");
};

export const legiFranceAddArticlesAndLawsStatus: RequestHandler = async (
	req,
	res,
	next,
) => {
	res.status(200).send("OK");
};
