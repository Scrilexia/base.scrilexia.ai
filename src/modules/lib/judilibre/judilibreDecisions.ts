import type { AxiosResponse } from "axios";
import {
	CHUNK_SIZE,
	DECISIONS_BLOCKS_COUNT,
	DECISIONS_BLOCK_SIZE,
} from "../../../types/constants";
import type { Abort } from "../../../utils/abortController";
import {
	connect_piste,
	getEnum,
	getEnvValue,
	httpRequest,
	isEnum,
	removeEnv,
	setEnvValue,
	shortenWithEllipsis,
	splitTextWithtokens,
	trySeveralTimes,
} from "../../../utils/environment";
import type { EmbeddingInterface } from "../../lib/embedding/embeddingBase";
import {
	EmbeddingProviders,
	createEmbedding,
} from "../../lib/embedding/provider";
import type { Collection } from "../../vector/collection";
import vectorManager from "../../vector/vectorManager";
import {
	type JudilibreDecision,
	JudilibreRepository,
} from "./judilibreRepository";
import type { JudiDecision, Jurisdiction, Visa } from "./judilibreTypes";

type addEmbedding = (
	embedding: number[],
	zone: string,
	sentence: string,
) => Promise<void>;

export class JudilibreDecisions {
	#jurisdiction: Jurisdiction;
	#endDate: Date;
	private collection: Collection | null = null;
	private abortController: Abort;
	private oldestDecisionDate: Date;
	private judilibreRepository: JudilibreRepository;
	private embeddingInstance: EmbeddingInterface;
	private startIndex = 0;
	private maxDecisionsToImport = -1;

	constructor(
		jurisdiction: Jurisdiction,
		endDate: Date,
		abortController: Abort,
		startIndex = 0,
		maxDecisionsToImport = -1,
	) {
		this.#jurisdiction = jurisdiction;
		this.#endDate = endDate;
		this.startIndex = startIndex;
		this.maxDecisionsToImport = maxDecisionsToImport;

		this.oldestDecisionDate = endDate;
		this.abortController = abortController;
		this.judilibreRepository = new JudilibreRepository(this.#jurisdiction);
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

	async addDecisionsToSql(): Promise<void> {
		let blockIndex = 0;
		const blockSize = DECISIONS_BLOCK_SIZE;
		const blocksCount = DECISIONS_BLOCKS_COUNT;
		this.oldestDecisionDate = this.#endDate;
		await this.prepareCacheDatabase();
		let processImportation = true;
		let decisionCumulCount = 0;
		while (processImportation) {
			let currentIndex = 0;
			let lastDate = this.oldestDecisionDate;
			for (blockIndex = 0; blockIndex < blocksCount; blockIndex++) {
				const data = await this.invokeJudilibreExportation<
					Record<string, unknown>
				>(this.#jurisdiction, blockIndex, blockSize, this.oldestDecisionDate);
				if (!data) {
					console.error(
						"No data received from Judilibre API for block index:",
						blockIndex,
					);
					continue;
				}

				const decisions = data.results as JudiDecision[];
				if (!decisions || decisions.length === 0) {
					processImportation = false;
					break;
				}

				for (const decision of decisions) {
					lastDate = new Date(decision.decision_date);
					currentIndex++;

					console.log(
						`decision id ${decisionCumulCount + currentIndex}: ${decision.id} - ${decision.location ?? decision.jurisdiction}${decision.chamber ? `, ${decision.chamber}` : ""} du ${this.buildDate(decision.decision_date)} n°${decision.number}`,
					);

					let summary = "";
					if (decision.summary && decision.summary.trim() !== "") {
						summary = decision.summary;
					} else if (
						decision.titlesAndSummaries &&
						decision.titlesAndSummaries.length > 0
					) {
						summary = decision.titlesAndSummaries[0].summary;
					}

					decision.summary = summary;

					if (decision.visa && decision.visa.length > 0) {
						decision.visas = this.parseArticles(decision.visa);
					} else {
						decision.visas = [];
					}
					if (!decision.themes || decision.themes.length === 0) {
						decision.themes = [];
					}

					const decisionFound = await this.judilibreRepository.read(
						decision.id,
					);
					if (!decisionFound) {
						try {
							await this.judilibreRepository.create({
								id: decision.id,
								jurisdiction: decision.jurisdiction,
								location: decision.location ?? decision.jurisdiction,
								chamber: decision.chamber ?? "",
								number: decision.number ?? "unknown",
								decisionDate: decision.decision_date,
								type: decision.type ?? "unknown",
								text: decision.text,
								motivations: decision.zones?.motivations ?? [],
								solution: decision.solution ?? "",
								summary: decision.summary || "",
								themes: decision.themes,
								visas: decision.visas,
							});
						} catch (error) {
							console.error(
								`Error processing decision id ${decision.id}: ${error}`,
							);
						}
					}

					if (this.abortController.controller.signal.aborted) {
						processImportation = false;
						break;
					}
				}

				if (this.abortController.controller.signal.aborted) {
					processImportation = false;
					break;
				}
			}

			this.oldestDecisionDate = lastDate;
			decisionCumulCount += 10000;
		}

		if (this.abortController.controller.signal.aborted) {
			console.log("Decision IDs cache building aborted.");
		} else {
			console.log("Decision IDs cache building terminated.");
		}
	}

	async addDecisionsToQdrant(): Promise<void> {
		await this.prepareDatabases();

		const totalDecisions = (await this.judilibreRepository.count()) ?? 0;

		let currentIndex = 0;
		let processImportation = true;
		let decisionCumulCount = this.startIndex;

		try {
			while (processImportation) {
				if (
					this.maxDecisionsToImport > 0 &&
					decisionCumulCount >= this.maxDecisionsToImport
				) {
					console.log(
						`Maximum number of decisions to import reached: ${this.maxDecisionsToImport}`,
					);
					processImportation = false;
					continue;
				}

				if (this.abortController.controller.signal.aborted) {
					processImportation = false;
					break;
				}

				const decitionsInDatabase = await this.judilibreRepository.readAll(
					decisionCumulCount,
					10000,
				);
				if (decitionsInDatabase.length === 0) {
					console.log("All decisions have been imported.");
					processImportation = false;
					continue;
				}

				if (this.abortController.controller.signal.aborted) {
					console.log("Decisions importation aborted.");
					processImportation = false;
					continue;
				}

				for (const decision of decitionsInDatabase) {
					currentIndex++;

					console.log(
						`decision ${decisionCumulCount + currentIndex}/${totalDecisions}: ${decision.id} - ${decision.location ?? decision.jurisdiction}${decision.chamber ? `, ${decision.chamber}` : ""} du ${this.buildDate(decision.decisionDate)} n°${decision.number}`,
					);

					const { dataToInsert, dataToSearch } =
						this.buildDataToInsert(decision);

					try {
						if (decision.summary && decision.summary.trim() !== "") {
							console.log("\t- index summary");
							await this.addEmbeddingsbySentences(
								decision.summary,
								"summary",
								async (embedding: number[], zone: string, sentence: string) => {
									dataToInsert.zone = zone;
									dataToInsert.sentence = sentence;
									dataToSearch.sentence = sentence;

									const length = (await this.collection?.getCount()) ?? 0;
									let index = length + 1;
									const searchResult =
										await this.collection?.search(dataToSearch);

									if (searchResult && searchResult.points.length > 0) {
										index = searchResult.points[0].id as number;
									}
									await this.collection?.addEmbedding(
										embedding,
										index,
										dataToInsert,
									);
								},
							);
						}

						await this.buildEmbeddingsFromMotivationSegments(
							decision,
							async (embedding: number[], zone: string, sentence: string) => {
								dataToInsert.zone = zone;
								dataToInsert.sentence = sentence;
								dataToSearch.sentence = sentence;

								const length = (await this.collection?.getCount()) ?? 0;
								let index = length + 1;
								const searchResult =
									await this.collection?.search(dataToSearch);

								if (searchResult && searchResult.points.length > 0) {
									index = searchResult.points[0].id as number;
								}
								await this.collection?.addEmbedding(
									embedding,
									index,
									dataToInsert,
								);
							},
						);
					} catch (error) {
						console.error(`Error processing decision ${decision.id}: ${error}`);
						processImportation = false;
						this.abortController.controller.abort();
						break;
					}

					if (this.abortController.controller.signal.aborted) {
						processImportation = false;
						break;
					}
				}
				decisionCumulCount += decitionsInDatabase.length;

				if (this.abortController.controller.signal.aborted) {
					processImportation = false;
				}
			}
		} catch (error) {
			console.error(
				`Error during decisions importation at ${currentIndex}: ${error}`,
			);
		}

		if (this.abortController.controller.signal.aborted) {
			console.log("Decision importation aborted.");
		} else {
			console.log("Decision importation terminated.");
		}
	}

	parseArticles(visa: Visa[]): string[] {
		return visa.map((article) => this.stripHTMLTags(article.title));
	}

	buildDate(date: string): string {
		const dateObject = new Date(date);
		const options: Intl.DateTimeFormatOptions = {
			year: "numeric",
			month: "long",
			day: "numeric",
		};

		return new Intl.DateTimeFormat("fr-FR", options).format(dateObject);
	}

	private buildDataToInsert(decision: JudilibreDecision): {
		dataToInsert: Record<string, string | object>;
		dataToSearch: Record<string, string>;
	} {
		const dataToInsert: Record<string, string | object> = {
			id: decision.id,
			date: decision.decisionDate,
			jurisdiction: decision.jurisdiction,
			chamber: decision.chamber || "",
			number: decision.number || "unknown",
		};
		const dataToSearch = {
			id: decision.id,
			date: decision.decisionDate,
			jurisdiction: decision.jurisdiction,
			chamber: decision.chamber || "",
			number: decision.number || "unknown",
		};

		if (decision.location) dataToInsert.location = decision.location as string;
		dataToInsert.themes =
			decision.themes && decision.themes.length > 0 ? decision.themes : [];

		dataToInsert.visas =
			decision.visas && decision.visas.length > 0 ? decision.visas : [];

		return { dataToInsert, dataToSearch };
	}

	private stripHTMLTags(input: string): string {
		let stripped = input.replace(/<\/?[^>]+(>|$)/g, "");
		stripped = stripped.replace(/R\.?\s/g, "R");
		stripped = stripped.replace(/D\.?\s/g, "D");
		stripped = stripped.replace(/L\.?\s/g, "L");
		return stripped;
	}

	private async prepareDatabases(): Promise<void> {
		await this.judilibreRepository.initializeDatabase();

		vectorManager.size = await this.embeddingInstance.getDimension();

		const collectionName = `judilibre_embeddings_${this.#jurisdiction}_${vectorManager.size}`;
		if (!(await vectorManager.collectionExists(collectionName))) {
			this.collection = await vectorManager.createCollection(collectionName);
		} else {
			this.collection = await vectorManager.getCollection(collectionName);
		}
	}

	private async prepareCacheDatabase(): Promise<void> {
		await this.judilibreRepository.initializeDatabase();
	}

	async retrieveJudilibreData<T>(judilibreUrl: string): Promise<T | undefined> {
		let response: Response | AxiosResponse<T>;
		response = await httpRequest<T>(judilibreUrl, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${await this.getJudilibreAuthorization()}`,
			},
		});

		if (response.status === 401) {
			removeEnv("judilibre_authorization");
			response = await httpRequest<T>(judilibreUrl, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${await this.getJudilibreAuthorization()}`,
				},
			});
		}
		if (response.status !== 200) {
			throw new Error(
				`Failed to fetch data from Judilibre API: ${response.status} - ${response.statusText}`,
			);
		}

		if (response instanceof Response) {
			const data = await response.json();
			return data as T;
		}

		return (response as AxiosResponse<T>).data;
	}

	private async invokeJudilibreExportation<T>(
		jurisdiction: Jurisdiction,
		block_index: number,
		block_size: number,
		end_date: Date,
	): Promise<T | undefined> {
		const endDate = end_date.toISOString().split("T")[0]; // Format date as YYYY-MM-DD
		const url = `https://api.piste.gouv.fr/cassation/judilibre/v1.0/export?jurisdiction=${jurisdiction}&batch=${block_index}&batch_size=${block_size}&date_end=${endDate}&resolve_references=true`;
		return await this.retrieveJudilibreData<T>(url);
	}

	private async invokeJudilibreDecision<T>(
		decisionAlias: string,
		withReferences = true,
	): Promise<T | undefined> {
		const url = `https://api.piste.gouv.fr/cassation/judilibre/v1.0/decision?id=${decisionAlias}&resolve_references=${withReferences}`;
		return await this.retrieveJudilibreData<T>(url);
	}

	private async getJudilibreAuthorization(): Promise<string> {
		let authorization = getEnvValue("judilibre_authorization");
		if (!authorization) {
			authorization = await connect_piste(
				"judilibre_client_id",
				"judilibre_client_secret",
			);
			setEnvValue("judilibre_authorization", authorization);
		}
		return authorization;
	}

	private async buildEmbeddingsFromMotivationSegments(
		decision: JudilibreDecision,
		addEmbedding: addEmbedding,
	): Promise<void> {
		if (!decision.motivations || decision.motivations.length === 0) {
			console.log("\t- index full text");
			await this.addEmbeddingsbySentences(decision.text, "text", addEmbedding);
			return;
		}

		for (const motivation of decision.motivations) {
			console.log(
				`\t- index motivation segment (${motivation.start},${motivation.end})`,
			);
			await this.addEmbeddingsbySentences(
				decision.text.substring(motivation.start, motivation.end),
				"motivations",
				addEmbedding,
			);
		}
	}

	private async addEmbeddingsbySentences(
		text: string,
		zone: string,
		addEmbedding: addEmbedding,
	): Promise<void> {
		let sentences: string[] = [];
		switch (zone) {
			case "motivations":
			case "summary":
				sentences = await splitTextWithtokens(text, CHUNK_SIZE);
				break;
			default:
				return;
		}

		const embeddings: number[][] =
			await this.embeddingInstance.embedBatch(sentences);

		for (let i = 0; i < sentences.length; i++) {
			const embedding = embeddings[i];
			const sentence = sentences[i];
			await addEmbedding(embedding, zone, shortenWithEllipsis(sentence));
		}
	}
}

export class JudilibreDecisionsQdrantReset {
	private jurisdiction: string;

	constructor(jurisdiction: string) {
		this.jurisdiction = jurisdiction;
	}

	async ImportQdrantReset(): Promise<void> {
		const collections = await vectorManager.getCollections();

		for (const collectionName of collections) {
			if (
				collectionName.startsWith(`judilibre_embeddings_${this.jurisdiction}`)
			) {
				await vectorManager.deleteCollection(collectionName);
			}
		}
	}
}

export class JudilibreDecisionsSqlReset {
	private jurisdiction: string;

	constructor(jurisdiction: string) {
		this.jurisdiction = jurisdiction;
	}

	async ImportSqlReset(): Promise<void> {
		const repository = new JudilibreRepository(this.jurisdiction);
		await repository.deleteTable();
	}
}
