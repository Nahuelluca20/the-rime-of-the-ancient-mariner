import { describe, expect, test } from "bun:test";
import { createMemoryLibrary } from "../../src/memory/library.ts";
import type {
	CreateMemoryResult,
	MemoryRef,
	MemoryRepository,
	RecentMemoryRow,
	UpdateMemoryResult,
} from "../../src/memory/repository.ts";
import type { AgentMemory, AgentMemoryData, Project } from "../../src/memory/types.ts";

class FakeMemoryRepository implements MemoryRepository {
	readonly memories = new Map<string, AgentMemory>();
	private nextId = 1;

	findProject(name: string): Project | null {
		return this.hasProject(name) ? { id: 1, name, createdAt: new Date(0) } : null;
	}

	ensureProject(name: string): Project {
		return { id: 1, name, createdAt: new Date(0) };
	}

	createMemory(projectName: string, name: string, data: AgentMemoryData): CreateMemoryResult {
		const key = this.key(projectName, name);
		const existing = this.memories.get(key);
		if (existing) return { memory: existing, created: false };

		const memory = this.memory(name, data);
		this.memories.set(key, memory);
		return { memory, created: true };
	}

	updateMemory(projectName: string, name: string, data: AgentMemoryData): UpdateMemoryResult {
		const key = this.key(projectName, name);
		const existing = this.memories.get(key);
		if (!existing) return { memory: null, updated: false };

		const updated = { ...existing, data };
		this.memories.set(key, updated);
		return { memory: updated, updated: true };
	}

	findMemory(projectName: string, name: string): AgentMemory | null {
		return this.memories.get(this.key(projectName, name)) ?? null;
	}

	findMemories(refs: MemoryRef[]): AgentMemory[] {
		return refs
			.map((ref) => this.findMemory(ref.projectName, ref.name))
			.filter((memory): memory is AgentMemory => memory !== null);
	}

	listMemories(projectName: string): AgentMemory[] {
		const prefix = `${projectName}\0`;
		return [...this.memories.entries()]
			.filter(([key]) => key.startsWith(prefix))
			.map(([, memory]) => memory);
	}

	listRecentMemoryRows(): RecentMemoryRow[] {
		return [];
	}

	countMemories(): number {
		return this.memories.size;
	}

	private hasProject(projectName: string): boolean {
		return [...this.memories.keys()].some((key) => key.startsWith(`${projectName}\0`));
	}

	private key(projectName: string, name: string): string {
		return `${projectName}\0${name}`;
	}

	private memory(name: string, data: AgentMemoryData): AgentMemory {
		return {
			id: this.nextId++,
			name,
			projectId: 1,
			createdAt: new Date(0),
			updatedAt: new Date(0),
			data,
		};
	}
}

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
	return result.content[0]?.text ?? "";
}

describe("createMemoryLibrary", () => {
	test("getMemory returns JSON for an existing memory", () => {
		const repository = new FakeMemoryRepository();
		repository.createMemory("project-a", "memory-a", { title: "Hello" });
		const library = createMemoryLibrary({ repository, sendMessage: () => {} });

		const result = library.getMemory({ projectName: "project-a", memoryName: "memory-a" });

		expect(textOf(result)).toContain('"title": "Hello"');
		expect(result.details?.name).toBe("memory-a");
	});

	test("getMemory reports a miss without creating a project", () => {
		const repository = new FakeMemoryRepository();
		const library = createMemoryLibrary({ repository, sendMessage: () => {} });

		const result = library.getMemory({ projectName: "ghost", memoryName: "missing" });

		expect(textOf(result)).toContain('Memory "missing" not found');
		expect(result.details).toBeNull();
		expect(repository.findProject("ghost")).toBeNull();
	});

	test("listProjectMemories formats names and timestamps", () => {
		const repository = new FakeMemoryRepository();
		repository.createMemory("project-a", "memory-a", {});
		const library = createMemoryLibrary({ repository, sendMessage: () => {} });

		const result = library.listProjectMemories({ projectName: "project-a" });

		expect(textOf(result)).toContain("- memory-a (updated:");
		expect(result.details).toHaveLength(1);
	});

	test("insertMemories frames recalled memories as read-only context", () => {
		const messages: unknown[] = [];
		const options: unknown[] = [];
		const repository = new FakeMemoryRepository();
		repository.createMemory("project-a", "memory-a", {
			title: "Refactor",
			description: "Moved memory logic.",
		});
		const library = createMemoryLibrary({
			repository,
			sendMessage: (message, sendOptions) => {
				messages.push(message);
				options.push(sendOptions);
			},
		});

		const result = library.insertMemories(
			{ memories: [{ projectName: "project-a", memoryName: "memory-a" }] },
			{ triggerTurn: true },
		);

		expect(result.details.memoryLoads).toBe(1);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toMatchObject({ customType: "memories", display: true });
		expect(JSON.stringify(messages[0])).toContain("<recalled_memories read_only");
		expect(JSON.stringify(messages[0])).toContain("Do NOT save a new session summary");
		expect(options[0]).toEqual({ deliverAs: "steer", triggerTurn: true });
	});

	test("insertMemories skips sendMessage when no formatted memory content exists", () => {
		const messages: unknown[] = [];
		const repository = new FakeMemoryRepository();
		repository.createMemory("project-a", "empty", { other: "not included in context" });
		const library = createMemoryLibrary({
			repository,
			sendMessage: (message) => messages.push(message),
		});

		const result = library.insertMemories({
			memories: [{ projectName: "project-a", memoryName: "empty" }],
		});

		expect(result.details.memoryLoads).toBe(1);
		expect(messages).toHaveLength(0);
	});
});
