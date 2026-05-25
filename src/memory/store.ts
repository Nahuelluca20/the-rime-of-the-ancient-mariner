import { and, eq } from "drizzle-orm";
import { openDb } from "../db/connection.ts";
import { agentMemories, projects } from "./schema.ts";
import type { AgentMemory, AgentMemoryData, Project } from "./types.ts";

export type { AgentMemory, AgentMemoryData, Project } from "./types.ts";

export interface CreateMemoryResult {
	memory: AgentMemory;
	created: boolean;
}

export type UpdateMemoryResult =
	| { memory: AgentMemory; updated: true }
	| { memory: null; updated: false };

export interface MemoryStore {
	getOrCreateProject(name: string): Project;
	createMemory(projectName: string, name: string, data: AgentMemoryData): CreateMemoryResult;
	updateMemory(projectName: string, name: string, data: AgentMemoryData): UpdateMemoryResult;
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

		createMemory(projectName, name, data) {
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
					`createMemory: insert conflict on (${projectName}, ${name}) but no existing row found`,
				);
			}
			return { memory: existing, created: false };
		},

		updateMemory(projectName, name, data) {
			const project = this.getOrCreateProject(projectName);
			const updated = db
				.update(agentMemories)
				.set({ data })
				.where(and(eq(agentMemories.projectId, project.id), eq(agentMemories.name, name)))
				.returning()
				.get();
			if (updated) return { memory: updated, updated: true };
			return { memory: null, updated: false };
		},
	};

	return cached;
}
