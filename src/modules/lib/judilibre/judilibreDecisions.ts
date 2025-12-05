import {
	type FeatureExtractionOutput,
	InferenceClient,
} from "@huggingface/inference";
import type { AxiosResponse } from "axios";
import e from "express";
import {
	CHUNK_SIZE,
	Codes,
	DECISIONS_BLOCKS_COUNT,
	DECISIONS_BLOCK_SIZE,
} from "../../../types/constants";
import type { Abort } from "../../../utils/abortController";
import {
	connect_piste,
	getEnvValue,
	httpRequest,
	removeEnv,
	setEnvValue,
	shortenWithEllipsis,
	splitTextWithtokens,
	trySeveralTimes,
} from "../../../utils/environment";
import type { Collection } from "../../vector/collection";
import vectorManager from "../../vector/vectorManager";
import { Vector } from "../../vector/vectorUtils";
import { judilibreRepository } from "./judilibreRepository";
import type { JudiDecision, Jurisdiction, Visa } from "./judilibreTypes";

type addEmbedding = (
	embedding: number[],
	zone: string,
	sentence: string,
) => Promise<void>;

export class JudilibreDecisions {
	#jurisdiction: Jurisdiction;
	#endDate: Date;
	private hfToken: string | null = null;
	private hfModel: string | null = null;
	private collection: Collection | null = null;
	private abortController: Abort;
	private oldestDecisionDate: Date;

	constructor(
		jurisdiction: Jurisdiction,
		endDate: Date,
		abortController: Abort,
	) {
		this.#jurisdiction = jurisdiction;
		this.#endDate = endDate;

		this.oldestDecisionDate = endDate;
		this.abortController = abortController;
	}

	async addDecisions(): Promise<void> {
		let blockIndex = 0;
		const blockSize = DECISIONS_BLOCK_SIZE;
		const blocksCount = DECISIONS_BLOCKS_COUNT;
		this.oldestDecisionDate = this.#endDate;
		this.prepareDatabases();
		const data = await this.invokeJudilibreExportation<Record<string, unknown>>(
			this.#jurisdiction,
			0,
			1,
			this.oldestDecisionDate,
		);

		if (!data || !("total" in data)) {
			throw new Error("Invalid response from Judilibre API");
		}

		const totalDecisions = data.total as number;
		if (totalDecisions === 0) {
			throw new Error(
				`No decisions to add for jurisdiction:${this.#jurisdiction}`,
			);
		}

		try {
			let processImportation = true;
			let decisionCumulCount = 0;

			let errorsCount = 0;
			while (processImportation) {
				const data = await this.invokeJudilibreExportation<
					Record<string, unknown>
				>(this.#jurisdiction, 0, 1, this.oldestDecisionDate);

				if (!data || !("total" in data)) {
					throw new Error("Invalid response from Judilibre API");
				}

				const total = data.total as number;
				if (total === 0) {
					processImportation = false;
					break;
				}

				let currentIndex = 0;
				for (blockIndex = 0; blockIndex < blocksCount; blockIndex++) {
					const data = await this.invokeJudilibreExportation<
						Record<string, unknown>
					>(this.#jurisdiction, blockIndex, blockSize, this.oldestDecisionDate);

					if (!data || !("results" in data)) {
						console.error(
							"Invalid data format received for block index:",
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
						currentIndex++;

						console.log(
							`decision ${decisionCumulCount + currentIndex}/${totalDecisions}: ${decision.id} - ${decision.location ?? decision.jurisdiction}, ${decision.chamber} du ${this.buildDate(decision.decision_date)} n°${decision.number}`,
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

						const { dataToInsert, dataToSearch } =
							this.buildDataToInsert(decision);

						try {
							if (decision.summary && decision.summary.trim() !== "") {
								await this.addEmbeddingsbySentences(
									decision.summary,
									"summary",
									async (
										embedding: number[],
										zone: string,
										sentence: string,
									) => {
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

							await this.buildEmbeddingsFromTextZoneSegments(
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

							try {
								await judilibreRepository.create({
									id: decision.id,
									jurisdiction: decision.jurisdiction,
									location: decision.location ?? decision.jurisdiction,
									chamber: decision.chamber,
									number: decision.number,
									decisionDate: decision.decision_date,
									type: decision.type,
									text: decision.text,
									motivations: decision.zones?.motivations ?? [],
									solution: decision.solution,
									summary: decision.summary || "",
								});
							} catch (error) {
								await judilibreRepository.update({
									id: decision.id,
									jurisdiction: decision.jurisdiction,
									location: decision.location ?? decision.jurisdiction,
									chamber: decision.chamber,
									number: decision.number,
									decisionDate: decision.decision_date,
									type: decision.type,
									text: decision.text,
									motivations: decision.zones?.motivations ?? [],
									solution: decision.solution,
									summary: decision.summary || "",
								});
							}

							this.oldestDecisionDate = new Date(decision.decision_date);
						} catch (error) {
							console.error(
								`Error processing decision ${decision.id}: ${error}`,
							);
							if (errorsCount < 10) {
								errorsCount++;
								continue;
							}

							console.error(
								"Too many errors encountered. Aborting importation.",
							);
							processImportation = false;
							this.abortController.controller.abort();
							break;
						}

						if (this.abortController.controller.signal.aborted) {
							console.log("Decisions importation aborted.");
							processImportation = false;
							break;
						}
					}

					if (this.abortController.controller.signal.aborted) {
						processImportation = false;
						break;
					}
				}

				if (this.abortController.controller.signal.aborted) {
					processImportation = false;
				}

				decisionCumulCount += 10000;
			}
		} catch (error) {
			console.error(
				`Error during decisions importation at ${blockIndex}: ${error}`,
			);
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

	private buildDataToInsert(decision: JudiDecision): {
		dataToInsert: Record<string, string | object>;
		dataToSearch: Record<string, string>;
	} {
		const dataToInsert: Record<string, string | object> = {
			id: decision.id,
			date: decision.decision_date,
			jurisdiction: decision.jurisdiction,
			chamber: decision.chamber,
			number: decision.number,
		};
		const dataToSearch = {
			id: decision.id,
			date: decision.decision_date,
			jurisdiction: decision.jurisdiction,
			chamber: decision.chamber,
			number: decision.number,
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
		await judilibreRepository.initializeDatabase(this.#jurisdiction);

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

		const collectionName = `judilibre_embeddings_${this.#jurisdiction}_${vectorManager.size}`;
		if (!(await vectorManager.collectionExists(collectionName))) {
			this.collection = await vectorManager.createCollection(collectionName);
		} else {
			this.collection = await vectorManager.getCollection(collectionName);
		}
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

	private async buildEmbeddingsFromTextZoneSegments(
		decision: JudiDecision,
		addEmbedding: addEmbedding,
	): Promise<void> {
		if (!decision.zones || Object.keys(decision.zones).length === 0) {
			await this.addEmbeddingsbySentences(decision.text, "text", addEmbedding);
			return;
		}

		for (const [key, value] of Object.entries(decision.zones)) {
			if (!value || value.length === 0) {
				continue;
			}

			for (const textZone of value) {
				await this.addEmbeddingsbySentences(
					decision.text.substring(textZone.start, textZone.end),
					key,
					addEmbedding,
				);
			}
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

		for (const chunk of sentences) {
			const hf = new InferenceClient(this.hfToken as string);
			const result = await trySeveralTimes<FeatureExtractionOutput>(
				async () =>
					await hf.featureExtraction({
						model: this.hfModel as string,
						inputs: chunk,
						provider: "hf-inference",
					}),
			);

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
				console.warn("No embedding generated chunk skipped.");
				continue;
			}
			await addEmbedding(embedding, zone, shortenWithEllipsis(chunk));
		}
	}
}

export class JudilibreDecisionsReset {
	private abortController: Abort;

	constructor(abortController: Abort) {
		this.abortController = abortController;
	}
	async resetArticles(): Promise<void> {
		const collections = await vectorManager.getCollections();
		for (const collectionName of collections) {
			if (collectionName.startsWith("judilibre_embeddings_")) {
				await vectorManager.deleteCollection(collectionName);
			}
		}

		await judilibreRepository.deleteTable();
	}
}
