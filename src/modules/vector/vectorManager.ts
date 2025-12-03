import { getEnvValue, trySeveralTimes } from "../../utils/environment";
import { Collection } from "./collection";
import type { QdrantClientInterface } from "./params";

class VectorManager {
	#client!: QdrantClientInterface;
	#initialized: boolean;
	#size = 768;

	constructor() {
		this.#initialized = false;
	}

	isInitialized(): boolean {
		return this.#initialized;
	}

	get size(): number {
		return this.#size;
	}

	set size(value: number) {
		this.#size = value;
	}

	async initialize() {
		if (this.#initialized) {
			return;
		}
		this.#client = await this.#createQdrantClient();

		this.#initialized = true;
	}

	async createCollection(collectionName: string): Promise<Collection> {
		if (!this.#initialized) {
			await this.initialize();
		}

		await trySeveralTimes<void>(async () => {
			await this.#client.createCollection(collectionName, {
				vectors: {
					// Specify the embedding configuration here
					size: this.#size,
					distance: "Cosine",
				},
			});
		});

		return new Collection(this.#client, collectionName);
	}

	async deleteCollection(collectionName: string): Promise<void> {
		if (!this.#initialized) {
			await this.initialize();
		}

		await trySeveralTimes<void>(async () => {
			await this.#client.deleteCollection(collectionName);
		});
	}

	async getCollection(collectionName: string): Promise<Collection> {
		if (!this.#initialized) {
			await this.initialize();
		}

		try {
			return new Collection(this.#client, collectionName);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Collection not found")
			) {
				throw new Error(`Collection ${collectionName} does not exist.`);
			}
			throw error; // Re-throw unexpected errors
		}
	}

	async getCollections(): Promise<string[]> {
		if (!this.#initialized) {
			await this.initialize();
		}

		try {
			const collections = (await trySeveralTimes<unknown>(async () => {
				return await this.#client.getCollections();
			})) as { collections: { name: string }[] };

			return collections.collections.map((col) => col.name);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Collection not found")
			) {
				throw new Error("No collections exist.");
			}
			throw error; // Re-throw unexpected errors
		}
	}

	async collectionExists(collectionName: string): Promise<boolean> {
		if (!this.#initialized) {
			await this.initialize();
		}

		try {
			const retValue = await trySeveralTimes<{ exists: boolean }>(async () => {
				return await this.#client.collectionExists(collectionName);
			});

			return retValue.exists;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("Collection not found")
			) {
				return false;
			}
			throw error; // Re-throw unexpected errors
		}
	}

	async #createQdrantClient(): Promise<QdrantClientInterface> {
		const { QdrantClient } = await import("@qdrant/js-client-rest");
		const qdrantPort = getEnvValue("qdrant_port");
		if (!qdrantPort) {
			throw new Error("Qdrant port is not defined in environment variables");
		}
		const qdrantUrl = getEnvValue("qdrant_url");
		if (!qdrantUrl) {
			throw new Error("Qdrant host is not defined in environment variables");
		}
		const apiKey = getEnvValue("qdrant_api_key");
		if (!apiKey) {
			throw new Error("Qdrant API key is not defined in environment variables");
		}

		return new QdrantClient({
			url: qdrantUrl,
			port: Number.parseInt(qdrantPort),
			apiKey: apiKey,
		}) as QdrantClientInterface;
	}
}

export default new VectorManager();
