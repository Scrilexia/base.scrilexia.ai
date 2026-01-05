import * as fs from "node:fs";
import { Mistral } from "@mistralai/mistralai";
import type {
	AssistantMessage,
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

const extractSections = async (
	textMarkdown: string,
): Promise<Array<{ question: string; content: string }>> => {
	let remain = textMarkdown;
	const sections = Array<{ question: string; content: string }>();
	while (remain.length > 0) {
		const regex = /^#{2,}\s+.+$/m;
		const match = remain.match(regex);

		if (!match || match.index === undefined) {
			break;
		}

		const startIndex = match.index + match[0].length;
		let endIndex = remain.length;
		const nextRegex = /^#{2,}/m;
		const nextMatch = matchAfterIndex(remain, nextRegex, startIndex);
		if (nextMatch && nextMatch.index !== undefined) {
			endIndex = nextMatch.index;
		}

		const content = remain.substring(startIndex, endIndex).trim();
		if (content.length > 0) {
			const question = await trySeveralTimes(
				() => executeCourse(content),
				3,
				1000,
			);
			sections.push({
				question: removeForbiddenCharacters(question.data),
				content: removeForbiddenCharacters(content),
			});
		}

		remain = remain.substring(endIndex - 1);
	}

	return sections;
};

const executeCourse = async (
	textMarkdown: string,
): Promise<{
	data: string;
}> => {
	const resumeMessagesProps = Array<MistralMessage>();
	resumeMessagesProps.push({
		role: "system",
		content: `A partir de ce texte, Tu dois me formuler une question dont la réponse doit être le contenu du texte.
Tu dois reponse uniquement avec la question formulée, sans aucun autre texte. La question finit toujours par un point d'interrogation ?
Elle doit être claire et précise car elle est destinée à être utilisée dans un contexte éducatif pour l'entraînement de LLM.`,
	});

	const apiKey = getEnvValue("mistral_api_key");
	if (!apiKey) {
		throw new Error("Mistral API key is not set");
	}

	const mistralModel = getEnvValue("mistral_model");
	if (!mistralModel) {
		throw new Error("Mistral model key is not set");
	}

	resumeMessagesProps.push({
		role: "user",
		content: `Texte à analyser : ${textMarkdown}`,
	});
	const client = new Mistral({
		apiKey: apiKey,
	});

	const result = await client.chat.stream({
		model: mistralModel,
		messages: resumeMessagesProps,
		stream: true,
		temperature: 0.1,
	});

	let resumeResponse = "";
	const logo: string[] = ["\\", "|", "/", "-"];
	let logoIndex = 0;
	for await (const chunk of result) {
		const streamText = chunk.data.choices[0].delta.content;
		if (typeof streamText === "string") {
			process.stdout.write(`${logo[logoIndex++ % logo.length]}\r`);
			resumeResponse += streamText;
		}
	}

	return { data: resumeResponse };
};

function removeForbiddenCharacters(text: string): string {
	return (
		text
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/\u0000/g, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/\u0007/g, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/\u0008/g, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/\u0009/g, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/\u000A/g, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/\u000B/g, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/\u000C/g, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
			.replace(/\u000D/g, "")
			.replaceAll('"', "ˮ")
			.replaceAll("'", "ʹ")
	);
}

function matchAfterIndex(
	text: string,
	regex: RegExp,
	index: number,
): { match: string; index: number } | null {
	const sliced = text.slice(index);
	const localRegex = new RegExp(regex.source, regex.flags.replace("g", ""));
	const match = sliced.match(localRegex);
	if (!match || match.index === undefined) return null;

	return {
		match: match[0],
		index: index + match.index,
	};
}

const filePath = process.argv[2] ?? "";
if (!filePath) {
	throw new Error("Please provide a file path as an argument");
}

const bufferRead = fs.readFileSync(filePath);
const textMarkdown = bufferRead.toString("utf-8");
const results = await extractSections(textMarkdown);
const resultLines: string[] = results.map((result) => {
	return `{"messages":[{"role":"user","content":"${result.question}"},{"role":"assistant","content":"${removeForbiddenCharacters(
		result.content,
	).replace(/\\/g, "")}"}]}`;
});

const index = filePath.lastIndexOf(".");
const jsonlFilePath = `${index !== -1 ? filePath.substring(0, index) : filePath}.jsonl`;
const buffer = Buffer.from(resultLines.join("\n"), "utf-8");
fs.writeFileSync(jsonlFilePath, buffer);
console.log(`Training dataset saved to ${jsonlFilePath}`);
