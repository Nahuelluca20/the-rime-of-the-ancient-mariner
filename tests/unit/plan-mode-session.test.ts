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
	test("does not enable subagent tools when entering plan mode", () => {
		const { activeTools, ctx, session } = createHarness();

		session.handleCommand("on", ctx);

		expect(activeTools()).not.toContain("list_available_subagents");
		expect(activeTools()).not.toContain("subagent_execute");
		expect(activeTools()).not.toContain("edit");
		expect(activeTools()).not.toContain("write");
		expect(session.blockToolCall({ toolName: "list_available_subagents", input: {} })).toEqual({
			block: true,
			reason:
				"Plan mode blocks the list_available_subagents tool. Only read-only tools are available.",
		});
	});

	test("keeps enabled subagent tools available with plan-mode restrictions", () => {
		const { activeTools, ctx, session } = createHarness();
		session.setSubagentsEnabled(true);

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

	test("updates subagent tools immediately while plan mode is active", () => {
		const { activeTools, ctx, session } = createHarness();
		session.handleCommand("on", ctx);

		session.setSubagentsEnabled(true);
		expect(activeTools()).toContain("list_available_subagents");
		expect(activeTools()).toContain("subagent_execute");

		session.setSubagentsEnabled(false);
		expect(activeTools()).not.toContain("list_available_subagents");
		expect(activeTools()).not.toContain("subagent_execute");
	});

	test("preserves the latest subagent state when leaving plan mode", () => {
		const { activeTools, ctx, session } = createHarness();
		session.handleCommand("on", ctx);
		session.setSubagentsEnabled(true);

		session.handleCommand("off", ctx);

		expect(activeTools()).toContain("list_available_subagents");
		expect(activeTools()).toContain("subagent_execute");

		session.handleCommand("on", ctx);
		session.setSubagentsEnabled(false);
		session.handleCommand("off", ctx);

		expect(activeTools()).not.toContain("list_available_subagents");
		expect(activeTools()).not.toContain("subagent_execute");
	});
});
