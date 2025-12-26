import * as fs from "node:fs";
import path from "node:path";
import process from "node:process";
import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios";
import { TokenTextSplitter } from "langchain/text_splitter";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export function setCurrentDirectory() {
	try {
		if (!fs.existsSync(path.join(process.cwd(), ".eun.env"))) {
			const filename = fileURLToPath(import.meta.url);
			let currentDir = dirname(filename);;
			const useBackslash = currentDir.includes("\\");
			while (!fs.existsSync(path.join(currentDir, ".eun.env"))) {
				currentDir = currentDir.substring(
					0,
					currentDir.lastIndexOf(useBackslash ? "\\" : "/"),
				);
				if (currentDir === "") {
					throw new Error("No .eun.env file found in the directory tree");
				}
			}
			// Set the current directory to the one where .eun.env is located
			process.chdir(currentDir);
		}
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error("Error:", error.message);
		} else {
			console.error("Unknown error:", error);
		}
	}
}

export function getValueFromFile(
	fileName: string,
	key: string,
	defaultValue: string | null,
): string | null {
	let envObject: { [key: string]: string } = {};

	setCurrentDirectory();
	try {
		const envObjectJson = fs.readFileSync(
			path.join(process.cwd(), fileName),
			"utf-8",
		);
		if (envObjectJson) {
			envObject = JSON.parse(envObjectJson);
		}
	} catch (error) {
		envObject = {};
	}

	return envObject[key] || defaultValue;
}

export function getEnvValue(
	key: string,
	defaultValue: string | null = null,
): string | null {
	return getValueFromFile(".eun.env", key, defaultValue);
}

export function getResourcesEnvValue(
	key: string,
	defaultValue: string | null = null,
): string | null {
	return getValueFromFile(".resources.env", key, defaultValue);
}

export function setValueToFile(
	fileName: string,
	key: string,
	value: string,
): void {
	let envObject: { [key: string]: string } = {};

	setCurrentDirectory();
	const envObjectJson = fs.readFileSync(
		path.join(process.cwd(), ".eun.env"),
		"utf-8",
	);
	if (envObjectJson) {
		envObject = JSON.parse(envObjectJson);
	}

	envObject[key] = value;
	fs.writeFileSync(
		path.join(process.cwd(), ".eun.env"),
		JSON.stringify(envObject, null, 2),
	);
}

export function setEnvValue(key: string, value: string): void {
	setValueToFile(".eun.env", key, value);
}

export function setResourcesEnvValue(key: string, value: string): void {
	setValueToFile(".resources.env", key, value);
}

export function removeValueFromFile(fileName: string, key: string): void {
	let envObject: { [key: string]: string } = {};

	const envObjectJson = fs.readFileSync(
		path.join(process.cwd(), ".eun.env"),
		"utf-8",
	);
	if (envObjectJson) {
		envObject = JSON.parse(envObjectJson);
	}

	delete envObject[key];
	fs.writeFileSync(
		path.join(process.cwd(), ".eun.env"),
		JSON.stringify(envObject, null, 2),
	);
}

export function removeEnv(key: string): void {
	removeValueFromFile(".eun.env", key);
}

export async function httpRequest<T>(
	url: string,
	options: RequestInit | AxiosRequestConfig<string> = {},
): Promise<Response | AxiosResponse<T, string>> {
	let response: Response | AxiosResponse<T, string>;
	try {
		response = await axios(url, {
			...options,
			headers: options.headers as Record<string, string>,
		} as AxiosRequestConfig<string>);
	} catch (error) {
		response = await fetch(url, {
			...options,
			headers: options.headers as Record<string, string>,
		} as RequestInit);
	}

	return response;
}

export async function connectLegiFrance(): Promise<string> {
	let authorization = getEnvValue("authorization");
	if (!authorization) {
		authorization = await connect_piste();
		setEnvValue("authorization", authorization);
	} else {
		try {
			await searchPing(authorization);
		} catch (error) {
			authorization = await connect_piste();
			setEnvValue("authorization", authorization);
		}
	}
	return authorization;
}

export async function getLegiFranceAuthorization(): Promise<string> {
	let authorization = getEnvValue("authorization");
	if (!authorization) {
		authorization = await connect_piste();
		setEnvValue("authorization", authorization);
	}
	return authorization;
}

export async function connect_piste(
	clientIdKey = "client_id",
	clientSecretKey = "client_secret",
): Promise<string> {
	const response = await axios("https://oauth.piste.gouv.fr/api/oauth/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		data: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: getEnvValue(clientIdKey) as string,
			client_secret: getEnvValue(clientSecretKey) as string,
			scope: "openid",
		}),
	});

	const data = await response.data;
	return data.access_token;
}

export async function searchPing(authorization: string): Promise<void> {
	const response = await axios(
		"https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search/ping",
		{
			headers: {
				Authorization: `Bearer ${authorization}`,
			},
		},
	);

	if (response.status !== 200) {
		throw new Error("Error");
	}
}

export async function legiFrancePostRequest<T>(
	url: string,
	body: Record<string, unknown> = {},
): Promise<T | undefined> {
	let response = await httpRequest<T>(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${await getLegiFranceAuthorization()}`,
		},
		data: JSON.stringify(body),
		body: JSON.stringify(body),
	});

	if (response.status === 401) {
		removeEnv("authorization");
		response = await httpRequest<T>(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${await getLegiFranceAuthorization()}`,
			},
			data: JSON.stringify(body),
			body: JSON.stringify(body),
		});
	}

	if (response.status !== 200) {
		throw new Error(response.statusText || "Error fetching data");
	}

	if (response instanceof Response) {
		const responseData = await response.json();
		return responseData as T;
	}
	if ("data" in response) {
		const responseData = await response.data;
		return responseData as T;
	}

	throw new Error("Unexpected response format");
}

export class DateResult {
	date: string;
	startIndex: number;
	endIndex: number;

	constructor(date: string, startIndex: number, endIndex: number) {
		this.date = date;
		this.startIndex = startIndex;
		this.endIndex = endIndex;
	}
}

export function searchDate(text: string): DateResult {
	const regex =
		/\b(1er|0?[1-9]|[12][0-9]|3[01]) (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) (19[0-9]{2}|20[0-9]{2})\b/;
	const match = regex.exec(text);

	if (match) {
		return {
			date: match[0],
			startIndex: match.index,
			endIndex: match.index + match[0].length,
		};
	}

	return new DateResult("", -1, -1);
}

export async function pause(timeMilliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, timeMilliseconds);
	});
}

export function toDate(
	dateToConvert: string | number,
	dateDefault: Date,
): Date {
	let date: Date;
	if (typeof dateToConvert === "number") {
		date = Number.isNaN(dateToConvert) ? dateDefault : new Date(dateToConvert);
	} else if (typeof dateToConvert === "string") {
		const parsedDate = Date.parse(dateToConvert);
		if (Number.isNaN(parsedDate)) {
			throw new Error("Invalid date string");
		}
		date = Number.isNaN(parsedDate) ? dateDefault : new Date(parsedDate);
	} else {
		throw new Error("Date must be a string or a number");
	}

	return date;
}

export async function delay(delayMilliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
}

export async function trySeveralTimes<ReturnType>(
	codeToExecute: () => Promise<ReturnType>,
	maxAttempts = 5,
	timeBetweenAttempts = 1000,
) {
	let attempts = 0;

	const execute = async () => {
		try {
			return await codeToExecute();
		} catch (error) {
			attempts++;
			if (attempts < maxAttempts) {
				console.warn(`Attempt ${attempts} failed. Retrying...`);
				await new Promise((resolve) =>
					setTimeout(resolve, timeBetweenAttempts),
				);
				return await execute();
			}
			// If all attempts fail, throw the last error
			console.error(`All ${maxAttempts} attempts failed.`);
			throw error;
		}
	};

	return await execute();
}

export function extractAlias(text: string): string[] {
	const regex = /\b(?:JURITEXT|LEGIARTI)\d+\b/g;
	const resultats = text.match(regex);
	return resultats || [];
}

export function removeImgTags(html: string): string {
	return html.replace(/<img[^>]*>/gi, "");
}

export function shortenWithEllipsis(text: string): string {
	const len = text.length;
	const part = 30;

	if (len <= 60) return text;

	const start = text.slice(0, part).replace(/\n/g, "").trimStart();
	const end = text.slice(-part).replace(/\n/g, "").trimEnd();

	return `${start}...${end}`;
}

export class UrlParts {
	protocol: string; // 'http:' ou 'https:'
	host: string; // exemple.com
	port: string | null; // 80, 443 ou vide
	path: string; // /chemin/page
	parameters: Record<string, string>; // { clé: valeur }
	fragment: string; // #section

	constructor(
		protocol = "",
		host = "",
		port: string | null = null,
		path = "",
		parameters: Record<string, string> = {},
		fragment = "",
	) {
		this.protocol = protocol;
		this.host = host;
		this.port = port;
		this.path = path;
		this.parameters = parameters;
		this.fragment = fragment;
	}
}

export async function splitTextWithtokens(
	text: string,
	chunkSize: number,
): Promise<string[]> {
	if (!text || text.trim() === "") {
		return [];
	}
	// Split the text into chunks based on the specified chunk size
	const splitter = new TokenTextSplitter({ chunkSize, chunkOverlap: 10 });
	return await splitter.splitText(text);
}

export function parseURL(url: string): UrlParts {
	try {
		const parsed = new URL(url);

		return new UrlParts(
			parsed.protocol,
			parsed.hostname,
			parsed.port ? parsed.port : null,
			parsed.pathname,
			Object.fromEntries(parsed.searchParams.entries()),
			parsed.hash,
		);
	} catch (e) {
		return new UrlParts();
	}
}

export function isEnum<T extends { [key: string]: string | number }>(
	enumObj: T,
	value: unknown,
): value is T[keyof T] {
	return Object.values(enumObj).includes(value as T[keyof T]);
}

export function getEnum<T extends { [key: string]: string | number }>(
	enumObj: T,
	value: string,
): T[keyof T] {
	if (isEnum(enumObj, value)) {
		return value as T[keyof T];
	}
	throw new Error(`Invalid enum: ${value}`);
}

export function stripMarkdownLinks(link: string): string {
	return link.replace(/\[([^\r\n\]]+)\]\([^\r\n\)]+\)/g, "$1");
}

export async function EnumerateChunks(
	text: string,
	handleChunk: (chunk: string) => void,
): Promise<void> {
	for (let i = 0; i < text.length; i += 10) {
		const chunk = text.slice(i, i + 10);
		handleChunk(chunk);
		await delay(10);
	}
}

export function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitWords(text: string) {
	return text
		.trim()
		.split(/[\s.,;!?()"'«»]+/)
		.filter((word) => word.length > 0);
}
