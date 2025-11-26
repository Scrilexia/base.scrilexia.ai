import {
	getLegiFranceAuthorization,
	httpRequest,
	removeEnv,
} from "../../utils/environment";
import type {
	LegiFranceCodeArticleOnline,
	LegiFranceCodeSectionOnline,
} from "./legiFranceTypes";

import { TokenTextSplitter } from "langchain/text_splitter";

export class LegiFranceBase {
	protected async legiFrancePostRequest<T>(
		url: string,
		body: Record<string, unknown> = {},
	): Promise<T | undefined> {
		let response = await httpRequest<T>(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${await getLegiFranceAuthorization()}`,
			},
			data: JSON.stringify(body),
			body: JSON.stringify(body),
		});

		if (response.status === 401) {
			removeEnv("authorization");
			response = await httpRequest<T>(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${await getLegiFranceAuthorization()}`,
				},
				data: JSON.stringify(body),
				body: JSON.stringify(body),
			});
		}

		if (response.status !== 200) {
			throw new Error(response.statusText || "Error fetching data");
		}

		if (response instanceof Response) {
			const responseData = await response.json();
			return responseData as T;
		}
		if ("data" in response) {
			const responseData = await response.data;
			return responseData as T;
		}

		throw new Error("Unexpected response format");
	}

	protected async collectCodeArticleIdsFromSection(
		section: LegiFranceCodeSectionOnline,
		dateDebutVersion: string,
	): Promise<LegiFranceCodeArticleOnline[]> {
		const retrievedArticleIds: LegiFranceCodeArticleOnline[] = [];
		if (section?.articles?.length !== 0) {
			retrievedArticleIds.push(
				...(await this.collectCodeArticleIds(section.articles)),
			);
		}

		if (section.sections?.length !== 0) {
			for (const subSection of section.sections) {
				retrievedArticleIds.push(
					...(await this.collectCodeArticleIdsFromSection(
						subSection,
						dateDebutVersion,
					)),
				);
			}
		}

		return retrievedArticleIds;
	}

	protected async collectCodeArticleIds(
		articles: LegiFranceCodeArticleOnline[],
	): Promise<LegiFranceCodeArticleOnline[]> {
		const retrievedArticleIds: LegiFranceCodeArticleOnline[] = [];

		for (const article of articles) {
			article.num = article.num.trim() ?? "";
		}
		retrievedArticleIds.push(...articles);

		return retrievedArticleIds;
	}

	protected isValidArticleNumber(num: string): boolean {
		return /^\d+(-\d+){0,3}$/g.test(num);
	}

	protected retrieveValueFromArticleNum(num: string): number {
		let value = 0;
		const arrayParts = num.split("-");
		if (arrayParts.length >= 1) {
			value += Number.parseFloat(arrayParts[0]);
		}
		if (arrayParts.length >= 2) {
			value += Number.parseFloat(arrayParts[1]) / 1000.0;
		}
		if (arrayParts.length >= 3) {
			value += Number.parseFloat(arrayParts[2]) / 1000000.0;
		}
		if (arrayParts.length >= 4) {
			value += Number.parseFloat(arrayParts[3]) / 1000000000.0;
		}
		return value;
	}

	protected async splitTextWithtokens(
		text: string,
		chunkSize: number,
	): Promise<string[]> {
		if (!text || text.trim() === "") {
			return [];
		}
		// Split the text into chunks based on the specified chunk size
		const splitter = new TokenTextSplitter({ chunkSize, chunkOverlap: 10 });
		return await splitter.splitText(text);
	}
}
