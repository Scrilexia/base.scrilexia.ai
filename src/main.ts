import { app, serverApp } from "./app";
import {
	getEnvValue,
	setCurrentDirectory,
	setEnvValue,
} from "./utils/environment";

setCurrentDirectory();

let serverPort = getEnvValue("scrilexia_port");
if (!serverPort) {
	serverPort = "3310";
	setEnvValue("scrilexia_port", serverPort);
}

try {
	if (serverApp) {
		serverApp
			.listen(Number.parseInt(serverPort), () => {
				console.info(`Web Server HTTPS is listening on port ${serverPort}`);
			})
			.on("error", (err: Error) => {
				console.error("Error:", err.message);
			});
	} else {
		app
			.listen(Number.parseInt(serverPort), () => {
				console.info(`Web Server is listening on port ${serverPort}`);
			})
			.on("error", (err: Error) => {
				console.error("Error:", err.message);
			});
	}
} catch (error: unknown) {
	if (error instanceof Error) {
		console.error("Error:", error.message);
	} else {
		console.error("Unknown error:", error);
	}
}
