import { eq } from "drizzle-orm";
import { openDb } from "../db/connection.ts";
import { agentMemories, projects } from "./schema.ts";
import type { AgentMemory, AgentMemoryData, Project } from "./types.ts";

export type { AgentMemory, AgentMemoryData, Project } from "./types.ts";

export interface MemoryStore {
	getOrCreateProject(name: string): Project;
	putMemory(projectName: string, name: string, data: AgentMemoryData): AgentMemory;
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
			return db
				.insert(agentMemories)
				.values({ name, projectId: project.id, data })
				.returning()
				.get();
		},
	};

	return cached;
}
