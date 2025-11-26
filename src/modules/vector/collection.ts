import { trySeveralTimes } from "../../utils/environment";
import type { QdrantResult, QdrantSearchCriteria } from "./params";
import type { QdrantClientInterface } from "./params";

export class Collection {
	#client: QdrantClientInterface;
	#collectionName: string;
	#index: number;

	constructor(client: QdrantClientInterface, collectionName: string) {
		this.#client = client;
		this.#collectionName = collectionName;
		this.#index = 1;
	}

	async addEmbedding(
		embeddings: number[],
		index: number,
		params: Record<string, unknown> = {},
	): Promise<void> {
		if (!this.#client) {
			throw new Error("Qdrant client is not initialized");
		}

		await trySeveralTimes<void>(async () => {
			await this.#client.upsert(this.#collectionName, {
				points: [
					{
						id: index,
						vector: embeddings, // Use array directly for single vector
						payload: params,
					},
				],
				wait: true,
				ordering: "weak",
			});
		});
	}

	async searchByAlias(alias: string): Promise<QdrantResult> {
		if (!this.#client) {
			throw new Error("Qdrant client is not initialized");
		}

		const result = await trySeveralTimes<QdrantResult>(async () => {
			return await this.#client.query(this.#collectionName, {
				filter: {
					must: [
						{
							key: "alias",
							match: { value: alias },
						},
					],
				},
				limit: 20,
				with_payload: true,
				with_vector: false,
			});
		});

		return result;
	}

	async searchByVector(
		vector: number[],
		criteria: Array<QdrantSearchCriteria>,
		limit = 20,
	): Promise<QdrantResult> {
		if (!this.#client) {
			throw new Error("Qdrant client is not initialized");
		}

		const result = await trySeveralTimes<QdrantResult>(async () => {
			return await this.#client.query(this.#collectionName, {
				query: vector,
				limit: limit,
				with_payload: true,
				with_vector: false,
				filter: {
					must: criteria.map((item) => ({
						key: item.key,
						match: { value: item.value },
					})),
				},
			});
		});

		return result;
	}

	async getCount(): Promise<number> {
		if (!this.#client) {
			throw new Error("Qdrant client is not initialized");
		}

		const result = await trySeveralTimes<{ count: number }>(async () => {
			return await this.#client.count(this.#collectionName);
		});

		return result.count;
	}
}
