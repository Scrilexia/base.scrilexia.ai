import crypto from "node:crypto";
import os from "node:os";

const counterStart = process.hrtime.bigint();
const base62chars =
	"abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateUniqueId() {
	const timestamp = (process.hrtime.bigint() - counterStart).toString(); // nanosecondes
	const pid = process.pid.toString();
	const hostname = os.hostname();
	const random = crypto.randomBytes(8).toString("hex");

	const date = Date.now();

	const raw = `${timestamp}-${pid}-${hostname}-${date}-${random}`;
	return crypto.createHash("sha256").update(raw).digest("hex");
}

export function encryptAES(textToEncrypt: string, secretKey: string): string {
	const key = crypto.createHash("sha256").update(secretKey).digest(); // 32 bytes
	const iv = crypto.randomBytes(16); // initialization vector (16 bytes)

	const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
	let encrypted = cipher.update(textToEncrypt, "utf8", "latin1"); // 'latin1' to get binary string
	encrypted += cipher.final("latin1");
	const encryptedBuffer = Buffer.from(encrypted, "latin1"); // convert to Buffer
	const ivIndex = Math.min(Math.floor(encryptedBuffer.length / 3), 255); // position of the IV

	// create a new Buffer with the IV inserted at the ivIndex position
	const bufferComplete = Buffer.concat([
		encryptedBuffer.subarray(0, ivIndex),
		iv,
		encryptedBuffer.subarray(ivIndex),
		Buffer.from([ivIndex]),
	]);

	// return as base64 string (easier to handle than binary string)
	return bufferComplete.toString("base64");
}

export function decryptAES(encryptedBase64: string, secretKey: string): string {
	// decode base64
	const raw = Buffer.from(encryptedBase64, "base64");
	const ivIndex = raw[raw.length - 1]; // last byte indicates the position of the IV
	const iv = raw.subarray(ivIndex, ivIndex + 16); // 16 bytes for the IV

	const encrypted = Buffer.concat([
		raw.subarray(0, ivIndex),
		raw.subarray(ivIndex + 16, raw.length - 1),
	]).toString("latin1"); // convert back to binary string

	const key = crypto.createHash("sha256").update(secretKey).digest();

	const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
	let decrypted = decipher.update(encrypted, "latin1", "utf8");
	decrypted += decipher.final("utf8");

	return decrypted;
}
