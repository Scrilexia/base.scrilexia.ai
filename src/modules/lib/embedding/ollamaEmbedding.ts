import ollama from "ollama";
import { getEnvValue } from "../../../utils/environment";
import { EmbeddingBase } from "./embeddingBase";

export class OllamaEmbedding extends EmbeddingBase {
	private model: string;
	constructor(args: Record<string, unknown>) {
		super(args);
		this.model = getEnvValue("ollama_embedding_model") as string;
	}

	async embed(text: string): Promise<number[]> {
		// Implement the embedding logic using Ollama API
		const response = await ollama.embed({
			model: this.model,
			input: text,
		});
		return response.embeddings[0];
	}

	async getDimension(): Promise<number> {
		const response = await ollama.embed({
			model: this.model,
			input: "test",
		});
		return response.embeddings[0].length;
	}
}
