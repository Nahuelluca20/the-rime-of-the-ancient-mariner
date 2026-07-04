import { and, count, desc, eq, inArray } from "drizzle-orm";
import { openDb } from "../db/connection.ts";
import { agentMemories, projects } from "./schema.ts";
import type { AgentMemory, AgentMemoryData, Project } from "./types.ts";

export interface CreateMemoryResult {
	memory: AgentMemory;
	created: boolean;
}

export type UpdateMemoryResult =
	| { memory: AgentMemory; updated: true }
	| { memory: null; updated: false };

export interface MemoryRef {
	projectName: string;
	name: string;
}

export interface RecentMemoryRow {
	projectName: string;
	name: string;
	data: AgentMemoryData;
	updatedAt: Date;
}

/**
 * Persistence-only access to memory tables.
 */
export interface MemoryRepository {
	/**
	 * Returns an existing project without creating one.
	 */
	findProject(name: string): Project | null;

	/**
	 * Returns an existing project or creates it for write operations that need a parent row.
	 */
	ensureProject(name: string): Project;

	createMemory(projectName: string, name: string, data: AgentMemoryData): CreateMemoryResult;
	updateMemory(projectName: string, name: string, data: AgentMemoryData): UpdateMemoryResult;
	findMemory(projectName: string, name: string): AgentMemory | null;
	findMemories(refs: MemoryRef[]): AgentMemory[];
	listMemories(projectName: string): AgentMemory[];
	listRecentMemoryRows(limit?: number, offset?: number): RecentMemoryRow[];
	countMemories(): number;
}

export function openMemoryRepository(path?: string): MemoryRepository {
	const db = openDb(path);

	function findProject(name: string): Project | null {
		return db.select().from(projects).where(eq(projects.name, name)).get() ?? null;
	}

	function ensureProject(name: string): Project {
		const existing = findProject(name);
		if (existing) return existing;
		return db.insert(projects).values({ name }).returning().get();
	}

	return {
		findProject,
		ensureProject,

		createMemory(projectName, name, data) {
			const project = ensureProject(projectName);
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
			const project = findProject(projectName);
			if (!project) return { memory: null, updated: false };

			const updated = db
				.update(agentMemories)
				.set({ data })
				.where(and(eq(agentMemories.projectId, project.id), eq(agentMemories.name, name)))
				.returning()
				.get();
			if (updated) return { memory: updated, updated: true };
			return { memory: null, updated: false };
		},

		findMemory(projectName, name) {
			const project = findProject(projectName);
			if (!project) return null;
			return (
				db
					.select()
					.from(agentMemories)
					.where(and(eq(agentMemories.projectId, project.id), eq(agentMemories.name, name)))
					.get() ?? null
			);
		},

		findMemories(refs) {
			const namesByProject = new Map<string, string[]>();
			for (const { projectName, name } of refs) {
				const names = namesByProject.get(projectName) ?? [];
				names.push(name);
				namesByProject.set(projectName, names);
			}

			const found = new Map<string, AgentMemory>();
			for (const [projectName, names] of namesByProject) {
				const project = findProject(projectName);
				if (!project) continue;
				const rows = db
					.select()
					.from(agentMemories)
					.where(and(eq(agentMemories.projectId, project.id), inArray(agentMemories.name, names)))
					.all();
				for (const row of rows) found.set(`${projectName}\0${row.name}`, row);
			}

			return refs
				.map((ref) => found.get(`${ref.projectName}\0${ref.name}`))
				.filter((memory): memory is AgentMemory => memory !== undefined);
		},

		listMemories(projectName) {
			const project = findProject(projectName);
			if (!project) return [];
			return db.select().from(agentMemories).where(eq(agentMemories.projectId, project.id)).all();
		},

		listRecentMemoryRows(limit = 10, offset = 0) {
			return db
				.select({
					projectName: projects.name,
					name: agentMemories.name,
					updatedAt: agentMemories.updatedAt,
					data: agentMemories.data,
				})
				.from(agentMemories)
				.innerJoin(projects, eq(agentMemories.projectId, projects.id))
				.orderBy(desc(agentMemories.updatedAt))
				.limit(limit)
				.offset(offset)
				.all();
		},

		countMemories() {
			return db.select({ value: count() }).from(agentMemories).get()?.value ?? 0;
		},
	};
}
