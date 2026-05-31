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
		const memories: AgentMemory[] = [];

		for (const info of memoryInfo) {
			const memory = store.getMemory(info.projectName, info.memoryName);
			if (memory) {
				memories.push(memory);
			}
		}

		return memories;
	}

	return {
		getMemories,
	};
}
