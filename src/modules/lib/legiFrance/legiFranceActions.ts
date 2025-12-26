import type { RequestHandler } from "express";
import {
	legiFranceAddArticlesAbortController,
	legiFranceAddArticlesAndLawsAbortController,
} from "../../../router.js";
import { LegiFranceCodes, LegiFranceCodesReset } from "./legiFranceCodes.js";
import { LegiFranceLaws } from "./legiFranceLaws.js";
import { legiFranceStorageTarget } from "./legiFranceTypes.js";

export const legiFranceArticlesImportSql: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAbortController.reset();
	const legiFrance = new LegiFranceCodes(
		req.body.codes,
		legiFranceAddArticlesAbortController,
		legiFranceStorageTarget.SQL,
	);
	legiFrance.addArticlesToSql();
	res.status(200).send("OK");
};

export const legiFranceArticlesImportQdrant: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAbortController.reset();
	const legiFrance = new LegiFranceCodes(
		req.body.codes,
		legiFranceAddArticlesAbortController,
		legiFranceStorageTarget.QDRANT,
	);
	legiFrance.addArticlesFromSqlToQdrant();
	res.status(200).send("OK");
};

export const legiFranceArticlesImportAbort: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAbortController.controller.abort();
	res.status(200).send("OK");
};

export const legiFranceResetArticlesSql: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAbortController.reset();
	const legiFrance = new LegiFranceCodesReset(
		legiFranceAddArticlesAbortController,
		legiFranceStorageTarget.SQL,
	);
	await legiFrance.resetArticles();
	res.status(200).send("OK");
};

export const legiFranceResetArticlesQdrant: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAbortController.reset();
	const legiFrance = new LegiFranceCodesReset(
		legiFranceAddArticlesAbortController,
		legiFranceStorageTarget.QDRANT,
	);
	await legiFrance.resetArticles();
	res.status(200).send("OK");
};

export const legiFranceArticlesAndLawsImportSql: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAndLawsAbortController.reset();
	const legiFrance = new LegiFranceLaws(
		legiFranceAddArticlesAndLawsAbortController,
		legiFranceStorageTarget.SQL,
	);
	legiFrance.addLaws();
	res.status(200).send("OK");
};

export const legiFranceArticlesAndLawsImportQdrant: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAndLawsAbortController.reset();
	const legiFrance = new LegiFranceLaws(
		legiFranceAddArticlesAndLawsAbortController,
		legiFranceStorageTarget.QDRANT,
	);
	legiFrance.addLaws();
	res.status(200).send("OK");
};

export const legiFranceArticlesAndLawsImportAbort: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAndLawsAbortController.controller.abort();
	res.status(200).send("OK");
};

export const legiFranceBuildTrainingDataset: RequestHandler = async (
	req,
	res,
	next,
) => {
	legiFranceAddArticlesAbortController.reset();
	const legiFrance = new LegiFranceCodes(
		req.body.codes,
		legiFranceAddArticlesAbortController,
		legiFranceStorageTarget.SQL,
	);
	const result = await legiFrance.buildTrainingDataset();
	res.status(200).contentType("application/jsonl").send(result);
};

export const legiFranceArticlesAndLawsBuildTrainingDataset: RequestHandler =
	async (req, res, next) => {
		legiFranceAddArticlesAndLawsAbortController.reset();
		const legiFrance = new LegiFranceLaws(
			legiFranceAddArticlesAndLawsAbortController,
			legiFranceStorageTarget.SQL,
		);
		const result = await legiFrance.buildTrainingDataset();
		res.status(200).contentType("application/jsonl").send(result);
	};
