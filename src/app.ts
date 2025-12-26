import * as fs from "node:fs";
import * as https from "node:https";
import path from "node:path";
import bodyParser from "body-parser";
import express from "express";
import authActions from "./modules/auth/authActions.js";
import { router } from "./router.js";
import { getEnvValue, setCurrentDirectory } from "./utils/environment.js";

const app = express();
let serverApp: https.Server | undefined = undefined;

setCurrentDirectory();
const certFileName = getEnvValue("cert");
const keyFileName = getEnvValue("key");
if (certFileName && keyFileName) {
	let certFile = path.join(process.cwd(), "..", "common", certFileName);
	let keyFile = path.join(process.cwd(), "..", "common", keyFileName);

	if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
		certFile = path.join(process.cwd(), certFileName);
		keyFile = path.join(process.cwd(), keyFileName);
	}

	if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
		serverApp = https.createServer(
			{
				cert: fs.readFileSync(certFile),
				key: fs.readFileSync(keyFile),
			},
			app,
		);
	} else {
		console.warn(
			`Cert file or key file not found. HTTPS disabled. Cert: ${certFile}, Key: ${keyFile}`,
		);
	}
}

app.use(bodyParser.json({ limit: "20000mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());
app.use(express.raw());

app.use("/api", authActions.checkAuthorization);
app.use(router);

app.use((req, res) => {
	console.info(`Unauthorized access attempt to: ${req.url}`);
	res.status(401).send("Unauthorized");
});

export { app, serverApp };
