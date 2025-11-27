import { InferenceClient } from "@huggingface/inference";
import {
	connectLegiFrance,
	getEnvValue,
	getLegiFranceAuthorization,
	httpRequest,
	legiFrancePostRequest,
	removeEnv,
	toDate,
} from "../../utils/environment";
import type { Collection } from "../vector/collection";
import vectorManager from "../vector/vectorManager";
import {
	legiFranceArticleRepository,
	legiFranceCodeOrLawRepository,
} from "./legiFranceArticleRepository";
import {
	ArticleSearchResult,
	type LegiFranceCodeArticleOnline,
	type LegiFranceCodeSectionOnline,
} from "./legiFranceTypes";

import { TokenTextSplitter } from "langchain/text_splitter";
import { CHUNK_SIZE } from "../../types/constants";
import type { Abort } from "../../utils/abortController";
import { Vector } from "../vector/vectorUtils";

export class LegiFranceBase {
	protected hfToken: string | null = null;
	protected hfModel: string | null = null;
	protected collection: Collection | null = null;
	protected abortController: Abort;

	constructor(abortController: Abort) {
		this.abortController = abortController;
	}

	protected async prepareDatabases(): Promise<void> {
		await legiFranceCodeOrLawRepository.initializeDatabase();
		await legiFranceArticleRepository.initializeDatabase();

		await connectLegiFrance();
		this.hfToken = getEnvValue("hugging_face_token");
		this.hfModel = getEnvValue("hugging_face_embedding_model");

		const hf = new InferenceClient(this.hfToken as string);
		const result = await hf.featureExtraction({
			model: this.hfModel as string,
			inputs: "test",
			provider: "hf-inference",
		});

		if (Array.isArray(result) && result.length > 0) {
			if (Array.isArray(result[0])) {
				vectorManager.size = (result[0] as number[]).length;
			} else {
				vectorManager.size = result.length;
			}
		}

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

		const chunks = await this.splitTextWithtokens(
			articleDetails.texte,
			CHUNK_SIZE,
		);

		const hf = new InferenceClient(this.hfToken as string);

		for (const chunk of chunks) {
			const result = await hf.featureExtraction({
				model: this.hfModel as string,
				inputs: chunk,
				provider: "hf-inference",
			});

			let embedding: number[] = [];
			if (Array.isArray(result) && result.length > 0) {
				if (Array.isArray(result[0])) {
					const vectors = (result as Array<number[]>).map(
						(vectorArray) => new Vector(vectorArray),
					);
					embedding = Vector.center(vectors).vector;
				} else {
					const vector = new Vector(result as number[]);
					vector.normalize();
					embedding = vector.vector;
				}
			} else {
				console.warn(
					`No embedding generated for article ${articleDetails.id}, chunk skipped.`,
				);
				continue;
			}

			const length = (await this.collection?.getCount()) ?? 0;
			await this.collection?.addEmbedding(embedding, length + 1, {
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
