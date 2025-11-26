// Options de hachage (voir documentation : https://github.com/ranisalt/node-argon2/wiki/Options)

import type { RequestHandler } from "express";
import { getEnvValue } from "../../utils/environment";
import { extractSecretFromToken } from "../../utils/token";

const checkAuthorization: RequestHandler = (req, res, next) => {
	const token = req.headers.authorization;

	if (!token || !token.startsWith("Bearer ")) {
		return res
			.status(401)
			.json({ error: "Authorization header missing or invalid" });
	}

	const secret = getEnvValue("token_secret");
	const password = getEnvValue("token_password");
	if (!secret || !password) {
		console.error("Token secret or password not set in environment variables");
		return res.status(500).json({ error: "Internal server error" });
	}

	const extracted = extractSecretFromToken(token.slice(7), password);
	if (!extracted || extracted.secret !== secret) {
		console.log(`Invalid token secret ${extracted?.secret} vs ${secret}`);
		return res.status(403).json({ error: "Invalid token" });
	}

	const now = new Date(Date.now());

	if (extracted.expireIn < now) {
		console.log(
			`Token expired at ${extracted.expireIn.toISOString()} vs now ${now.toISOString()}`,
		);
		return res.status(403).json({ error: "Token has expired" });
	}

	next();
};

export default {
	checkAuthorization,
};
