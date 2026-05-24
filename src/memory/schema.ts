import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export type AgentMemoryData = Record<string, unknown>;

export const projects = sqliteTable(
	"projects",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("projects_name_unique").on(t.name)],
);

export const agentMemories = sqliteTable("agent_memories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	projectId: integer("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date()),
	data: text("data", { mode: "json" }).$type<AgentMemoryData>().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type AgentMemory = typeof agentMemories.$inferSelect;
export type NewAgentMemory = typeof agentMemories.$inferInsert;
