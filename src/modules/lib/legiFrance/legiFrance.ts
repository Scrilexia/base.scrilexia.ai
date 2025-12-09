import {
	connectLegiFrance,
	getEnum,
	getEnvValue,
	getLegiFranceAuthorization,
	httpRequest,
	isEnum,
	legiFrancePostRequest,
	removeEnv,
	splitTextWithtokens,
	toDate,
	trySeveralTimes,
} from "../../../utils/environment";
import type { Collection } from "../../vector/collection";
import vectorManager from "../../vector/vectorManager";
import {
	legiFranceArticleRepository,
	legiFranceCodeOrLawRepository,
} from "./legiFranceArticleRepository";
import {
	ArticleSearchResult,
	type LegiFranceCodeArticleOnline,
	type LegiFranceCodeSectionOnline,
} from "./legiFranceTypes";

import { CHUNK_SIZE } from "../../../types/constants";
import type { Abort } from "../../../utils/abortController";
import { Vector } from "../../vector/vectorUtils";
import type { EmbeddingInterface } from "../embedding/embeddingBase";
import { EmbeddingProviders, createEmbedding } from "../embedding/provider";

export class LegiFranceBase {
	protected hfToken: string | null = null;
	protected hfModel: string | null = null;
	protected collection: Collection | null = null;
	protected abortController: Abort;
	protected embeddingInstance: EmbeddingInterface;

	constructor(abortController: Abort) {
		this.abortController = abortController;
		const embeddingProviderString = getEnvValue("embedding_provider");
		let embeddingProvider = EmbeddingProviders.Ollama;
		if (
			embeddingProviderString &&
			isEnum(EmbeddingProviders, embeddingProviderString)
		) {
			embeddingProvider = getEnum(EmbeddingProviders, embeddingProviderString);
		}

		this.embeddingInstance = createEmbedding(embeddingProvider, {});
	}

	protected async prepareDatabases(): Promise<void> {
		await legiFranceCodeOrLawRepository.initializeDatabase();
		await legiFranceArticleRepository.initializeDatabase();

		await connectLegiFrance();
		vectorManager.size = await this.embeddingInstance.getDimension();

		const collectionName = `legifrance_embeddings_${vectorManager.size}`;
		if (!(await vectorManager.collectionExists(collectionName))) {
			this.collection = await vectorManager.createCollection(collectionName);
		} else {
			this.collection = await vectorManager.getCollection(collectionName);
		}
	}

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

	protected async collectArticleIdsFromSection(
		section: LegiFranceCodeSectionOnline,
	): Promise<LegiFranceCodeArticleOnline[]> {
		const retrievedArticleIds: LegiFranceCodeArticleOnline[] = [];
		if (section?.articles?.length !== 0) {
			retrievedArticleIds.push(...this.collectArticleIds(section.articles));
		}

		if (section.sections?.length !== 0) {
			for (const subSection of section.sections) {
				retrievedArticleIds.push(
					...(await this.collectArticleIdsFromSection(subSection)),
				);
			}
		}

		return retrievedArticleIds;
	}

	protected collectArticleIds(
		articles: LegiFranceCodeArticleOnline[],
	): LegiFranceCodeArticleOnline[] {
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

	protected async searchArticleById(id: string): Promise<ArticleSearchResult> {
		const body = {
			id: id,
		};

		try {
			const data = await legiFrancePostRequest<Record<string, unknown>>(
				"https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/getArticle",
				body,
			);

			if (!data) {
				console.error("Error: No data found in searchArticleById");
				return new ArticleSearchResult();
			}

			return data.article as unknown as ArticleSearchResult;
		} catch (error) {
			console.error(error);
			return new ArticleSearchResult();
		}
	}

	protected async insertArticle(
		articleDetails: ArticleSearchResult,
		codeOrLawId: string,
		codeOrLawTitle: string,
	): Promise<void> {
		if (
			!articleDetails ||
			!articleDetails.texte ||
			articleDetails.texte.trim() === ""
		) {
			console.warn(`No valid text found for article ${articleDetails.id}`);
			return;
		}

		const chunks = await splitTextWithtokens(articleDetails.texte, CHUNK_SIZE);

		for (const chunk of chunks) {
			const embedding = await trySeveralTimes<number[]>(
				async () => await this.embeddingInstance.embed(chunk),
			);

			const length = (await this.collection?.getCount()) ?? 0;
			let index = length + 1;
			const searchResult = await this.collection?.search({
				id: articleDetails.id,
				num: articleDetails.num,
				lawTitle: codeOrLawTitle,
				sentence: `${chunk.substring(0, 30)}...`,
			});
			if (searchResult && searchResult.points.length > 0) {
				index = searchResult.points[0].id as number;
			}
			await this.collection?.addEmbedding(embedding, index, {
				id: articleDetails.id,
				date: articleDetails.dateVersion,
				num: articleDetails.num,
				lawTitle: codeOrLawTitle,
				sentence: `${chunk.substring(0, 30)}...`, // Store the first 30 characters of the chunk
			});

			if (this.abortController.controller.signal.aborted) {
				console.log("Aborting...");
				return;
			}
		}

		try {
			await legiFranceArticleRepository.create({
				id: articleDetails.id,
				number: articleDetails.num,
				text: articleDetails.texte,
				state: articleDetails.etat,
				startDate: toDate(articleDetails.dateDebut, new Date(Date.now())),
				endDate: toDate(
					articleDetails.dateFin,
					new Date(2999, 0, 1, 0, 0, 0, 0),
				),
				codeId: codeOrLawId,
			});
		} catch (_error) {
			await legiFranceArticleRepository.update({
				id: articleDetails.id,
				codeId: codeOrLawId,
				number: articleDetails.num,
				text: articleDetails.texte,
				state: articleDetails.etat,
				startDate: toDate(articleDetails.dateDebut, new Date(Date.now())),
				endDate: toDate(
					articleDetails.dateFin,
					new Date(2999, 0, 1, 0, 0, 0, 0),
				),
			});
		}
	}
}
