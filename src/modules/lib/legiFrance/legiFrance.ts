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
	legiFranceStorageTarget,
} from "./legiFranceTypes";

import { CHUNK_SIZE } from "../../../types/constants";
import type { Abort } from "../../../utils/abortController";
import type { EmbeddingInterface } from "../embedding/embeddingBase";
import { EmbeddingProviders, createEmbedding } from "../embedding/provider";

const MAX_INPUT_TOKENS = 2 * 1024 * 1024;

export class LegiFranceBase {
	protected hfToken: string | null = null;
	protected hfModel: string | null = null;
	protected collection: Collection | null = null;
	protected abortController: Abort;
	protected embeddingInstance: EmbeddingInterface | null;
	protected target: legiFranceStorageTarget;

	constructor(abortController: Abort, target: legiFranceStorageTarget) {
		this.abortController = abortController;
		this.target = target;
		this.embeddingInstance = null;

		if (target & legiFranceStorageTarget.QDRANT) {
			const embeddingProviderString = getEnvValue("embedding_provider");
			let embeddingProvider = EmbeddingProviders.Ollama;
			if (
				embeddingProviderString &&
				isEnum(EmbeddingProviders, embeddingProviderString)
			) {
				embeddingProvider = getEnum(
					EmbeddingProviders,
					embeddingProviderString,
				);
			}

			this.embeddingInstance = createEmbedding(embeddingProvider, {});
		}
	}

	protected async prepareDatabases(): Promise<void> {
		await legiFranceCodeOrLawRepository.initializeDatabase();
		await legiFranceArticleRepository.initializeDatabase();

		await connectLegiFrance();
		if (this.target & legiFranceStorageTarget.QDRANT) {
			vectorManager.size =
				(await this.embeddingInstance?.getDimension()) ?? 1024;

			const collectionName = `legifrance_embeddings_${vectorManager.size}`;
			if (!(await vectorManager.collectionExists(collectionName))) {
				this.collection = await vectorManager.createCollection(collectionName);
			} else {
				this.collection = await vectorManager.getCollection(collectionName);
			}
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
			article.num = article.num?.trim() ?? "";
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

		if (this.target & legiFranceStorageTarget.QDRANT) {
			const chunks = await splitTextWithtokens(
				articleDetails.texte,
				CHUNK_SIZE,
			);

			for (const chunk of chunks) {
				const embedding = await trySeveralTimes<number[]>(
					async () =>
						(await this.embeddingInstance?.embed(chunk)) ??
						Array<number>(vectorManager.size).fill(0),
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
		}

		if (this.target & legiFranceStorageTarget.SQL) {
			try {
				const articleDetailsFound = await legiFranceArticleRepository.read(
					articleDetails.id,
				);
				if (articleDetailsFound) {
					const dateDebut = toDate(
						articleDetails.dateDebut,
						new Date(Date.now()),
					);
					const dateFin = toDate(
						articleDetails.dateFin,
						new Date(2999, 0, 1, 0, 0, 0, 0),
					);

					if (
						articleDetailsFound.state !== articleDetails.etat ||
						articleDetailsFound.startDate?.getTime() !== dateDebut.getTime() ||
						articleDetailsFound.endDate?.getTime() !== dateFin.getTime()
					) {
						await legiFranceArticleRepository.update({
							id: articleDetails.id,
							number: articleDetails.num,
							text: articleDetails.texte,
							state: articleDetails.etat ?? "",
							startDate: dateDebut,
							endDate: dateFin,
							codeId: codeOrLawId,
						});
					}
					return;
				}

				await legiFranceArticleRepository.create({
					id: articleDetails.id,
					number: articleDetails.num,
					text: articleDetails.texte,
					state: articleDetails.etat ?? "",
					startDate: toDate(articleDetails.dateDebut, new Date(Date.now())),
					endDate: toDate(
						articleDetails.dateFin,
						new Date(2999, 0, 1, 0, 0, 0, 0),
					),
					codeId: codeOrLawId,
				});
			} catch (error) {
				console.error(
					`Error processing decision id ${articleDetails.id}: ${error}`,
				);
			}
		}
	}

	protected async buildArticlesList(
		codeId: string,
		codeTitle: string,
		maxInputTokens: number,
	): Promise<string[]> {
		const resultLines: string[] = [];
		const invisibleCharsRegex =
			// biome-ignore lint/suspicious/noMisleadingCharacterClass: <explanation>
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			/[\u0000-\u001F\u007F\u200B\u200C\u200D\u200E\u200F\u202A-\u202E\u2060\uFEFF]/g;

		const articles = await legiFranceArticleRepository.readAllByCodeId(codeId);
		for (const article of articles) {
			let text = article.text
				.replace(/(?<!\\)(["\\])/g, "\\$&")
				.replace(/(?<!\\)\n/g, "\\n")
				.replace(/(?<!\\)\r/g, "\\r")
				.replace(/(?<!\\)\t/g, "\\t")
				.replace(/(?<!\\)\b/g, "")
				.replace(/(?<!\\)\f/g, "\\f");

			const matchInvisibleChars = invisibleCharsRegex.exec(text);
			if (matchInvisibleChars) {
				console.warn(
					`Invisible characters found in article ${article.number} of ${codeTitle}: ${matchInvisibleChars
						.map((c) => c.charCodeAt(0).toString(16))
						.join(", ")}`,
				);
				text = text.replaceAll(invisibleCharsRegex, "");
				const match = invisibleCharsRegex.exec(text);
				if (match) {
					console.error(
						`Failed to remove invisible characters from article ${article.number} of ${codeTitle}`,
					);
				}
			}

			let prompt = `{"messages":[{"role":"user","content":"Article ${article.number} de la ${codeTitle}"},{"role":"assistant","content":"${
				text
			}"}]}`;

			if (prompt.length > maxInputTokens) {
				console.warn(
					`Article ${article.number} of ${codeTitle} exceeds maximum token limit, splitting...`,
				);
				const parts = this.splitString(text, maxInputTokens - 86);
				for (let i = 0; i < parts.length; i++) {
					const chunk = parts[i];

					prompt = `{"messages":[{"role":"user","content":"Article ${article.number} (${
						i + 1
					}) du ${codeTitle}"},{"role":"assistant","content":"${chunk}"}]}`;

					resultLines.push(prompt);
				}
			} else {
				resultLines.push(prompt);
			}
		}
		return resultLines;
	}

	protected splitString(text: string, maxLen: number): string[] {
		const parts = [];
		for (let i = 0; i < text.length; i += maxLen) {
			parts.push(text.slice(i, i + maxLen));
		}
		return parts;
	}
}
