import {
	EmbeddingProviders,
	createEmbedding,
} from "../src/modules/lib/embedding/provider";
import { setCurrentDirectory } from "../src/utils/environment";

const execute = async () => {
	setCurrentDirectory();
	const embedding = createEmbedding(EmbeddingProviders.Ollama, {});
	const result = await embedding.embed("This is a test embedding.");
	return result;
};

execute()
	.then((data) => {
		console.log("Ollama embedding instance created successfully.");
	})
	.catch((error) => {
		console.error("Error creating Ollama embedding instance:", error);
	});
