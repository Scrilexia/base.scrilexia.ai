import type { RequestHandler } from "express";
import { legiFranceArticleRepository } from "../legiFrance/legiFranceArticleRepository.js";

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
