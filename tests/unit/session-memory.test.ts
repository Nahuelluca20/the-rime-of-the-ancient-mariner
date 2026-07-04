import { describe, expect, test } from "bun:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type {
	CreateMemoryResult,
	MemoryRef,
	MemoryRepository,
	RecentMemoryRow,
	UpdateMemoryResult,
} from "../../src/memory/repository.ts";
import type { AgentMemory, AgentMemoryData, Project } from "../../src/memory/types.ts";
import { createSessionMemory } from "../../src/session/memory.ts";

class FakeMemoryRepository implements MemoryRepository {
	readonly memories = new Map<string, AgentMemory>();
	private nextId = 1;

	findProject(name: string): Project | null {
		return { id: 1, name, createdAt: new Date(0) };
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

function context(
	overrides: { cwd?: string; sessionId?: string; sessionName?: string | null } = {},
) {
	return {
		sessionManager: {
			getSessionId: () => overrides.sessionId ?? "session-1",
			getSessionFile: () => null,
			getSessionName: () =>
				Object.hasOwn(overrides, "sessionName") ? overrides.sessionName : "daily-work",
			getCwd: () => overrides.cwd ?? "/work/the-ancient-mariner",
			getEntries: () => [],
			getLeafId: () => null,
		},
	} as unknown as ExtensionContext;
}

describe("createSessionMemory", () => {
	test("returns a warning when the current session is unnamed", () => {
		const repository = new FakeMemoryRepository();
		const sessionMemory = createSessionMemory(repository);

		const result = sessionMemory.saveSummary(context({ sessionName: null }), {
			title: "T",
			description: "D",
			context: "C",
		});

		expect(result.severity).toBe("warning");
		expect(result.message).toContain("This session has no name");
		expect(repository.countMemories()).toBe(0);
	});

	test("updates metadata for an existing current-session memory", () => {
		const repository = new FakeMemoryRepository();
		repository.createMemory("the-ancient-mariner", "daily-work", { old: true });
		const sessionMemory = createSessionMemory(repository);

		const result = sessionMemory.updateInfo(context({ sessionId: "session-2" }));

		expect(result.severity).toBe("info");
		expect(repository.findMemory("the-ancient-mariner", "daily-work")?.data).toEqual({
			cwd: "/work/the-ancient-mariner",
			sessionId: "session-2",
		});
	});

	test("warns when updating a missing current-session memory", () => {
		const sessionMemory = createSessionMemory(new FakeMemoryRepository());

		const result = sessionMemory.updateInfo(context());

		expect(result.severity).toBe("warning");
		expect(result.message).toContain("No memory named");
	});

	test("creates summaries under the project name derived from cwd", () => {
		const repository = new FakeMemoryRepository();
		const sessionMemory = createSessionMemory(repository);

		const result = sessionMemory.saveSummary(context({ cwd: "/Users/me/project-a" }), {
			title: "Refactor",
			description: "Moved session memory logic.",
			context: "Details",
			sessionType: "implementation",
			tags: ["session", "memory"],
		});

		expect(result.severity).toBe("info");
		expect(repository.findMemory("project-a", "daily-work")?.data).toEqual({
			cwd: "/Users/me/project-a",
			sessionId: "session-1",
			title: "Refactor",
			description: "Moved session memory logic.",
			context: "Details",
			sessionType: "implementation",
			tags: ["session", "memory"],
		});
	});

	test("merges summaries into existing current-session memory data", () => {
		const repository = new FakeMemoryRepository();
		repository.createMemory("the-ancient-mariner", "daily-work", {
			cwd: "/old/cwd",
			sessionId: "old-session",
			title: "Old",
			extra: "preserved",
		});
		const sessionMemory = createSessionMemory(repository);

		const result = sessionMemory.saveSummary(context(), {
			title: "New",
			description: "Updated summary.",
			context: "New context",
		});

		expect(result.severity).toBe("info");
		expect(repository.findMemory("the-ancient-mariner", "daily-work")?.data).toEqual({
			cwd: "/old/cwd",
			sessionId: "old-session",
			title: "New",
			description: "Updated summary.",
			context: "New context",
			extra: "preserved",
		});
	});
});
