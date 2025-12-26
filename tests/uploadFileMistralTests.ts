import * as fs from "node:fs";
import { Mistral } from "@mistralai/mistralai";
import { getEnvValue } from "../src/utils/environment.js";

const executeMistralTest = async () => {
	const apiKey = getEnvValue("mistral_api_key");
	if (!apiKey) {
		throw new Error("Mistral API key is not set");
	}
	const client = new Mistral({ apiKey: apiKey });

	const training_file = fs.readFileSync("./input/articles-et-lois.jsonl");
	const training_data = await client.files.upload({
		file: {
			fileName: "articles-et-lois.jsonl",
			content: training_file,
		},
	});

	return training_data;
};
