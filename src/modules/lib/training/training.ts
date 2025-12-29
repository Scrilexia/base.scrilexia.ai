import type { Abort } from "../../../utils/abortController.js";

export class TrainingModule {
	protected abortController: Abort;

	constructor(abortController: Abort) {
		this.abortController = abortController;
	}

	protected removeForbiddenCharacters(text: string): string {
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

	protected generateUserPrompt(
		userContent: string,
		explicitQuestions: string[],
		compactQuestions: string[],
	): string {
		if (explicitQuestions.length === 0 || compactQuestions.length === 0) {
			throw new Error("Questions array cannot be empty");
		}

		let allWithUserContent = explicitQuestions.every((question) =>
			question.includes("___USER_CONTENT___"),
		);
		if (!allWithUserContent) {
			throw new Error(
				"All questions must include the placeholder ___USER_CONTENT___",
			);
		}

		allWithUserContent = compactQuestions.every((question) =>
			question.includes("___USER_CONTENT___"),
		);
		if (!allWithUserContent) {
			throw new Error(
				"All questions must include the placeholder ___USER_CONTENT___",
			);
		}

		const explicitFormattedQuestions = explicitQuestions.map((question) =>
			question.replace("___USER_CONTENT___", userContent),
		);

		const compactFormattedQuestions = compactQuestions.map((question) =>
			question.replace("___USER_CONTENT___", userContent),
		);

		const randomNumber = Math.random();

		if (randomNumber < 0.8) {
			return explicitFormattedQuestions[
				Math.floor(Math.random() * explicitFormattedQuestions.length)
			];
		}

		return compactFormattedQuestions[
			Math.floor(Math.random() * compactFormattedQuestions.length)
		];
	}
}
