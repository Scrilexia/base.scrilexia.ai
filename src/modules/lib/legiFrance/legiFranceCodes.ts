import type { Abort } from "../../../utils/abortController";
import vectorManager from "../../vector/vectorManager";
import { LegiFranceBase } from "./legiFrance";
import {
	legiFranceArticleRepository,
	legiFranceCodeOrLawRepository,
} from "./legiFranceArticleRepository";
import {
	CodeSearchResult,
	type CodeSearchResults,
	type LegiFranceCodeArticleOnline,
	type LegiFranceCodeOnline,
} from "./legiFranceTypes";

export class LegiFranceCodes extends LegiFranceBase {
	#code: string;

	constructor(code: string, abortController: Abort) {
		super(abortController);
		this.#code = code;
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
		this.abortController.reset();

		// Implementation to add articles based on this.#code

		await this.prepareDatabases();
		const code = await this.searchCodes();

		if (!code) {
			throw new Error(`Code not found: ${this.#code}`);
		}

		try {
			await legiFranceCodeOrLawRepository.create({
				id: code.id,
				title: code.titre,
				titleFull: code.titre,
				state: code.etat,
				startDate: new Date(code.dateDebut),
				endDate: code.dateFin ? new Date(code.dateFin) : new Date(Date.now()),
			});
		} catch (_error) {
			// already exists
			await legiFranceCodeOrLawRepository.update({
				id: code.id,
				title: code.titre,
				titleFull: code.titre,
				state: code.etat,
				startDate: new Date(code.dateDebut),
				endDate: code.dateFin ? new Date(code.dateFin) : new Date(Date.now()),
			});
		}

		await this.retrieveArticlesIdsFromCode(code);
		await legiFranceCodeOrLawRepository.disconnect();
		await legiFranceArticleRepository.disconnect();
	}

	private async searchCodes(): Promise<CodeSearchResult | null> {
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

	private async retrieveArticlesIdsFromCode(
		code: CodeSearchResult,
	): Promise<void> {
		// Implementation to retrieve article IDs from the code

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

			const collectedArticles: LegiFranceCodeArticleOnline[] = [];

			if (codeOnline?.sections) {
				for (const section of codeOnline.sections) {
					collectedArticles.push(
						...(await this.collectArticleIdsFromSection(section)),
					);
				}
			}

			if (codeOnline?.articles) {
				collectedArticles.push(
					...(await this.collectArticleIds(codeOnline.articles)),
				);
			}

			const sortedCollectedArticlesIds: LegiFranceCodeArticleOnline[] = [];
			const articlesSet: Set<string> = new Set();

			sortedCollectedArticlesIds.push(
				...collectedArticles
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
			sortedCollectedArticlesIds.push(
				...collectedArticles.filter(
					(article) =>
						!article.num ||
						article.num === "" ||
						!this.isValidArticleNumber(article.num),
				),
			);

			await this.insertCodeArticlesAccordingIds(
				sortedCollectedArticlesIds,
				code.id,
				code.titre,
			);
		} catch (error) {
			console.error(error);
		}
	}

	private async insertCodeArticlesAccordingIds(
		articles: LegiFranceCodeArticleOnline[],
		codeId: string,
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
			await this.insertArticle(articleDetails, codeId, codeTitle);

			if (this.abortController.controller.signal.aborted) {
				break;
			}
		}
	}
}

export class LegiFranceCodesReset extends LegiFranceBase {
	async resetArticles(): Promise<void> {
		const collections = await vectorManager.getCollections();
		for (const collectionName of collections) {
			if (collectionName.startsWith("legifrance_embeddings_")) {
				await vectorManager.deleteCollection(collectionName);
			}
		}

		await legiFranceArticleRepository.deleteTable();
		await legiFranceCodeOrLawRepository.deleteTable();

		await legiFranceCodeOrLawRepository.disconnect();
		await legiFranceArticleRepository.disconnect();
	}
}
