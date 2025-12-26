import {
	openConnection,
	openDatabase,
} from "../src/modules/database/manager.js";
import { Schema } from "../src/modules/database/schema.js";
import { getEnvValue, setCurrentDirectory } from "../src/utils/environment.js";

const run = async () => {
	setCurrentDirectory();
	const host = getEnvValue("dbHost");
	if (!host) {
		throw new Error("Database host is not defined in environment variables.");
	}
	const portString = getEnvValue("dbPort");
	if (!portString) {
		throw new Error("Database port is not defined in environment variables.");
	}
	const port = Number.parseInt(portString, 10);
	const user = getEnvValue("dbUser");
	if (!user) {
		throw new Error("Database user is not defined in environment variables.");
	}
	const password = getEnvValue("dbPassword");
	if (!password) {
		throw new Error(
			"Database password is not defined in environment variables.",
		);
	}

	const connection = await openConnection(host, port, user, password);
	console.log("MySQL connection established successfully.");
	console.log(
		"test_db exists ? ",
		await connection.databaseExists("legi_france"),
	);
	await connection.createDatabase("test_db");
	await connection.useDatabase("test_db");
	console.log(
		"test_db exists after creation ? ",
		await connection.databaseExists("test_db"),
	);
	await connection.deleteDatabase("test_db");

	await connection.createUser("test_user", "test_password");
	await connection.grantAllPrivileges("test_user");
	await connection.deleteUser("test_user");
	await connection.close();

	const database = openDatabase(host, port, user, password, "legi_france");
	console.log("Database connection established successfully.");
	const schema = new Schema();
	schema.addColumn("id", "INT PRIMARY KEY AUTO_INCREMENT");
	schema.addColumn("name", "VARCHAR(255) NOT NULL");
	schema.addColumn("alias", "VARCHAR(255) NOT NULL");
	schema.addUniqueContraint("alias");

	console.log("Schema definition:", schema.toString());
	await database.createTable("test_table", schema);
	console.log("test_table exists ? ", await database.tableExists("test_table"));
	await database.deleteTable("test_table");
	const [rows] = await database.query("SELECT * FROM law");
	await database.close();
};

run().catch((error) => {
	console.error("Error during database connection test:", error);
	process.exit(1);
});
