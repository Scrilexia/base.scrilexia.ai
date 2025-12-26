import { writeFileSync } from "node:fs";
import { getEnvValue } from "../src/utils/environment.js";
import { generateToken } from "../src/utils/token.js";

const buildTrainingFileDataset = async (codeName: string, isLocal: boolean) => {
	const secret = getEnvValue("token_secret");
	if (!secret) {
		throw new Error("Environment variable 'token_secret' is not set");
	}

	const password = getEnvValue("token_password");
	if (!password) {
		throw new Error("Environment variable 'token_password' is not set");
	}

	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

	try {
		const response = await fetch(
			isLocal
				? "http://localhost:4310/api/articles/train"
				: "https://app0.scrilexia.ai:4310/api/articles/train",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${generateToken(secret, password, 60 * 60 * 1000) ?? ""}`,
				},
				body: JSON.stringify({ codes: Array.of(codeName) }),
			},
		);

		if (!response) {
			throw new Error("No response from server");
		}

		if (response.status !== 200) {
			throw new Error(
				`Server returned status ${response.status}: ${response.statusText}`,
			);
		}

		return await response.text();
	} catch (error) {
		console.error("Error:", error);
		throw error;
	}
};

const codeName = process.argv[2] ?? "";
const isLocal = process.argv.includes("--local");
const result = await buildTrainingFileDataset(codeName, isLocal);
const buffer = Buffer.from(result ?? "", "utf-8");
const jsonlFilePath = `./output/${codeName.replaceAll(" ", "-")}.jsonl`;
writeFileSync(jsonlFilePath, buffer);
console.log(`Training dataset saved to ${jsonlFilePath}`);
