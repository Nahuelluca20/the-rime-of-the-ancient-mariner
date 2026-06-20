import { describe, expect, test } from "bun:test";
import { formatMemoriesForContext } from "../../src/memory/context.ts";
import type { AgentMemory } from "../../src/memory/types.ts";

function memory(data: AgentMemory["data"]): AgentMemory {
	return {
		id: 1,
		name: "m",
		projectId: 1,
		createdAt: new Date(0),
		updatedAt: new Date(0),
		data,
	};
}

describe("formatMemoriesForContext", () => {
	test("emits only CONTEXT_FIELDS and joins string arrays with ', '", () => {
		const output = formatMemoriesForContext([
			memory({
				sessionType: "implementation",
				tags: ["x", "y"],
				title: "T",
				ignored: "nope",
			}),
		]);

		expect(output).toBe("sessionType: implementation\ntags: x, y\ntitle: T");
		expect(output).not.toContain("ignored");
	});

	test("drops non-string and non-string-array values", () => {
		const output = formatMemoriesForContext([
			memory({ title: "keep", context: { nested: true }, tags: [1, 2] }),
		]);

		expect(output).toBe("title: keep");
	});

	test("joins multiple memories with a separator", () => {
		const output = formatMemoriesForContext([memory({ title: "A" }), memory({ title: "B" })]);
		expect(output).toBe("title: A\n\n---\n\ntitle: B");
	});

	test("produces no block for an all-empty memory", () => {
		const output = formatMemoriesForContext([memory({ unknown: "x" }), memory({ title: "A" })]);
		expect(output).toBe("title: A");
	});
});
