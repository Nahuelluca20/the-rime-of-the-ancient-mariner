import { describe, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SubagentsPreference } from "../../src/subagents/preferences.ts";
import {
	SUBAGENTS_AVAILABILITY_CHANGED_EVENT,
	openSubagentsSession,
} from "../../src/subagents/session.ts";

function createHarness(hasUI = true, preferenceEnabled = false) {
	const toolNames = ["read", "list_available_subagents", "subagent_execute"];
	let activeTools = [...toolNames];
	let savedPreference = preferenceEnabled;
	let preferenceError: Error | undefined;
	const preferenceWrites: boolean[] = [];
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

	const preference: SubagentsPreference = {
		isEnabled: () => savedPreference,
		setEnabled(enabled) {
			if (preferenceError) throw preferenceError;
			savedPreference = enabled;
			preferenceWrites.push(enabled);
		},
	};

	return {
		activeTools: () => activeTools,
		ctx,
		events,
		notifications,
		preferenceWrites,
		setPreferenceError(error: Error | undefined) {
			preferenceError = error;
		},
		session: openSubagentsSession(pi, preference),
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

	test("restores the persisted preference unless startup forces subagents on", () => {
		const persisted = createHarness(true, true);
		persisted.session.restore(persisted.ctx, false);
		expect(persisted.activeTools()).toEqual([
			"read",
			"list_available_subagents",
			"subagent_execute",
		]);

		const forced = createHarness(true, false);
		forced.session.restore(forced.ctx, true);
		expect(forced.activeTools()).toEqual(["read", "list_available_subagents", "subagent_execute"]);
		expect(forced.preferenceWrites).toEqual([]);
	});

	test("toggles both tools, persists the choice, and notifies the user", () => {
		const { activeTools, ctx, notifications, preferenceWrites, session } = createHarness();
		session.restore(ctx, false);

		session.toggle(ctx);
		expect(activeTools()).toEqual(["read", "list_available_subagents", "subagent_execute"]);
		expect(preferenceWrites).toEqual([true]);
		expect(notifications.at(-1)).toEqual(["Subagents enabled.", "info"]);

		session.toggle(ctx);
		expect(activeTools()).toEqual(["read"]);
		expect(preferenceWrites).toEqual([true, false]);
		expect(notifications.at(-1)).toEqual(["Subagents disabled.", "info"]);
	});

	test("leaves runtime state unchanged when persisting a toggle fails", () => {
		const { activeTools, ctx, session, setPreferenceError } = createHarness();
		session.restore(ctx, false);
		setPreferenceError(new Error("disk full"));

		expect(() => session.toggle(ctx)).toThrow("disk full");
		expect(activeTools()).toEqual(["read"]);
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

	test("restore retains a persisted runtime toggle", () => {
		const { activeTools, ctx, session } = createHarness();
		session.restore(ctx, false);
		session.toggle(ctx);

		session.restore(ctx, false);

		expect(activeTools()).toEqual(["read", "list_available_subagents", "subagent_execute"]);
	});

	test("skips UI output when no UI is available", () => {
		const { ctx, notifications, session, statuses } = createHarness(false);

		session.restore(ctx, false);
		session.toggle(ctx);

		expect(statuses).toEqual([]);
		expect(notifications).toEqual([]);
	});
});
