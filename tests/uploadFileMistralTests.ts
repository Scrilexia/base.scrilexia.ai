import * as fs from "node:fs";
import path from "node:path";
import { Mistral } from "@mistralai/mistralai";
import { getEnvValue } from "../src/utils/environment.js";

const executeMistralTest = async (filePath: string) => {
	const apiKey = getEnvValue("mistral_api_key");
	if (!apiKey) {
		throw new Error("Mistral API key is not set");
	}
	const client = new Mistral({ apiKey: apiKey });

	const training_file = fs.readFileSync(filePath);
	const training_data = await client.files.upload({
		file: {
			fileName: path.basename(filePath),
			content: training_file,
		},
	});

	return training_data;
};

try {
	const training_data = await executeMistralTest(process.argv[2]);
	console.log("Training data uploaded:");
	console.log(`ID: ${training_data.id}`);
	console.log(`Filename: ${training_data.filename}`);
	console.log(`Purpose: ${training_data.purpose}`);
	console.log(`Size (bytes): ${training_data.sizeBytes}`);
} catch (error) {
	console.error("Error during Mistral upload:", error);
}
