import { writeFileSync } from "node:fs";
import { getEnvValue } from "../src/utils/environment.js";
import { generateToken } from "../src/utils/token.js";
import { fetch, Agent } from "undici";

const buildTrainingFileDataset = async (isLocal: boolean) => {
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
		const agent = new Agent({
			connect: { timeout: 0 }, // 0 = illimité
			headersTimeout: 0, // illimité
			bodyTimeout: 0, // illimité
		});

		const response = await fetch(
			isLocal
				? "http://localhost:4310/api/decisions/train/summaries"
				: "https://app0.scrilexia.ai:4310/api/decisions/train/summaries",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${generateToken(secret, password, 60 * 60 * 1000) ?? ""}`,
				},
				body: JSON.stringify({ jurisdiction: "cc" }),
				dispatcher: agent,
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

const isLocal = process.argv.includes("--local");
const result = await buildTrainingFileDataset(isLocal);
const buffer = Buffer.from(result ?? "", "utf-8");
const jsonlFilePath = "./output/decisions-summaries-cc.jsonl";
writeFileSync(jsonlFilePath, buffer);
console.log(`Training dataset saved to ${jsonlFilePath}`);
