import { formatMemoryPreview } from "./preview.ts";
import type { MemoryRepository } from "./repository.ts";
import type { AgentMemoryData } from "./types.ts";

export interface RecentMemory {
	projectName: string;
	name: string;
	description: string;
	sessionType: string;
	tags: string[];
	preview: string;
	updatedAt: Date;
}

/**
 * Builds memory projections for browsing and selection UI.
 */
export interface MemoryCatalog {
	listRecentMemories(limit?: number, offset?: number): RecentMemory[];
}

function getMemoryDescription(data: AgentMemoryData): string {
	const description = data.description;
	return typeof description === "string" ? description : "";
}

function getMemorySessionType(data: AgentMemoryData): string {
	const sessionType = data.sessionType;
	return typeof sessionType === "string" ? sessionType : "";
}

function getMemoryTags(data: AgentMemoryData): string[] {
	const tags = data.tags;
	if (!Array.isArray(tags)) return [];
	return tags.filter((tag): tag is string => typeof tag === "string");
}

export function createMemoryCatalog(repository: MemoryRepository): MemoryCatalog {
	return {
		listRecentMemories(limit = 10, offset = 0) {
			return repository.listRecentMemoryRows(limit, offset).map((row) => ({
				projectName: row.projectName,
				name: row.name,
				description: getMemoryDescription(row.data),
				sessionType: getMemorySessionType(row.data),
				tags: getMemoryTags(row.data),
				preview: formatMemoryPreview(row.data),
				updatedAt: row.updatedAt,
			}));
		},
	};
}
