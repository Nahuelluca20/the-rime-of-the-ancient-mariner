import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDefaultMemoryDbPath } from "./path.ts";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");

export function openDb(path = getDefaultMemoryDbPath()) {
	mkdirSync(dirname(path), { recursive: true });
	const sqlite = new Database(path);
	const db = drizzle({ client: sqlite });
	migrate(db, { migrationsFolder });
	return db;
}
