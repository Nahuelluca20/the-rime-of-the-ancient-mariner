import { describe, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	SUBAGENTS_AVAILABILITY_CHANGED_EVENT,
	openSubagentsSession,
} from "../../src/subagents/session.ts";

function createHarness(hasUI = true) {
	const toolNames = ["read", "list_available_subagents", "subagent_execute"];
	let activeTools = [...toolNames];
	const statuses: Array<[string, string | undefined]> = [];
	const notifications: Array<[string, string | undefined]> = [];
	const events: Array<[string, unknown]> = [];
	const pi = {
		events: {
			emit(channel: string, data: unknown) {
				events.push([channel, data]);
			},
			on: () => () => {},
		},
		getActiveTools: () => [...activeTools],
		getAllTools: () => toolNames.map((name) => ({ name })),
		setActiveTools(names: string[]) {
			activeTools = [...names];
		},
	} as unknown as ExtensionAPI;
	const ctx = {
		hasUI,
		ui: {
			notify(message: string, level?: string) {
				notifications.push([message, level]);
			},
			setStatus(key: string, value: string | undefined) {
				statuses.push([key, value]);
			},
		},
	} as unknown as ExtensionContext;

	return {
		activeTools: () => activeTools,
		ctx,
		events,
		notifications,
		session: openSubagentsSession(pi),
		statuses,
	};
}

describe("openSubagentsSession", () => {
	test("starts disabled and preserves unrelated active tools", () => {
		const { activeTools, ctx, events, notifications, session, statuses } = createHarness();

		session.restore(ctx, false);

		expect(activeTools()).toEqual(["read"]);
		expect(statuses.at(-1)).toEqual(["subagents", "subagents: off"]);
		expect(notifications).toEqual([]);
		expect(events.at(-1)).toEqual([SUBAGENTS_AVAILABILITY_CHANGED_EVENT, { enabled: false }]);
	});

	test("starts enabled when requested", () => {
		const { activeTools, ctx, session, statuses } = createHarness();

		session.restore(ctx, true);

		expect(activeTools()).toEqual(["read", "list_available_subagents", "subagent_execute"]);
		expect(statuses.at(-1)).toEqual(["subagents", "subagents: on"]);
	});

	test("toggles both tools and notifies the user", () => {
		const { activeTools, ctx, notifications, session } = createHarness();
		session.restore(ctx, false);

		session.toggle(ctx);
		expect(activeTools()).toEqual(["read", "list_available_subagents", "subagent_execute"]);
		expect(notifications.at(-1)).toEqual(["Subagents enabled.", "info"]);

		session.toggle(ctx);
		expect(activeTools()).toEqual(["read"]);
		expect(notifications.at(-1)).toEqual(["Subagents disabled.", "info"]);
	});

	test("blocks stale subagent calls only while disabled", () => {
		const { ctx, session } = createHarness();
		session.restore(ctx, false);

		expect(session.blockToolCall({ toolName: "list_available_subagents" })).toEqual({
			block: true,
			reason: "Subagents are disabled. Run /subagents to enable them.",
		});
		expect(session.blockToolCall({ toolName: "subagent_execute" })).toEqual({
			block: true,
			reason: "Subagents are disabled. Run /subagents to enable them.",
		});
		expect(session.blockToolCall({ toolName: "read" })).toBeUndefined();

		session.toggle(ctx);
		expect(session.blockToolCall({ toolName: "subagent_execute" })).toBeUndefined();
	});

	test("restore resets a runtime toggle from the startup flag", () => {
		const { activeTools, ctx, session } = createHarness();
		session.restore(ctx, false);
		session.toggle(ctx);

		session.restore(ctx, false);

		expect(activeTools()).toEqual(["read"]);
	});

	test("skips UI output when no UI is available", () => {
		const { ctx, notifications, session, statuses } = createHarness(false);

		session.restore(ctx, false);
		session.toggle(ctx);

		expect(statuses).toEqual([]);
		expect(notifications).toEqual([]);
	});
});
