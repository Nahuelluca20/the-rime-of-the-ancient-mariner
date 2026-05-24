import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	schema: "./db/schema.ts",
	out: "./migrations",
	dbCredentials: {
		url: "rime-ancient-mariner.db",
	},
});
