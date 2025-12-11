import {
	type FeatureExtractionOutput,
	InferenceClient,
} from "@huggingface/inference";
import { getEnvValue, trySeveralTimes } from "../../../utils/environment";
import { Vector } from "../../vector/vectorUtils";
import { EmbeddingBase } from "./embeddingBase";

export class HfInferenceEmbedding extends EmbeddingBase {
	private model: string;
	private hfClient: InferenceClient;
	constructor(args: Record<string, unknown>) {
		super(args);
		this.model = getEnvValue("hugging_face_embedding_model") as string;
		const hfToken = getEnvValue("hugging_face_token") as string;
		this.hfClient = new InferenceClient(hfToken);
	}

	async embed(text: string): Promise<number[]> {
		const result = await trySeveralTimes<FeatureExtractionOutput>(
			async () =>
				await this.hfClient.featureExtraction({
					model: this.model,
					inputs: text,
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
			throw new Error(
				"Invalid embedding response from Hugging Face Inference API",
			);
		}
		return embedding;
	}

	async embedBatch(texts: string[]): Promise<Array<number[]>> {
		const embeddings: Array<number[]> = [];
		for (const text of texts) {
			const embedding = await this.embed(text);
			embeddings.push(embedding);
		}
		return embeddings;
	}

	async getDimension(): Promise<number> {
		const result = await this.hfClient.featureExtraction({
			model: this.model,
			inputs: "test",
			provider: "hf-inference",
		});

		let size = 0;
		if (Array.isArray(result) && result.length > 0) {
			if (Array.isArray(result[0])) {
				size = (result[0] as number[]).length;
			} else {
				size = result.length;
			}
		} else {
			throw new Error(
				"Invalid embedding response from Hugging Face Inference API",
			);
		}
		return size;
	}
}
