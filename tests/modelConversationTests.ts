import * as fs from "node:fs";
import { Mistral } from "@mistralai/mistralai";
import type {
	AssistantMessage,
	SystemMessage,
	ToolMessage,
	UserMessage,
} from "@mistralai/mistralai/models/components";
import { getEnvValue } from "../src/utils/environment";

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

const executeCourse = async (filePath: string): Promise<string> => {
	const dataBuffer = fs.readFileSync(filePath);
	const textMarkdown = dataBuffer.toString("utf-8");

	const resumeMessagesProps = Array<MistralMessage>();
	resumeMessagesProps.push({
		role: "system",
		content: `A partir de ce texte, tu me fabriques un fichier jsonl dans ce format:
{"messages":[{"role":"user","content":"User message n°1"},{"role":"assistant","content":"Bot message n°1"}]}
{"messages":[{"role":"user","content":"User message n°2"},{"role":"assistant","content":"Bot message n°2"}]}
...
il n'y a pas de passage à la ligne entre chaque objet json.
'User message' contient une question basé sur les titres et sous-titres. La réponse à cette question doit être 'Bot message' (exemple :
pour 'THEME 1. LE MARIAGE, Chapitre 1. La formation du mariage, Section 1. Les conditions de fond, A) Les conditions physiologiques, Age', le message sera : quel est l'âge minimum pour le mariage?).
'Bot message' contient le texte intégral de la section (brut), sans passage à la ligne. (exemple :
- Principe : 18 ans (art. 144)- Exception : le proc. du lieu de célébration peut accorder des dispenses d’âge pour motifsgraves + le mineur doit obtenir l’autorisation de ses parents ou d’un seul (art. 148) et si pas deparents, aïeux (art. 150) et à défaut de membre de la famille, conseil de famille (art. 159).Cette autorisation spéciale (ne vaut que pour un mariage) est révocable et discrétionnaire! si pas d’autorisation des parents : nullité relative! si pas de dispense par le proc. : nullité absolue).
Tu dois répondre avec tous les objets JSON pour TOUTES les sections du texte à analyser.`,
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

	return resumeResponse;
};

const filePath = process.argv[2] ?? "";
if (!filePath) {
	throw new Error("Please provide a file path as an argument");
}

const result = await executeCourse(filePath);
const index = filePath.lastIndexOf(".");
const jsonlFilePath = `${index !== -1 ? filePath.substring(0, index) : filePath}.jsonl`;
const buffer = Buffer.from(result, "utf-8");
fs.writeFileSync(jsonlFilePath, buffer);
console.log(`Training dataset saved to ${jsonlFilePath}`);
