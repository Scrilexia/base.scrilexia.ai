import type { RequestHandler } from "express";
import { LegiFranceCodes } from "./legiFranceCodes";

export const legiFranceAddArticles: RequestHandler = async (req, res, next) => {
	const legiFrance = new LegiFranceCodes(req.body.code);
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

export const legiFranceAddArticlesAndLaws: RequestHandler = async (
	req,
	res,
	next,
) => {
	res.status(200).send("OK");
};

export const legiFranceAddArticlesAndLawsStatus: RequestHandler = async (
	req,
	res,
	next,
) => {
	res.status(200).send("OK");
};
