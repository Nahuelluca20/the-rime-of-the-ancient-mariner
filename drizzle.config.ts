import { defineConfig } from "drizzle-kit";
import { getDefaultMemoryDbPath } from "./src/db/path.ts";

export default defineConfig({
	dialect: "sqlite",
	schema: ["./src/memory/schema.ts", "./src/subagents/schema.ts"],
	out: "./migrations",
	dbCredentials: {
		url: getDefaultMemoryDbPath(),
	},
});
