import type { Abort } from "../../../utils/abortController.js";
import vectorManager from "../../vector/vectorManager.js";
import { LegiFranceBase } from "./legiFrance.js";
import {
	legiFranceArticleRepository,
	legiFranceCodeOrLawRepository,
} from "./legiFranceArticleRepository.js";
import {
	CodeSearchResult,
	type CodeSearchResults,
	type LegiFranceCodeArticleOnline,
	type LegiFranceCodeOnline,
	legiFranceStorageTarget,
} from "./legiFranceTypes.js";

const MAX_INPUT_TOKENS = 2 * 1024 * 1024;

export class LegiFranceCodes extends LegiFranceBase {
	#codes: string[] = [];

	constructor(
		codes: string[],
		abortController: Abort,
		target: legiFranceStorageTarget,
	) {
		super(abortController, target);
		this.#codes = codes;
	}

	set codes(value: string[]) {
		this.#codes = value;
	}

	get codes(): string[] {
		return this.#codes;
	}

	toString(): string {
		return this.#codes.join(", ");
	}

	async addArticlesToSql(): Promise<void> {
		this.abortController.reset();

		// Implementation to add articles based on this.#code

		await this.prepareDatabases();

		for (const codeName of this.#codes) {
			const code = await this.searchCodes(codeName);

			if (!code) {
				console.warn(`Code not found: ${code}`);
				continue;
			}

			const codeFound = await legiFranceCodeOrLawRepository.read(code.id);
			try {
				if (!codeFound) {
					await legiFranceCodeOrLawRepository.create({
						id: code.id,
						title: code.titre,
						titleFull: code.titre,
						state: code.etat,
						startDate: new Date(code.dateDebut),
						endDate: code.dateFin
							? new Date(code.dateFin)
							: new Date(Date.now()),
					});
				}
			} catch (error) {
				console.error(`Error processing decision id ${code.id}: ${error}`);
			}

			await this.retrieveArticlesIdsFromCode(code);
		}

		await legiFranceCodeOrLawRepository.disconnect();
		await legiFranceArticleRepository.disconnect();
	}

	async addArticlesFromSqlToQdrant(): Promise<void> {
		await this.prepareDatabases();
		const codes = await legiFranceCodeOrLawRepository.readAll();

		for (const code of codes) {
			const articles = await legiFranceArticleRepository.readAllByCodeId(
				code.id,
			);

			let index = 0;
			for (const article of articles) {
				console.log(
					`Article ${article.number} du ${code.title} (${++index}/${articles.length})`,
				);

				await this.insertArticle(
					{
						id: article.id,
						num: article.number,
						texte: article.text,
						etat: article.state,
						dateDebut: article.startDate
							? article.startDate.getTime()
							: Date.now(),
						dateFin: article.endDate
							? article.endDate.getTime()
							: new Date(2999, 0, 1, 0, 0, 0, 0).getTime(),
						dateVersion: article.startDate
							? article.startDate.toISOString()
							: new Date().toISOString(),
					},
					code.id,
					code.title,
				);
			}
		}

		await legiFranceCodeOrLawRepository.disconnect();
		await legiFranceArticleRepository.disconnect();
	}

	async buildTrainingDataset(): Promise<string> {
		const codes = await legiFranceCodeOrLawRepository.readAll();
		const resultLines: string[] = [];

		for (const code of codes) {
			if (!this.codes.includes(code.title)) {
				continue;
			}
			resultLines.push(...(await this.buildArticlesList(code.id, code.title)));
		}

		const max = Math.max(...resultLines.map((line) => line.length));
		console.log(`Max prompt length: ${max} characters`);
		await legiFranceCodeOrLawRepository.disconnect();
		await legiFranceArticleRepository.disconnect();

		return resultLines.join("\n");
	}

	private async searchCodes(
		codeName: string,
	): Promise<CodeSearchResult | null> {
		const body = {
			sort: "TITLE_ASC",
			pageSize: 10,
			states: ["VIGUEUR", "ABROGE", "VIGUEUR_DIFF"],
			pageNumber: 1,
			codeName: codeName,
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
					code.titre.toLowerCase() === codeName.toLowerCase() &&
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

			const filteredArticles = collectedArticles.filter((article) => {
				if (!article) {
					return false;
				}
				return true;
			});

			sortedCollectedArticlesIds.push(
				...filteredArticles
					.filter(
						(article) =>
							article?.num &&
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
				console.log("Import of articles into database aborted.");
				break;
			}
		}
	}
}

export class LegiFranceCodesReset extends LegiFranceBase {
	async resetArticles(): Promise<void> {
		if (this.target & legiFranceStorageTarget.QDRANT) {
			const collections = await vectorManager.getCollections();
			for (const collectionName of collections) {
				if (collectionName.startsWith("legifrance_embeddings_")) {
					await vectorManager.deleteCollection(collectionName);
				}
			}
		}

		if (this.target & legiFranceStorageTarget.SQL) {
			await legiFranceArticleRepository.deleteTable();
			await legiFranceCodeOrLawRepository.deleteTable();

			await legiFranceCodeOrLawRepository.disconnect();
			await legiFranceArticleRepository.disconnect();
		}
	}
}
