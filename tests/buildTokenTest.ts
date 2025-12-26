import { getEnvValue } from "../src/utils/environment.js";
import { generateToken } from "../src/utils/token.js";

const buildToken = async () => {
	const secret = getEnvValue("token_secret");
	if (!secret) {
		throw new Error("Environment variable 'token_secret' is not set");
	}

	const password = getEnvValue("token_password");
	if (!password) {
		throw new Error("Environment variable 'token_password' is not set");
	}

	const token = generateToken(secret, password, 60 * 60 * 1000); // 1 hour expiration
	console.log("Generated Token:", token);
};

await buildToken();
