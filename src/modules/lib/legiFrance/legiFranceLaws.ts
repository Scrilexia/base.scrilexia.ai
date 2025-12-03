import { legiFrancePostRequest, searchDate } from "../../../utils/environment";
import { LegiFranceBase } from "./legiFrance";
import { legiFranceCodeOrLawRepository } from "./legiFranceArticleRepository";
import {
	type LegiFranceCodeArticleOnline,
	type LegiFranceLawArticleOnline,
	LegiFranceLawEnumerationResult,
	type LegiFranceLawOnline,
	type LegiFranceLawSectionOnline,
} from "./legiFranceTypes";

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

				let lawInRepository = await legiFranceCodeOrLawRepository.read(law.id);
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

		const numberedArticles = articles
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
			});

		const notNumberedArticles = articles.filter(
			(article) =>
				!article.num ||
				article.num === "" ||
				!this.isValidArticleNumber(article.num),
		);

		for (const article of numberedArticles) {
			const articleDetails = await this.searchArticleById(article.id);
			articleDetails.num = articleDetails.num ?? article.num ?? "";
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
			articleDetails.num = articleDetails.num ?? `Annexe ${index + 1}`;
			console.log(`\tArticle ${articleDetails.num}`);
			await this.insertArticle(articleDetails, lawId, lawTitle);

			if (this.abortController.controller.signal.aborted) {
				break;
			}
		}
	}
}
