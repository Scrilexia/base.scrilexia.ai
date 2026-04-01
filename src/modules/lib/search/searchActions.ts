import type { RequestHandler } from "express";
import {
	getEnvValue,
	httpRequest,
	trySeveralTimes,
} from "../../../utils/environment.js";
import type { AxiosResponse } from "axios";

interface ApiCustomSearchResult {
	title: string;
	link: string;
	snippet: string;
}

interface ApiCustomSearchResults {
	items: Array<ApiCustomSearchResult>;
}

export const searchWithCustom: RequestHandler = async (req, res, next) => {
	const blockIndex = Number.parseInt(req.body.index as string) || 0;
	const query = req.body.query as string;

	if (!query) {
		res.status(400).send("query is required and must be a string");
		return;
	}
	const apiKey = getEnvValue("custom_search_api_key");

	if (!apiKey) {
		res.status(500).send("Custom Search API key is not configured");
		return;
	}

	const customSearchEngineId = getEnvValue("custom_search_engine_id");

	if (!customSearchEngineId) {
		res.status(500).send("Custom Search Engine ID is not configured");
		return;
	}

	const startIndex = blockIndex * 10 + 1; // Google Custom Search API uses 1-based indexing
	const numResults = 10;

	const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${customSearchEngineId}&q=${query}&start=${startIndex}&num=${numResults}`;

	const response = await trySeveralTimes(() =>
		httpRequest<ApiCustomSearchResults>(url, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		}),
	);

	if (response.status !== 200) {
		res.status(500).send("Failed to fetch search results");
		return;
	}

	const data: ApiCustomSearchResults =
		response instanceof Response
			? ((await response.json()) as ApiCustomSearchResults)
			: (response as AxiosResponse<ApiCustomSearchResults>).data;

	res.status(200).json(data);
};
