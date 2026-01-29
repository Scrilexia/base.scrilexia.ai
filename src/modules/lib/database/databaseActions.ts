import type { RequestHandler } from "express";
import {
	type LegiFranceCodeArticle,
	legiFranceArticleRepository,
	legiFranceCodeOrLawRepository,
} from "../legiFrance/legiFranceArticleRepository.js";

export const databaseCodeArticles: RequestHandler = async (req, res, next) => {
	const codeTitle = req.body.codeTitle;
	const articleNumber = req.body.articleNumber;

	if (!codeTitle || !articleNumber) {
		res.status(400).send("codeTitle and articleNumber are required");
		return;
	}

	try {
		legiFranceArticleRepository.initializeDatabase();

		const article =
			await legiFranceArticleRepository.readByArticleNumberAndCodeTitle(
				articleNumber,
				codeTitle,
			);

		if (!article) {
			res.status(404).send("Article not found");
			return;
		}

		res.status(200).json(article);
	} catch (error) {
		res.status(500).send("Internal Server Error");
	}
};

export const databaseLawArticles: RequestHandler = async (req, res, next) => {
	const lawTitle = req.body.lawTitle;
	const articleNumber = req.body.articleNumber;

	if (!lawTitle || !articleNumber) {
		res.status(400).send("lawTitle and articleNumber are required");
		return;
	}

	try {
		legiFranceArticleRepository.initializeDatabase();
		legiFranceCodeOrLawRepository.initializeDatabase();

		const articles = Array<LegiFranceCodeArticle & { codeTitle: string }>();
		const laws = await legiFranceCodeOrLawRepository.readByTitle(lawTitle);
		for (const law of laws) {
			const article =
				await legiFranceArticleRepository.readByArticleNumberAndCodeTitle(
					articleNumber,
					law.title,
				);
			if (article) {
				const articleWithTitle = article as LegiFranceCodeArticle & {
					codeTitle: string;
				};
				articleWithTitle.codeTitle = law.title;
				articles.push(articleWithTitle);
			}
		}

		res.status(200).json(articles);
	} catch (error) {
		res.status(500).send("Internal Server Error");
	}
};

export const databaseCodeLawArticlesById: RequestHandler = async (
	req,
	res,
	next,
) => {
	const id = req.body.id;

	if (!id) {
		res.status(400).send("id is required");
		return;
	}

	try {
		legiFranceCodeOrLawRepository.initializeDatabase();

		const code = await legiFranceCodeOrLawRepository.read(id);

		res.status(200).json(code);
	} catch (error) {
		res.status(500).send("Internal Server Error");
	}
};
