import ollama, { Ollama } from "ollama";
import { getEnvValue } from "../../../utils/environment.js";
import { EmbeddingBase } from "./embeddingBase.js";

export class OllamaEmbedding extends EmbeddingBase {
	private model: string;
	private client: Ollama;

	constructor(args: Record<string, unknown>) {
		super(args);
		this.model = getEnvValue("ollama_embedding_model") as string;
		const host = getEnvValue("ollama_host") as string;
		const port = getEnvValue("ollama_port") as string;
		this.client = new Ollama({ host: `${host}:${port}` });
	}

	async embed(text: string): Promise<number[]> {
		// Implement the embedding logic using Ollama API
		const response = await this.client.embed({
			model: this.model,
			input: text,
		});
		return response.embeddings[0];
	}

	async embedBatch(texts: string[]): Promise<Array<number[]>> {
		const response = await this.client.embed({
			model: this.model,
			input: texts,
		});
		return response.embeddings;
	}

	async getDimension(): Promise<number> {
		const response = await this.client.embed({
			model: this.model,
			input: "test",
		});
		return response.embeddings[0].length;
	}
}
