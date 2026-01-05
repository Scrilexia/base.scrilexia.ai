import * as fs from "node:fs";
import { Mistral } from "@mistralai/mistralai";
import type {
	AssistantMessage,
	CompletionJobOut,
	SystemMessage,
	ToolMessage,
	UserMessage,
} from "@mistralai/mistralai/models/components";
import { getEnvValue, trySeveralTimes } from "../src/utils/environment";

type MistralMessage =
	| (SystemMessage & {
			role: "system";
	  })
	| (ToolMessage & {
			role: "tool";
	  })
	| (UserMessage & {
			role: "user";
	  })
	| (AssistantMessage & {
			role: "assistant";
	  });

const executeCreation = async (): Promise<void> => {
	const apiKey = getEnvValue("mistral_api_key");
	if (!apiKey) {
		throw new Error("Mistral API key is not set");
	}
	const client = new Mistral({ apiKey: apiKey });

	const files = await client.files.list();
	const scrilexiaAllTrainingFile = files.data.find(
		(file) => file.filename === "scrilexia-all.jsonl",
	);
	const scrilexiaDecisionsTrainingFile = files.data.find(
		(file) => file.filename === "scrilexia-decisions.jsonl",
	);
	const scrilexiaDroitCivilTrainingFile = files.data.find(
		(file) => file.filename === "scrilexia-droit-civil.jsonl",
	);

	if (
		!scrilexiaAllTrainingFile ||
		!scrilexiaDecisionsTrainingFile ||
		!scrilexiaDroitCivilTrainingFile
	) {
		throw new Error("Required training files are not found");
	}

	const trainFileSizeMB =
		(scrilexiaAllTrainingFile.sizeBytes +
			scrilexiaDecisionsTrainingFile.sizeBytes +
			scrilexiaDroitCivilTrainingFile.sizeBytes) /
		(1024 * 1024);
	console.log(`Total training file size: ${trainFileSizeMB.toFixed(2)} MB`);
	const createdJob = (await client.fineTuning.jobs.create({
		model: "mistral-medium-latest",
		trainingFiles: [
			{ fileId: scrilexiaAllTrainingFile.id, weight: 1.5 },
			{ fileId: scrilexiaDecisionsTrainingFile.id, weight: 1 },
			{ fileId: scrilexiaDroitCivilTrainingFile.id, weight: 10.0 },
		],
		validationFiles: [],
		hyperparameters: {
			trainingSteps: Math.floor(trainFileSizeMB),
			learningRate: 0.00001,
		},
		autoStart: false,
	})) as CompletionJobOut;

	const jobStatus = await client.fineTuning.jobs.get({ jobId: createdJob.id });

	console.log(`Created training job${JSON.stringify(jobStatus, null, 2)}`);
};

await executeCreation();
