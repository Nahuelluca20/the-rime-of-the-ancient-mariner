import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/memory/schema.ts",
	out: "./migrations",
	dbCredentials: {
		url: "rime-ancient-mariner.db",
	},
});
