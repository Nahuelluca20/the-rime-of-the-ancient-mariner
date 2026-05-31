import type { AgentMemory, MemoryStore } from "./store.ts";

export type MemoryInfoForRetrieval = {
	memoryName: string;
	projectName: string;
};

export interface MemoryContext {
	getMemories(memoryInfo: MemoryInfoForRetrieval[]): AgentMemory[];
}

export function resolveMemoryForContext({
	store,
}: {
	store: MemoryStore;
}): MemoryContext {
	function getMemories(memoryInfo: MemoryInfoForRetrieval[]): AgentMemory[] {
		return store.getMemories(
			memoryInfo.map(({ projectName, memoryName }) => ({ projectName, name: memoryName })),
		);
	}

	return {
		getMemories,
	};
}

const CONTEXT_FIELDS = ["cwd", "title", "context"] as const;

function formatMemory(memory: AgentMemory): string {
	const lines: string[] = [];
	for (const field of CONTEXT_FIELDS) {
		const value = memory.data[field];
		if (typeof value === "string" && value.length > 0) {
			lines.push(`${field}: ${value}`);
		}
	}
	return lines.join("\n");
}

export function formatMemoriesForContext(memories: AgentMemory[]): string {
	return memories
		.map(formatMemory)
		.filter((block) => block.length > 0)
		.join("\n\n---\n\n");
}
