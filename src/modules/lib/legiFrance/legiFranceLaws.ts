import {
	legiFrancePostRequest,
	searchDate,
} from "../../../utils/environment.js";
import { LegiFranceBase } from "./legiFrance.js";
import {
	type LegiFranceCode,
	legiFranceArticleRepository,
	legiFranceCodeOrLawRepository,
} from "./legiFranceArticleRepository.js";
import {
	type LegiFranceLawArticleOnline,
	LegiFranceLawEnumerationResult,
	type LegiFranceLawOnline,
} from "./legiFranceTypes.js";

const MAX_INPUT_TOKENS = 512 * 1024;

export class LegiFranceLaws extends LegiFranceBase {
	async addLaws(): Promise<void> {
		this.abortController.reset();

		// Implementation for adding laws to the database
		await this.prepareDatabases();

		const lawsResult = await this.enumerateLaws();

		if (!lawsResult.results || lawsResult.results.length === 0) {
			throw new Error("No laws found in enumerateLaws");
		}

		try {
			await this.insertArticlesAndLaws(
				lawsResult.results,
				lawsResult.totalResultNumber,
			);
		} catch (error) {
			console.error("Error inserting articles and laws:", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw error;
		}
	}

	async addLawsFromSqlToQdrant(): Promise<void> {
		this.abortController.reset();

		// Implementation for adding laws from SQL to Qdrant
		await this.prepareDatabases();

		const laws = await legiFranceCodeOrLawRepository.readAllLaws();
		let index = 0;
		for (const law of laws) {
			console.info(
				`Law ${index + 1} / ${laws.length} : ${law.title} (${law.id})`,
			);
			index++;

			const articles = await legiFranceArticleRepository.readAllByCodeId(
				law.id,
			);

			for (const article of articles) {
				console.log(`\tArticle ${article.number}`);
				this.insertArticle(
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
					law.id,
					law.title,
				);
			}
		}

		legiFranceCodeOrLawRepository.disconnect();
		legiFranceArticleRepository.disconnect();
	}

	async buildTrainingDataset(): Promise<string> {
		const codes = await legiFranceCodeOrLawRepository.readAllLaws();
		const resultLines: string[] = [];

		let index = 0;
		for (const code of codes) {
			console.info(
				`Law ${index + 1} / ${codes.length} : ${code.title} (${code.id})`,
			);
			index++;
			resultLines.push(...(await this.buildArticlesList(code.id, code.title)));
		}

		const max = Math.max(...resultLines.map((line) => line.length));
		console.log(`Max prompt length: ${max} characters`);
		await legiFranceCodeOrLawRepository.disconnect();
		await legiFranceArticleRepository.disconnect();

		return resultLines.join("\n");
	}

	private async enumerateLaws(): Promise<LegiFranceLawEnumerationResult> {
		const body = {
			sort: "PUBLICATION_DATE_DESC",
			pageSize: 10000,
			states: ["VIGUEUR"],
			natures: ["LOI"],
			pageNumber: 1,
		};

		const url =
			"https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/list/loda";

		try {
			const data = await legiFrancePostRequest<LegiFranceLawEnumerationResult>(
				url,
				body,
			);

			if (!data || !data.results) {
				console.error("Error: No results found in enumerateLaws");
				return new LegiFranceLawEnumerationResult();
			}

			return data;
		} catch (error) {
			console.error(error);
			return new LegiFranceLawEnumerationResult();
		}
	}

	private async insertArticlesAndLaws(
		laws: LegiFranceLawOnline[],
		totalResultNumber: number,
	) {
		try {
			let index = 0;

			for (const law of laws) {
				const title = law.titre as string;
				const dateResult = searchDate(title);

				const titleShort =
					dateResult.endIndex !== -1
						? title.substring(0, dateResult.endIndex)
						: title;

				console.info(
					`Law ${index + 1} / ${totalResultNumber} : ${titleShort} (${law.id})`,
				);
				index++;

				const lawFound = await this.searchLawById(law.id);
				if (!lawFound) {
					console.warn(`Law with ID ${law.id} not found.`);
					continue;
				}

				if (!lawFound.title) {
					console.warn(`Law with ID ${law.id} has no title.`);
					continue;
				}

				let lawInRepository: LegiFranceCode | null = null;
				try {
					lawInRepository = await legiFranceCodeOrLawRepository.read(law.id);
					if (!lawInRepository) {
						await legiFranceCodeOrLawRepository.create({
							id: law.id,
							title: titleShort,
							titleFull: title,
							state: "VIGUEUR",
							startDate: new Date(lawFound.dateDebutVersion),
							endDate: new Date(lawFound.dateFinVersion),
						});

						lawInRepository = await legiFranceCodeOrLawRepository.read(law.id);
					}
				} catch (error) {
					console.error(`Error processing law id ${law.id}: ${error}`);
				}

				if (!lawInRepository) {
					console.warn(`Law with alias ${law.id} not found in repository.`);
					continue;
				}

				const articleIds: LegiFranceLawArticleOnline[] = [];

				if (lawFound.sections) {
					for (const section of lawFound.sections) {
						articleIds.push(
							...(await this.collectArticleIdsFromSection(section)),
						);
					}
				}

				if (lawFound.articles) {
					articleIds.push(...(await this.collectArticleIds(lawFound.articles)));
				}

				const usefulArticles = articleIds.filter(
					(article) => !this.containsModificationOrAbrogation(article.content),
				);

				await this.insertArticlesAccordingIds(
					usefulArticles,
					lawInRepository.id,
					titleShort,
				);

				if (this.abortController.controller.signal.aborted) {
					console.log("Import of articles and laws into database aborted.");
					break;
				}
			}
		} catch (error) {
			console.error("Error in retrieveArticlesIdsFromCode:", error);
		}
	}

	private async searchLawById(
		id: string,
	): Promise<LegiFranceLawOnline | undefined | null> {
		const body = {
			textId: id,
			date: new Date().getTime(), // Current timestamp in seconds
		};

		const url =
			"https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/lawDecree";

		try {
			return await legiFrancePostRequest<LegiFranceLawOnline>(url, body);
		} catch (error) {
			console.error("Error in searchLawById:", error);
			return null;
		}
	}

	private containsModificationOrAbrogation(content: string): boolean {
		const regex =
			/\b(?:a|ont)?\s*(modifié|abrogé|créé|modifié ou créé|modifié ou abrogé) les dispositions suivantes\b/gi;
		const contains = regex.test(content);
		return contains;
	}

	private async insertArticlesAccordingIds(
		articles: LegiFranceLawArticleOnline[],
		lawId: string,
		lawTitle: string,
	): Promise<void> {
		if (!articles || articles.length === 0) {
			return;
		}

		const articlesSet: Set<string> = new Set();

		const filteredArticles = articles.filter((article) => {
			if (!article) {
				return false;
			}
			return true;
		});

		const numberedArticles = filteredArticles
			.filter(
				(article) =>
					article?.num &&
					article.num !== "" &&
					this.isValidArticleNumber(article.num),
			)
			.filter((article) => {
				if (!article?.num) {
					return false;
				}
				const key = `${article.id}-${article.num}`;
				if (articlesSet.has(key)) {
					return false;
				}
				articlesSet.add(key);
				return true;
			})
			.sort((a, b) => {
				if (!a?.num || !b?.num) {
					return 0;
				}
				const valueA = this.retrieveValueFromArticleNum(a.num);
				const valueB = this.retrieveValueFromArticleNum(b.num);

				return valueA - valueB;
			});

		const notNumberedArticles = filteredArticles.filter(
			(article) =>
				!article?.num ||
				article.num === "" ||
				!this.isValidArticleNumber(article.num),
		);

		for (const article of numberedArticles) {
			const articleDetails = await this.searchArticleById(article.id);
			if (!articleDetails) {
				console.warn(`Article with ID ${article.id} not found.`);
				continue;
			}
			articleDetails.num = articleDetails?.num ?? article.num ?? "";
			console.log(`\tArticle ${articleDetails.num}`);
			await this.insertArticle(articleDetails, lawId, lawTitle);

			if (this.abortController.controller.signal.aborted) {
				break;
			}
		}

		if (this.abortController.controller.signal.aborted) {
			return;
		}

		for (const [index, article] of notNumberedArticles.entries()) {
			const articleDetails = await this.searchArticleById(article.id);
			if (!articleDetails) {
				console.warn(`Article with ID ${article.id} not found.`);
				continue;
			}
			articleDetails.num = articleDetails?.num ?? `Annexe ${index + 1}`;
			console.log(`\tArticle ${articleDetails.num}`);
			await this.insertArticle(articleDetails, lawId, lawTitle);

			if (this.abortController.controller.signal.aborted) {
				break;
			}
		}
	}
}
