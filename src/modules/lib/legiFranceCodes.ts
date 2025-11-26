import type { AxiosResponse } from "axios";
import { CHUNK_SIZE } from "../../types/constants";
import { Abort } from "../../utils/abortController";
import {
	connectLegiFrance,
	getEnvValue,
	httpRequest,
	legiFrancePostRequest,
} from "../../utils/environment";
import vectorManager from "../vector/vectorManager";
import { LegiFranceBase } from "./legiFrance";
import {
	ArticleSearchResult,
	CodeSearchResult,
	type CodeSearchResults,
	type LegiFranceCodeArticleOnline,
	type LegiFranceCodeOnline,
} from "./legiFranceTypes";
import { InferenceClient } from "@huggingface/inference";
import type { Collection } from "../vector/collection";
import { Vector } from "../vector/vectorUtils";

export class LegiFranceCodes extends LegiFranceBase {
	#code: string;
	#abortController: Abort;
	#hfToken: string | null = null;
	#hfModel: string | null = null;
	#collection: Collection | null = null;

	constructor(code = "") {
		super();
		this.#code = code;
		this.#abortController = new Abort();
	}

	set code(value: string) {
		this.#code = value;
	}

	get code(): string {
		return this.#code;
	}

	toString(): string {
		return this.#code;
	}

	async addArticles(): Promise<void> {
		// Implementation to add articles based on this.#code
		await connectLegiFrance();
		this.#hfToken = getEnvValue("hugging_face_token");
		this.#hfModel = getEnvValue("hugging_face_embedding_model");

		const hf = new InferenceClient(this.#hfToken as string);
		const result = await hf.featureExtraction({
			model: this.#hfModel as string,
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
			this.#collection = await vectorManager.createCollection(collectionName);
		} else {
			this.#collection = await vectorManager.getCollection(collectionName);
		}

		const code = await this.#searchCodes(this.#code);

		if (!code) {
			throw new Error(`Code not found: ${this.#code}`);
		}

		await this.#retrieveArticlesIdsFromCode(code);
	}

	async #searchCodes(code: string): Promise<CodeSearchResult | null> {
		const body = {
			sort: "TITLE_ASC",
			pageSize: 10,
			states: ["VIGUEUR", "ABROGE", "VIGUEUR_DIFF"],
			pageNumber: 1,
			codeName: this.#code,
		};

		try {
			const data = await this.legiFrancePostRequest<CodeSearchResults>(
				"https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/list/code",
				body,
			);

			if (!data) {
				console.error("Error: No data found in searchArticleById");
				return new CodeSearchResult();
			}

			const index = data.results.findIndex(
				(code) =>
					code.titre.toLowerCase() === this.#code.toLowerCase() &&
					code.etat === "VIGUEUR",
			);
			return index !== -1 ? data.results[index] : null;
		} catch (error) {
			console.error(error);

			return new CodeSearchResult();
		}
	}

	async #retrieveArticlesIdsFromCode(code: CodeSearchResult): Promise<void> {
		// Implementation to retrieve article IDs from the code
		this.#abortController.reset();

		try {
			const url =
				"https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/lawDecree";

			const body = {
				textId: code.id,
				date: new Date().getTime(), // Current timestamp in seconds
			};

			const codeOnline = await this.legiFrancePostRequest<LegiFranceCodeOnline>(
				url,
				body,
			);

			if (!codeOnline) {
				console.error("Error: No code found in retrieveArticlesIdsFromCode");
				return;
			}

			const articlesIds: LegiFranceCodeArticleOnline[] = [];

			if (codeOnline?.sections) {
				for (const section of codeOnline.sections) {
					articlesIds.push(
						...(await this.collectCodeArticleIdsFromSection(
							section,
							codeOnline.dateDebutVersion,
						)),
					);
				}
			}

			if (codeOnline?.articles) {
				articlesIds.push(
					...(await this.collectCodeArticleIds(codeOnline.articles)),
				);
			}

			const sortedArticlesIds: LegiFranceCodeArticleOnline[] = [];
			const articlesSet: Set<string> = new Set();

			sortedArticlesIds.push(
				...articlesIds
					.filter(
						(article) =>
							article.num &&
							article.num !== "" &&
							this.isValidArticleNumber(article.num),
					)
					.filter((article) => {
						const key = `${article.id}-${article.num}`;
						if (articlesSet.has(key)) {
							return false;
						}
						articlesSet.add(key);
						return true;
					})
					.sort((a, b) => {
						const valueA = this.retrieveValueFromArticleNum(a.num);
						const valueB = this.retrieveValueFromArticleNum(b.num);

						return valueA - valueB;
					}),
			);
			sortedArticlesIds.push(
				...articlesIds.filter(
					(article) =>
						!article.num ||
						article.num === "" ||
						!this.isValidArticleNumber(article.num),
				),
			);

			await this.insertCodeArticlesAccordingIds(sortedArticlesIds, code.titre);
		} catch (error) {
			console.error(error);
		}
	}

	private async insertCodeArticlesAccordingIds(
		articles: LegiFranceCodeArticleOnline[],
		codeTitle: string,
	) {
		if (!articles || articles.length === 0) {
			return;
		}
		let index = 0;
		for (const article of articles) {
			const articleDetails = await this.searchArticleById(article.id);
			console.log(
				`Article ${articleDetails.num} du ${codeTitle} (${++index}/${articles.length})`,
			);
			await this.insertCodeArticle(articleDetails, codeTitle);
		}
	}

	private async searchArticleById(id: string): Promise<ArticleSearchResult> {
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

	private async insertCodeArticle(
		articleDetails: ArticleSearchResult,
		codeTitle: string,
	): Promise<void> {
		if (
			!articleDetails ||
			!articleDetails.texte ||
			articleDetails.texte.trim() === ""
		) {
			console.warn(`No valid text found for article ${articleDetails.id}`);
			return;
		}

		const date = Number.isInteger(articleDetails.dateDebut)
			? new Date(articleDetails.dateDebut as number)
			: new Date(articleDetails.dateDebut);

		const chunks = await this.splitTextWithtokens(
			articleDetails.texte,
			CHUNK_SIZE,
		);

		const hf = new InferenceClient(this.#hfToken as string);

		for (const chunk of chunks) {
			const result = await hf.featureExtraction({
				model: this.#hfModel as string,
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

			const length = (await this.#collection?.getCount()) ?? 0;
			await this.#collection?.addEmbedding(embedding, length + 1, {
				id: articleDetails.id,
				date: date.toISOString(),
				num: articleDetails.num,
				codeTitle: codeTitle,
				sentence: `${chunk.substring(0, 30)}...`, // Store the first 30 characters of the chunk
			});
		}

		if (this.#abortController.controller.signal.aborted) {
			throw new Error("Operation aborted");
		}

		try {
			//insert article in database
		} catch (_error) {
			// update article in database
		}
	}
}
