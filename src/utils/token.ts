import { decryptAES, encryptAES } from "./cryptology.js";

export function generateToken(
	secret: string,
	password: string,
	expiresInMs: number,
): string {
	const timestamp = Date.now() + expiresInMs;
	const key = Math.floor(Math.random() * 0xffffffff);

	const timestampHex = timestamp.toString(16).padStart(16, "0");
	const keyHex = key.toString(16);

	const token = `${keyHex}|${secret}|${timestampHex}`;

	return encryptAES(token, password);
}

export function extractSecretFromToken(
	token: string,
	password: string,
): { secret: string; expireIn: Date } {
	const decoded = decryptAES(token, password);
	const [keyStr, secret, timestampStr] = decoded.split("|");

	return {
		secret: secret,
		expireIn: new Date(Number.parseInt(timestampStr, 16)),
	};
}
