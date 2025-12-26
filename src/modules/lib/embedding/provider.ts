import { HfInferenceEmbedding } from "./hfInferenceEmbedding.js";
import { OllamaEmbedding } from "./ollamaEmbedding.js";

export enum EmbeddingProviders {
	HuggingFaceInference = "hugging_face_inference",
	Ollama = "ollama",
}

export function createEmbedding(
	provider: EmbeddingProviders,
	args: Record<string, unknown>,
) {
	switch (provider) {
		case EmbeddingProviders.HuggingFaceInference: {
			return new HfInferenceEmbedding(args);
		}
		case EmbeddingProviders.Ollama: {
			return new OllamaEmbedding(args);
		}
		default:
			throw new Error(`Unsupported embedding provider: ${provider}`);
	}
}
