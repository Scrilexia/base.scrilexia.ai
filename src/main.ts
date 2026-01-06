import { app, appQuery, serverApp } from "./app.js";
import {
	getEnvValue,
	setCurrentDirectory,
	setEnvValue,
} from "./utils/environment.js";

setCurrentDirectory();

let serverPort = getEnvValue("legifrance_port");
if (!serverPort) {
	serverPort = "3310";
	setEnvValue("legifrance_port", serverPort);
}

let serverQueryPort = getEnvValue("legifrance_query_port");
if (!serverQueryPort) {
	serverQueryPort = "4312";
	setEnvValue("legifrance_query_port", serverQueryPort);
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

	appQuery
		.listen(Number.parseInt(serverQueryPort), () => {
			console.info(`Web Server Query is listening on port ${serverQueryPort}`);
		})
		.on("error", (err: Error) => {
			console.error("Error:", err.message);
		});
} catch (error: unknown) {
	if (error instanceof Error) {
		console.error("Error:", error.message);
	} else {
		console.error("Unknown error:", error);
	}
}
