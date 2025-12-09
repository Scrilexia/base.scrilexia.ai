import {
	EmbeddingProviders,
	createEmbedding,
} from "../src/modules/lib/embedding/provider";
import { Vector } from "../src/modules/vector/vectorUtils";
import { setCurrentDirectory } from "../src/utils/environment";
import { cosineSimilarity } from "../src/utils/similarity";

const execute = async () => {
	setCurrentDirectory();
	const embeddingOllama = createEmbedding(EmbeddingProviders.Ollama, {});
	const embeddingHf = createEmbedding(
		EmbeddingProviders.HuggingFaceInference,
		{},
	);

	const resultHf = await embeddingHf.embed("This is a test embedding.");
	const resultOllama = await embeddingOllama.embed("This is a test embedding.");

	const vectorHf = new Vector(resultHf);
	const vectorOllama = new Vector(resultOllama);

	vectorHf.normalize();
	vectorOllama.normalize();

	return {
		resultHf: vectorHf.vector,
		resultOllama: vectorOllama.vector,
		cosineSimilarity: cosineSimilarity(vectorHf.vector, vectorOllama.vector),
	};
};

execute()
	.then((data) => {
		console.log("cosineSimilarity:", data.cosineSimilarity);
	})
	.catch((error) => {
		console.error("Error creating Ollama embedding instance:", error);
	});
