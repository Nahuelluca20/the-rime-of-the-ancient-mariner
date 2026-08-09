import { describe, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { openPlanModeSession } from "../../src/plan-mode/session.ts";

function createHarness() {
	const toolNames = [
		"read",
		"bash",
		"edit",
		"write",
		"list_available_subagents",
		"subagent_execute",
		"plan_exit",
	];
	let activeTools = [...toolNames];
	const entries: Array<{ type: string; customType: string; data: unknown }> = [];
	const pi = {
		appendEntry(customType: string, data: unknown) {
			entries.push({ type: "custom", customType, data });
		},
		getActiveTools: () => [...activeTools],
		getAllTools: () => toolNames.map((name) => ({ name })),
		setActiveTools(names: string[]) {
			activeTools = [...names];
		},
	} as unknown as ExtensionAPI;
	const ctx = {
		hasUI: false,
		sessionManager: { getBranch: () => entries },
	} as unknown as ExtensionContext;

	return {
		activeTools: () => activeTools,
		ctx,
		session: openPlanModeSession(pi, { planTemplatePath: "/unused/plan.md" }),
	};
}

describe("openPlanModeSession", () => {
	test("keeps subagent discovery and execution active while blocking write tools", () => {
		const { activeTools, ctx, session } = createHarness();

		session.handleCommand("on", ctx);

		expect(activeTools()).toContain("list_available_subagents");
		expect(activeTools()).toContain("subagent_execute");
		expect(activeTools()).not.toContain("edit");
		expect(activeTools()).not.toContain("write");
		expect(
			session.blockToolCall({ toolName: "list_available_subagents", input: {} }),
		).toBeUndefined();
		expect(session.blockToolCall({ toolName: "subagent_execute", input: {} })).toBeUndefined();
	});
});
