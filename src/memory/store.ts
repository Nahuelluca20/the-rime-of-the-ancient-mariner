import { and, eq } from "drizzle-orm";
import { openDb } from "../db/connection.ts";
import { agentMemories, projects } from "./schema.ts";
import type { AgentMemory, AgentMemoryData, Project } from "./types.ts";

export type { AgentMemory, AgentMemoryData, Project } from "./types.ts";

export interface PutMemoryResult {
	memory: AgentMemory;
	created: boolean;
}

export interface MemoryStore {
	getOrCreateProject(name: string): Project;
	putMemory(projectName: string, name: string, data: AgentMemoryData): PutMemoryResult;
}

let cached: MemoryStore | undefined;

export function openMemoryStore(path?: string): MemoryStore {
	if (cached) return cached;

	const db = openDb(path);

	cached = {
		getOrCreateProject(name) {
			const existing = db.select().from(projects).where(eq(projects.name, name)).get();
			if (existing) return existing;
			return db.insert(projects).values({ name }).returning().get();
		},

		putMemory(projectName, name, data) {
			const project = this.getOrCreateProject(projectName);
			const inserted = db
				.insert(agentMemories)
				.values({ name, projectId: project.id, data })
				.onConflictDoNothing({ target: [agentMemories.projectId, agentMemories.name] })
				.returning()
				.get();
			if (inserted) return { memory: inserted, created: true };

			const existing = db
				.select()
				.from(agentMemories)
				.where(and(eq(agentMemories.projectId, project.id), eq(agentMemories.name, name)))
				.get();
			if (!existing) {
				throw new Error(
					`putMemory: insert conflict on (${projectName}, ${name}) but no existing row found`,
				);
			}
			return { memory: existing, created: false };
		},
	};

	return cached;
}
