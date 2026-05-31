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
