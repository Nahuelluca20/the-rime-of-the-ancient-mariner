import { and, count, desc, eq, inArray } from "drizzle-orm";
import { openDb } from "../db/connection.ts";
import { formatMemoryPreview } from "./preview.ts";
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

export interface MemoryRef {
	projectName: string;
	name: string;
}

export interface RecentMemory {
	projectName: string;
	name: string;
	description: string;
	preview: string;
	updatedAt: Date;
}

export interface MemoryStore {
	getOrCreateProject(name: string): Project;
	createMemory(projectName: string, name: string, data: AgentMemoryData): CreateMemoryResult;
	updateMemory(projectName: string, name: string, data: AgentMemoryData): UpdateMemoryResult;
	getMemory(projectName: string, name: string): AgentMemory | null;
	getMemories(refs: MemoryRef[]): AgentMemory[];
	listMemories(projectName: string): AgentMemory[];
	listRecentMemories(limit?: number, offset?: number): RecentMemory[];
	countMemories(): number;
}

let cached: MemoryStore | undefined;

function getMemoryDescription(data: AgentMemoryData): string {
	const description = data.description;
	return typeof description === "string" ? description : "";
}

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

		getMemory(projectName, name) {
			const project = this.getOrCreateProject(projectName);
			return (
				db
					.select()
					.from(agentMemories)
					.where(and(eq(agentMemories.projectId, project.id), eq(agentMemories.name, name)))
					.get() ?? null
			);
		},

		getMemories(refs) {
			const namesByProject = new Map<string, string[]>();
			for (const { projectName, name } of refs) {
				const names = namesByProject.get(projectName) ?? [];
				names.push(name);
				namesByProject.set(projectName, names);
			}

			const found = new Map<string, AgentMemory>();
			for (const [projectName, names] of namesByProject) {
				// read-only: does not create the project (unlike getOrCreateProject)
				const project = db.select().from(projects).where(eq(projects.name, projectName)).get();
				if (!project) continue;
				const rows = db
					.select()
					.from(agentMemories)
					.where(and(eq(agentMemories.projectId, project.id), inArray(agentMemories.name, names)))
					.all();
				for (const row of rows) found.set(`${projectName} ${row.name}`, row);
			}

			return refs
				.map((r) => found.get(`${r.projectName} ${r.name}`))
				.filter((m): m is AgentMemory => m !== undefined);
		},

		listMemories(projectName) {
			const project = this.getOrCreateProject(projectName);
			return db.select().from(agentMemories).where(eq(agentMemories.projectId, project.id)).all();
		},

		listRecentMemories(limit = 10, offset = 0) {
			// read-only: joins memories to their project name, newest first
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
				.all()
				.map((row) => ({
					projectName: row.projectName,
					name: row.name,
					description: getMemoryDescription(row.data),
					preview: formatMemoryPreview(row.data),
					updatedAt: row.updatedAt,
				}));
		},

		countMemories() {
			return db.select({ value: count() }).from(agentMemories).get()?.value ?? 0;
		},
	};

	return cached;
}
