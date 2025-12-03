import {
	type FeatureExtractionOutput,
	InferenceClient,
} from "@huggingface/inference";
import type { AxiosResponse } from "axios";
import { CHUNK_SIZE, DECISIONS_BLOCK_SIZE } from "../../../types/constants";
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
import type { JudiDecision, Jurisdiction } from "./judilibreTypes";
import { judilibreRepository } from "./judilibreRepository";

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

	constructor(
		jurisdiction: Jurisdiction,
		endDate: Date,
		abortController: Abort,
	) {
		this.#jurisdiction = jurisdiction;
		this.#endDate = endDate;
		this.abortController = abortController;
	}

	async addDecisions(): Promise<void> {
		let blockIndex = 0;
		const blockSize = DECISIONS_BLOCK_SIZE;
		this.prepareDatabases();

		try {
			const data = await this.invokeJudilibreExportation<
				Record<string, unknown>
			>(this.#jurisdiction, 0, 1, this.#endDate);

			if (!data || !("total" in data)) {
				throw new Error("Invalid response from Judilibre API");
			}

			const totalDecisions = data.total as number;
			if (totalDecisions === 0) {
				console.error(
					"No decisions to add for jurisdiction:",
					this.#jurisdiction,
				);
				return;
			}

			const totalBlocks = Math.ceil(totalDecisions / blockSize);
			let currentIndex = 0;
			for (
				blockIndex = 0;
				blockIndex < Math.min(totalBlocks, 10);
				blockIndex++
			) {
				const data = await this.invokeJudilibreExportation<
					Record<string, unknown>
				>(this.#jurisdiction, blockIndex, blockSize, this.#endDate);

				if (!data || !("results" in data)) {
					console.error(
						"Invalid data format received for block index:",
						blockIndex,
					);
					continue;
				}
				const decisions = data.results as JudiDecision[];
				if (!decisions || decisions.length === 0) {
					console.warn(
						"No decisions found for block index:",
						blockIndex,
						"Jurisdiction:",
						this.#jurisdiction,
					);
					continue;
				}

				for (const decision of decisions) {
					currentIndex++;

					console.log(
						`decision ${currentIndex}/${totalDecisions}: ${decision.id} - ${decision.location ?? decision.jurisdiction}, ${decision.chamber} du ${this.buildDate(decision.decision_date)} n°${decision.number}`,
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

					if (decision.summary && decision.summary.trim() !== "") {
						await this.addEmbeddingsbySentences(
							decision.summary,
							"summary",
							async (embedding: number[], zone: string, sentence: string) => {
								const { dataToInsert, dataToSearch } = this.buildDataToInsert(
									decision,
									zone,
									sentence,
								);

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
							const { dataToInsert, dataToSearch } = this.buildDataToInsert(
								decision,
								zone,
								sentence,
							);

							const length = (await this.collection?.getCount()) ?? 0;
							let index = length + 1;
							const searchResult = await this.collection?.search(dataToSearch);

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
							location: decision.location,
							chamber: decision.chamber,
							number: decision.number,
							decisionDate: decision.decision_date,
							type: decision.type,
							solution: decision.solution,
							summary: decision.summary,
							themes: decision.themes,
							visas: decision.visas.map((visa) => visa.title),
						});
					} catch (error) {
						await judilibreRepository.update({
							id: decision.id,
							jurisdiction: decision.jurisdiction,
							location: decision.location,
							chamber: decision.chamber,
							number: decision.number,
							decisionDate: decision.decision_date,
							type: decision.type,
							solution: decision.solution,
							summary: decision.summary,
							themes: decision.themes,
							visas: decision.visas.map((visa) => visa.title),
						});
					}

					if (this.abortController.controller.signal.aborted) {
						console.log("Decisions importation aborted.");
						break;
					}
				}

				if (this.abortController.controller.signal.aborted) {
					break;
				}
			}
		} catch (error) {
			console.error(
				`Error during decisions importation at ${blockIndex}: ${error}`,
			);
		}
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

	private buildDataToInsert(
		decision: JudiDecision,
		zone: string,
		sentence: string,
	): {
		dataToInsert: Record<string, string | object>;
		dataToSearch: Record<string, string>;
	} {
		const dataToInsert: Record<string, string | object> = {
			id: decision.id,
			date: decision.decision_date,
			jurisdiction: decision.jurisdiction,
			chamber: decision.chamber,
			number: decision.number,
			zone: zone,
			sentence: sentence,
		};
		const dataToSearch = {
			id: decision.id,
			date: decision.decision_date,
			jurisdiction: decision.jurisdiction,
			chamber: decision.chamber,
			number: decision.number,
			sentence: sentence,
		};

		if (decision.location) dataToInsert.location = decision.location as string;
		if (decision.themes && decision.themes.length > 0)
			dataToInsert.themes = decision.themes as string[];
		if (decision.summary) {
			dataToInsert.summary = decision.summary as string;
		} else if (decision.titlesAndSummaries.length > 0) {
			dataToInsert.summary = decision.titlesAndSummaries[0].summary;
		}
		if (decision.visas && decision.visas.length > 0)
			dataToInsert.visas = decision.visas.map((visa) => visa.title);

		return { dataToInsert, dataToSearch };
	}

	private async prepareDatabases(): Promise<void> {
		await judilibreRepository.initializeDatabase();

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

		const collectionName = `judilibre_embeddings_${vectorManager.size}`;
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
