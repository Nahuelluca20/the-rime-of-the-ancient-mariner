import type { MemoryRepository } from "./repository.ts";
import type { AgentMemory } from "./types.ts";

export type MemoryInfoForRetrieval = {
	memoryName: string;
	projectName: string;
};

export interface MemoryContext {
	getMemories(memoryInfo: MemoryInfoForRetrieval[]): AgentMemory[];
}

export function resolveMemoryForContext({
	repository,
}: {
	repository: MemoryRepository;
}): MemoryContext {
	function getMemories(memoryInfo: MemoryInfoForRetrieval[]): AgentMemory[] {
		return repository.findMemories(
			memoryInfo.map(({ projectName, memoryName }) => ({ projectName, name: memoryName })),
		);
	}

	return {
		getMemories,
	};
}

const CONTEXT_FIELDS = ["sessionType", "tags", "cwd", "title", "description", "context"] as const;

function formatMemory(memory: AgentMemory): string {
	const lines: string[] = [];
	for (const field of CONTEXT_FIELDS) {
		const value = memory.data[field];
		const text = formatContextField(value);
		if (text) lines.push(`${field}: ${text}`);
	}
	return lines.join("\n");
}

function formatContextField(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
		return value.join(", ");
	}
	return "";
}

export function formatMemoriesForContext(memories: AgentMemory[]): string {
	return memories
		.map(formatMemory)
		.filter((block) => block.length > 0)
		.join("\n\n---\n\n");
}
