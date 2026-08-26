import { sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

/** The singleton record storing the user's global subagent availability choice. */
export const subagentPreferences = sqliteTable("subagent_preferences", {
	id: integer("id").primaryKey(),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date()),
});
