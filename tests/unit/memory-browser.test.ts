import { describe, expect, test } from "bun:test";
import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import {
	TUI_KEYBINDINGS,
	KeybindingsManager as TuiKeybindingsManager,
	visibleWidth,
} from "@earendil-works/pi-tui";
import type { RecentMemory } from "../../src/memory/catalog.ts";
import {
	MemoryBrowserDialog,
	type SelectedMemoryRef,
	computeBrowserLayout,
	filterMemories,
	formatAge,
	formatTimestamp,
	indexMemories,
	visibleWindowStart,
} from "../../src/ui/memory-browser.ts";

/** Height the overlay allows for `maxHeight: "90%"` with `margin: 2` (see pi-tui tui.ts). */
function overlayCap(terminalRows: number): number {
	return Math.max(1, Math.min(Math.floor(terminalRows * 0.9), Math.max(1, terminalRows - 4)));
}

function memory(overrides: Partial<RecentMemory> = {}): RecentMemory {
	return {
		projectName: "the-ancient-mariner",
		name: "auth-refactor",
		description: "JWT rotation and session store",
		sessionType: "implementation",
		tags: ["auth", "tokens"],
		preview: "title:\nAuth refactor\n\ndescription:\nJWT rotation and session store",
		updatedAt: new Date("2026-08-09T10:00:00Z"),
		...overrides,
	};
}

const stubTheme = {
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
	bold: (text: string) => text,
} as unknown as Theme;

interface Harness {
	dialog: MemoryBrowserDialog;
	submitted: SelectedMemoryRef[][];
	cancelled: number;
	type: (text: string) => void;
}

function harness(entries: RecentMemory[], terminalRows = 40, currentProject = "proj-a"): Harness {
	const submitted: SelectedMemoryRef[][] = [];
	const state = { cancelled: 0 };
	const dialog = new MemoryBrowserDialog({
		title: "Memory Library",
		entries,
		totalCount: entries.length,
		currentProject,
		keybindings: new TuiKeybindingsManager(TUI_KEYBINDINGS) as unknown as KeybindingsManager,
		getTheme: () => stubTheme,
		terminalRows: () => terminalRows,
		requestRender: () => {},
		onSubmit: (selected) => submitted.push(selected),
		onCancel: () => {
			state.cancelled += 1;
		},
	});
	return {
		dialog,
		submitted,
		get cancelled() {
			return state.cancelled;
		},
		type: (text: string) => {
			for (const char of text) dialog.handleInput(char);
		},
	};
}

function dialog(entries: RecentMemory[], terminalRows: number): MemoryBrowserDialog {
	return harness(entries, terminalRows, "the-ancient-mariner").dialog;
}

const KEY = {
	enter: "\r",
	escape: "\x1b",
	tab: "\t",
	shiftTab: "\x1b[Z",
	down: "\x1b[B",
	up: "\x1b[A",
	backspace: "\x7f",
} as const;

describe("computeBrowserLayout", () => {
	test("never asks for more height than the overlay will render", () => {
		for (let rows = 6; rows <= 80; rows++) {
			const layout = computeBrowserLayout(100, rows, true);
			expect(layout.height).toBeLessThanOrEqual(overlayCap(rows));
		}
	});

	test("uses the full allowance on short terminals instead of a fixed height", () => {
		expect(computeBrowserLayout(100, 24, true).height).toBe(overlayCap(24));
		expect(computeBrowserLayout(100, 20, true).height).toBe(overlayCap(20));
	});

	test("caps at the preferred height on tall terminals", () => {
		expect(computeBrowserLayout(100, 60, true).height).toBe(30);
	});

	test("drops chrome rows before starving the list", () => {
		const tight = computeBrowserLayout(100, 12, true);
		expect(tight.listLines).toBeGreaterThanOrEqual(1);

		const tiny = computeBrowserLayout(100, 8, true);
		expect(tiny.showScope).toBe(false);
		expect(tiny.listLines).toBeGreaterThanOrEqual(1);
	});

	test("splits the body into two columns only when wide enough", () => {
		const wide = computeBrowserLayout(120, 40, true);
		expect(wide.split).toBe(true);
		expect(wide.listWidth + wide.previewWidth + 3).toBe(wide.contentWidth);
		expect(wide.previewLines).toBe(wide.listLines);

		const narrow = computeBrowserLayout(70, 40, true);
		expect(narrow.split).toBe(false);
		expect(narrow.listWidth).toBe(narrow.contentWidth);
		expect(narrow.previewLines).toBeGreaterThan(0);
	});
});

describe("MemoryBrowserDialog.render", () => {
	const entries = [
		memory({ name: "auth-refactor" }),
		memory({ name: "plan-mode-notes", sessionType: "mixed" }),
		memory({ projectName: "pi-playwright", name: "selector-audit", sessionType: "" }),
	];

	const sizes: Array<{ width: number; rows: number }> = [
		{ width: 120, rows: 50 },
		{ width: 120, rows: 24 },
		{ width: 100, rows: 30 },
		{ width: 89, rows: 30 },
		{ width: 88, rows: 30 },
		{ width: 72, rows: 24 },
		{ width: 68, rows: 26 },
		{ width: 64, rows: 18 },
		{ width: 62, rows: 14 },
		{ width: 62, rows: 9 },
		{ width: 41, rows: 20 },
	];

	test("fills exactly the height it claims, at every size", () => {
		for (const { width, rows } of sizes) {
			const lines = dialog(entries, rows).render(width);
			const layout = computeBrowserLayout(width, rows, true);
			expect(lines.length).toBe(layout.height);
			expect(lines.length).toBeLessThanOrEqual(overlayCap(rows));
		}
	});

	test("emits lines of exactly the requested width", () => {
		for (const { width, rows } of sizes) {
			for (const line of dialog(entries, rows).render(width)) {
				expect(visibleWidth(line)).toBe(width);
			}
		}
	});

	test("keeps the box closed on terminals too short for the chrome", () => {
		const lines = dialog(entries, 7).render(80);
		expect(lines[0]?.startsWith("╭")).toBe(true);
		expect(lines[lines.length - 1]?.startsWith("╰")).toBe(true);
	});

	test("renders an empty store without a preview pane crash", () => {
		const lines = dialog([], 30).render(100);
		expect(lines.join("\n")).toContain("No memories stored yet.");
	});
});

describe("MemoryBrowserDialog keyboard flow", () => {
	const entries = [
		memory({ projectName: "proj-a", name: "auth-refactor", description: "token rotation" }),
		memory({ projectName: "proj-a", name: "plan-mode", description: "editor guard rails" }),
		memory({ projectName: "proj-b", name: "selector-audit", description: "locator strategy" }),
	];

	test("typed characters filter the list", () => {
		const app = harness(entries);
		app.type("plan");
		expect(app.dialog.render(100).join("\n")).toContain("plan-mode");
		expect(app.dialog.render(100)).not.toContain("auth-refactor");
	});

	test("backspace restores earlier results", () => {
		const app = harness(entries);
		app.type("plan");
		app.dialog.handleInput(KEY.backspace);
		app.dialog.handleInput(KEY.backspace);
		app.dialog.handleInput(KEY.backspace);
		app.dialog.handleInput(KEY.backspace);
		expect(app.dialog.render(100).join("\n")).toContain("auth-refactor");
	});

	test("enter inserts the focused memory when nothing is checked", () => {
		const app = harness(entries);
		app.dialog.handleInput(KEY.down);
		app.dialog.handleInput(KEY.enter);
		expect(app.submitted).toEqual([[{ projectName: "proj-a", memoryName: "plan-mode" }]]);
	});

	test("tab checks memories and enter inserts the checked set", () => {
		const app = harness(entries);
		app.dialog.handleInput(KEY.tab);
		app.dialog.handleInput(KEY.down);
		app.dialog.handleInput(KEY.tab);
		app.dialog.handleInput(KEY.enter);
		expect(app.submitted).toEqual([
			[
				{ projectName: "proj-a", memoryName: "auth-refactor" },
				{ projectName: "proj-a", memoryName: "plan-mode" },
			],
		]);
	});

	test("checked memories survive a search that hides them", () => {
		const app = harness(entries);
		app.dialog.handleInput(KEY.tab);
		app.type("plan");
		app.dialog.handleInput(KEY.enter);
		expect(app.submitted).toEqual([[{ projectName: "proj-a", memoryName: "auth-refactor" }]]);
	});

	test("tab on a checked memory unchecks it", () => {
		const app = harness(entries);
		app.dialog.handleInput(KEY.tab);
		app.dialog.handleInput(KEY.tab);
		app.dialog.handleInput(KEY.enter);
		expect(app.submitted).toEqual([[{ projectName: "proj-a", memoryName: "auth-refactor" }]]);
	});

	test("shift+tab widens the scope to every project", () => {
		const app = harness(entries);
		expect(app.dialog.render(100).join("\n")).not.toContain("selector-audit");
		app.dialog.handleInput(KEY.shiftTab);
		expect(app.dialog.render(100).join("\n")).toContain("selector-audit");
	});

	test("escape cancels", () => {
		const app = harness(entries);
		app.dialog.handleInput(KEY.escape);
		expect(app.cancelled).toBe(1);
		expect(app.submitted).toEqual([]);
	});

	test("enter on an empty result set submits nothing", () => {
		const app = harness(entries);
		app.type("zzzzq");
		app.dialog.handleInput(KEY.enter);
		expect(app.submitted).toEqual([[]]);
	});

	test("the cursor stops at the ends of the list", () => {
		const app = harness(entries);
		for (let i = 0; i < 10; i++) app.dialog.handleInput(KEY.down);
		app.dialog.handleInput(KEY.enter);
		expect(app.submitted).toEqual([[{ projectName: "proj-a", memoryName: "plan-mode" }]]);

		const second = harness(entries);
		for (let i = 0; i < 10; i++) second.dialog.handleInput(KEY.up);
		second.dialog.handleInput(KEY.enter);
		expect(second.submitted).toEqual([[{ projectName: "proj-a", memoryName: "auth-refactor" }]]);
	});
});

describe("filterMemories", () => {
	const entries = [
		memory({ projectName: "proj-a", name: "auth-refactor", description: "token rotation" }),
		memory({ projectName: "proj-a", name: "plan-mode", description: "editor guard rails" }),
		memory({ projectName: "proj-b", name: "selector-audit", description: "locator strategy" }),
	];
	const index = indexMemories(entries);

	test("scopes to the current project", () => {
		const scoped = filterMemories(index, "", "project", "proj-a");
		expect(scoped.map((entry) => entry.name)).toEqual(["auth-refactor", "plan-mode"]);
	});

	test("returns every project when scope is all", () => {
		expect(filterMemories(index, "", "all", "proj-a")).toHaveLength(3);
	});

	test("matches on name, description, and tags", () => {
		expect(filterMemories(index, "locator", "all", "proj-a").map((e) => e.name)).toEqual([
			"selector-audit",
		]);
		expect(filterMemories(index, "rotation", "all", "proj-a").map((e) => e.name)).toEqual([
			"auth-refactor",
		]);
		expect(filterMemories(index, "tokens", "all", "proj-a")).toHaveLength(3);
	});

	test("narrows on typed words instead of matching scattered letters", () => {
		expect(filterMemories(index, "rota", "all", "proj-a").map((e) => e.name)).toEqual([
			"auth-refactor",
		]);
	});

	test("ranks name matches above description matches", () => {
		const withProse = indexMemories([
			memory({ projectName: "proj-a", name: "notes", description: "audit of the selector map" }),
			memory({ projectName: "proj-a", name: "selector-audit", description: "locator strategy" }),
		]);
		expect(filterMemories(withProse, "selector", "all", "proj-a").map((e) => e.name)).toEqual([
			"selector-audit",
			"notes",
		]);
	});

	test("requires every space-separated token to match", () => {
		expect(filterMemories(index, "plan editor", "all", "proj-a").map((e) => e.name)).toEqual([
			"plan-mode",
		]);
	});

	test("falls back to fuzzy matching for a single unmatched token", () => {
		expect(filterMemories(index, "authref", "all", "proj-a").map((e) => e.name)).toEqual([
			"auth-refactor",
		]);
	});

	test("returns nothing rather than noise for a multi-token miss", () => {
		expect(filterMemories(index, "plan locator", "all", "proj-a")).toEqual([]);
	});

	test("search reaches outside the scoped project only when scope is all", () => {
		expect(filterMemories(index, "selector", "project", "proj-a")).toEqual([]);
		expect(filterMemories(index, "selector", "all", "proj-a")).toHaveLength(1);
	});
});

describe("visibleWindowStart", () => {
	test("shows everything when the list fits", () => {
		expect(visibleWindowStart(0, 3, 10)).toBe(0);
		expect(visibleWindowStart(2, 3, 10)).toBe(0);
	});

	test("centers the cursor once the list overflows", () => {
		expect(visibleWindowStart(10, 100, 10)).toBe(5);
	});

	test("clamps at both ends", () => {
		expect(visibleWindowStart(0, 100, 10)).toBe(0);
		expect(visibleWindowStart(99, 100, 10)).toBe(90);
	});
});

describe("formatAge", () => {
	const now = new Date("2026-08-09T12:00:00Z");
	const ago = (ms: number) => new Date(now.getTime() - ms);

	test("buckets by the largest fitting unit", () => {
		expect(formatAge(ago(5_000), now)).toBe("now");
		expect(formatAge(ago(5 * 60_000), now)).toBe("5m");
		expect(formatAge(ago(3 * 3_600_000), now)).toBe("3h");
		expect(formatAge(ago(3 * 86_400_000), now)).toBe("3d");
		expect(formatAge(ago(14 * 86_400_000), now)).toBe("2w");
		expect(formatAge(ago(60 * 86_400_000), now)).toBe("2mo");
		expect(formatAge(ago(800 * 86_400_000), now)).toBe("2y");
	});

	test("handles a missing date", () => {
		expect(formatAge(null, now)).toBe("—");
	});
});

describe("formatTimestamp", () => {
	test("renders local wall-clock time, not UTC", () => {
		const date = new Date(2026, 7, 9, 14, 5);
		expect(formatTimestamp(date)).toBe("2026-08-09 14:05");
	});
});
