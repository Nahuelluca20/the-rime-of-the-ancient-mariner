import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import {
	type Component,
	type Focusable,
	Input,
	Key,
	type KeyId,
	fuzzyMatch,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import type { RecentMemory } from "../memory/catalog.ts";

export interface SelectedMemoryRef {
	projectName: string;
	memoryName: string;
}

export type BrowseScope = "project" | "all";

export interface MemoryBrowserOptions {
	title?: string;
	/** Loaded slice of the store, newest first. */
	entries: RecentMemory[];
	/** Memories in the whole store, so a truncated index can be disclosed. */
	totalCount: number;
	/** Project the session runs in. `null` hides the scope toggle. */
	currentProject: string | null;
	keybindings: KeybindingsManager;
	/** Read on every render so theme switches apply to an open dialog. */
	getTheme: () => Theme;
	/** Read on every render so the dialog resizes with the terminal. */
	terminalRows: () => number;
	requestRender: () => void;
	onSubmit: (selected: SelectedMemoryRef[]) => void;
	onCancel: () => void;
}

/**
 * Overlay dialog for searching memories and inserting them into the LLM context.
 *
 * The dialog is a single mode: a search field always takes typed characters, the
 * result list scrolls under it, and the focused memory's contents are always visible
 * in a preview pane — beside the list on wide terminals, below it on narrow ones.
 *
 * Sizing is derived from the live terminal height on every render, using the same
 * clamp the overlay applies (`maxHeight: "90%"`, `margin: 2`), so the dialog fills
 * what it is given and is never cut off at the bottom.
 */

/** Rows the overlay reserves through `margin: 2` (top + bottom). */
const OVERLAY_VERTICAL_MARGIN = 4;
/** Share of terminal height the overlay allows, mirroring `maxHeight: "90%"`. */
const OVERLAY_HEIGHT_RATIO = 0.9;
/** Height the dialog asks for when the terminal is tall enough. */
const PREFERRED_HEIGHT = 30;
/** Body lines below which a chrome row is dropped to keep the list usable. */
const MIN_BODY_LINES = 4;
/** Content width at which the preview moves beside the list instead of below it. */
const SPLIT_MIN_CONTENT_WIDTH = 88;
const SPLIT_SEPARATOR_WIDTH = 3;
const LIST_WIDTH_RATIO = 0.42;
const MIN_LIST_WIDTH = 32;
const MAX_LIST_WIDTH = 56;
/** Stacked mode only splits off a preview pane when the body has room for both. */
const STACKED_MIN_BODY_LINES = 9;
const STACKED_PREVIEW_RATIO = 0.4;
const MIN_STACKED_PREVIEW_LINES = 3;
/** Below this the preview drops its metadata line and gives the room to content. */
const MIN_PREVIEW_LINES_FOR_FACTS = 7;
/** List width below which the session-type badge is dropped from a row. */
const BADGE_MIN_LIST_WIDTH = 44;
const MAX_BADGE_WIDTH = 12;
const AGE_WIDTH = 4;
const FALLBACK_PAGE_JUMP = 8;
/** Columns the search field needs for its `> ` prompt plus the caret cell. */
const PROMPT_WIDTH = 3;
const SEARCH_PLACEHOLDER = "search name, project, description, or tag";

const PREVIEW_UP_KEYS: readonly KeyId[] = [Key.shift("up"), Key.alt("up")];
const PREVIEW_DOWN_KEYS: readonly KeyId[] = [Key.shift("down"), Key.alt("down")];

/** Short row labels for the session types the save flow writes. */
const SESSION_TYPE_LABELS: Record<string, string> = {
	implementation: "impl",
	"code-exploration": "explore",
	"implementation-exploration": "impl-explore",
	"code-understanding": "understand",
	mixed: "mixed",
};

export interface IndexedMemory {
	entry: RecentMemory;
	/** Lowercased project and memory name, so hits there can outrank hits in prose. */
	titleText: string;
	/** Lowercased full haystack, precomputed so keystrokes do not rebuild strings. */
	searchText: string;
}

export interface BrowserLayout {
	height: number;
	innerWidth: number;
	contentWidth: number;
	showScope: boolean;
	showFooter: boolean;
	split: boolean;
	listWidth: number;
	listLines: number;
	previewWidth: number;
	previewLines: number;
}

export class MemoryBrowserDialog implements Component, Focusable {
	private readonly title?: string;
	private readonly index: IndexedMemory[];
	private readonly totalCount: number;
	private readonly currentProject: string | null;
	private readonly keybindings: KeybindingsManager;
	private readonly getTheme: () => Theme;
	private readonly terminalRows: () => number;
	private readonly requestRender: () => void;
	private readonly onSubmit: (selected: SelectedMemoryRef[]) => void;
	private readonly onCancel: () => void;
	private readonly openedAt = new Date();

	private readonly searchInput = new Input();
	private scope: BrowseScope;
	private filtered: RecentMemory[];
	private focusedIndex = 0;
	private previewScroll = 0;
	private readonly selectedKeys = new Set<string>();
	/** List height from the last render, so page keys jump by a real page. */
	private lastListLines = FALLBACK_PAGE_JUMP;

	private cachedWidth?: number;
	private cachedHeight?: number;
	private cachedLines?: string[];

	private isFocused = false;

	constructor(opts: MemoryBrowserOptions) {
		this.title = opts.title;
		this.index = indexMemories(opts.entries);
		this.totalCount = opts.totalCount;
		this.currentProject = opts.currentProject;
		this.keybindings = opts.keybindings;
		this.getTheme = opts.getTheme;
		this.terminalRows = opts.terminalRows;
		this.requestRender = opts.requestRender;
		this.onSubmit = opts.onSubmit;
		this.onCancel = opts.onCancel;

		// Open on the current project when it has memories, otherwise on everything.
		this.scope =
			this.currentProject && this.index.some((i) => i.entry.projectName === this.currentProject)
				? "project"
				: "all";
		this.filtered = this.computeFiltered();
	}

	get focused(): boolean {
		return this.isFocused;
	}

	/** Propagated to the search field so the hardware cursor lands there for IME input. */
	set focused(value: boolean) {
		this.isFocused = value;
		this.searchInput.focused = value;
	}

	handleInput(data: string): void {
		const kb = this.keybindings;

		if (kb.matches(data, "tui.select.cancel")) {
			this.onCancel();
			return;
		}
		if (kb.matches(data, "tui.select.confirm")) {
			this.submit();
			return;
		}
		if (kb.matches(data, "tui.select.up") || matchesKey(data, Key.ctrl("p"))) {
			this.moveFocus(-1);
			return;
		}
		if (kb.matches(data, "tui.select.down") || matchesKey(data, Key.ctrl("n"))) {
			this.moveFocus(1);
			return;
		}
		if (kb.matches(data, "tui.select.pageUp")) {
			this.moveFocus(-this.lastListLines);
			return;
		}
		if (kb.matches(data, "tui.select.pageDown")) {
			this.moveFocus(this.lastListLines);
			return;
		}
		if (matchesAnyKey(data, PREVIEW_UP_KEYS)) {
			this.scrollPreview(-1);
			return;
		}
		if (matchesAnyKey(data, PREVIEW_DOWN_KEYS)) {
			this.scrollPreview(1);
			return;
		}
		if (matchesKey(data, Key.shift("tab"))) {
			this.toggleScope();
			return;
		}
		if (matchesKey(data, Key.tab)) {
			this.toggleSelection();
			return;
		}

		const before = this.searchInput.getValue();
		this.searchInput.handleInput(data);
		if (this.searchInput.getValue() !== before) {
			this.filtered = this.computeFiltered();
			this.focusedIndex = 0;
			this.previewScroll = 0;
		}
		this.refresh();
	}

	render(width: number): string[] {
		const layout = computeBrowserLayout(width, this.terminalRows(), this.scopeAvailable());
		if (this.cachedLines && this.cachedWidth === width && this.cachedHeight === layout.height) {
			return this.cachedLines;
		}
		this.lastListLines = Math.max(1, layout.listLines);

		const theme = this.getTheme();
		const frame = (s: string) => theme.fg("borderAccent", s);
		const divider = theme.fg("borderMuted", "─".repeat(layout.contentWidth));

		const content: string[] = [this.buildSearchRow(layout, theme)];
		if (layout.showScope) content.push(this.buildScopeRow(layout, theme));
		content.push(divider);
		content.push(...this.buildBody(layout, theme));
		if (layout.showFooter) {
			content.push(divider);
			content.push(this.buildFooter(layout, theme));
		}

		const lines = [this.buildTopBorder(layout, theme)];
		for (const line of content) {
			lines.push(`${frame("│")} ${padTo(line, layout.contentWidth)} ${frame("│")}`);
		}
		lines.push(frame(`╰${"─".repeat(layout.innerWidth)}╯`));

		// A terminal too short for the chrome would otherwise lose its bottom border to
		// the overlay's clamp; drop body lines instead so the dialog still reads as a box.
		const clamped =
			lines.length > layout.height
				? [...lines.slice(0, Math.max(1, layout.height - 1)), lines[lines.length - 1] ?? ""]
				: lines;

		this.cachedLines = clamped;
		this.cachedWidth = width;
		this.cachedHeight = layout.height;
		return clamped;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedHeight = undefined;
		this.cachedLines = undefined;
		this.searchInput.invalidate();
	}

	// ── Rows ──────────────────────────────────────────────────────────────────

	private buildTopBorder(layout: BrowserLayout, theme: Theme): string {
		const frame = (s: string) => theme.fg("borderAccent", s);
		if (!this.title) return frame(`╭${"─".repeat(layout.innerWidth)}╮`);

		const label = truncateToWidth(this.title, Math.max(0, layout.innerWidth - 4), "…");
		const used = visibleWidth(label) + 3; // "─ " + label + " "
		const trailing = Math.max(0, layout.innerWidth - used);
		return `${frame("╭─ ")}${theme.bold(theme.fg("accent", label))}${frame(` ${"─".repeat(trailing)}╮`)}`;
	}

	private buildSearchRow(layout: BrowserLayout, theme: Theme): string {
		const position = this.filtered.length > 0 ? this.focusedIndex + 1 : 0;
		const counts = `${position}/${this.filtered.length}`;
		const selected = this.selectedKeys.size > 0 ? ` · ${this.selectedKeys.size} selected` : "";
		const meta = `${counts}${selected}`;
		const metaWidth = Math.min(visibleWidth(meta), Math.max(0, layout.contentWidth - 10));
		const inputWidth = Math.max(4, layout.contentWidth - metaWidth - 1);

		// Input renders a "> " prompt, the cursor marker, and padding out to the width it
		// is given. An empty field is rendered just wide enough for the prompt and caret
		// so the placeholder can trail it without being padded off the row.
		const empty = this.searchInput.getValue() === "";
		const rendered = this.searchInput.render(empty ? PROMPT_WIDTH : inputWidth)[0] ?? "> ";
		const inputLine = empty ? `${rendered}${theme.fg("dim", SEARCH_PLACEHOLDER)}` : rendered;
		const styledMeta = theme.fg("dim", truncateToWidth(meta, metaWidth, ""));
		return `${padTo(inputLine, inputWidth)} ${styledMeta}`;
	}

	private buildScopeRow(layout: BrowserLayout, theme: Theme): string {
		const loaded = this.index.length;
		const stats =
			loaded < this.totalCount
				? `${this.totalCount} stored · newest ${loaded} loaded`
				: `${this.totalCount} stored`;
		const statsWidth = Math.min(visibleWidth(stats), Math.max(0, layout.contentWidth - 20));
		const leftWidth = Math.max(0, layout.contentWidth - statsWidth - 1);

		// "○ All projects" plus the radio and separator need ~20 columns of their own.
		const project = this.currentProject ?? "";
		const projectLabel = truncateToWidth(project, Math.max(6, leftWidth - 20), "…");
		const scoped = this.scope === "project";
		const left =
			`${scoped ? theme.fg("accent", `◉ ${projectLabel}`) : theme.fg("muted", `○ ${projectLabel}`)}` +
			`${theme.fg("dim", " | ")}` +
			`${scoped ? theme.fg("muted", "○ All projects") : theme.fg("accent", "◉ All projects")}`;

		return `${padTo(left, leftWidth)} ${theme.fg("dim", truncateToWidth(stats, statsWidth, ""))}`;
	}

	private buildBody(layout: BrowserLayout, theme: Theme): string[] {
		const list = this.buildList(layout, theme);
		if (layout.previewLines <= 0) return list;

		const preview = this.buildPreview(layout, theme);
		if (!layout.split) {
			return [...list, theme.fg("borderMuted", "─".repeat(layout.contentWidth)), ...preview];
		}

		const separator = theme.fg("borderMuted", "│");
		const blank = " ".repeat(layout.previewWidth);
		return list.map((line, index) => `${line} ${separator} ${preview[index] ?? blank}`);
	}

	private buildList(layout: BrowserLayout, theme: Theme): string[] {
		const width = layout.listWidth;
		const lines: string[] = [];

		if (this.filtered.length === 0) {
			for (const message of this.emptyStateMessages()) {
				lines.push(padTo(theme.fg("muted", truncateToWidth(message, width, "…")), width));
			}
		} else {
			const start = visibleWindowStart(this.focusedIndex, this.filtered.length, layout.listLines);
			const end = Math.min(this.filtered.length, start + layout.listLines);
			for (let index = start; index < end; index++) {
				const entry = this.filtered[index];
				if (!entry) continue;
				lines.push(this.buildRow(entry, index === this.focusedIndex, layout, theme));
			}
		}

		while (lines.length < layout.listLines) lines.push(" ".repeat(width));
		return lines.slice(0, layout.listLines);
	}

	private buildRow(
		entry: RecentMemory,
		focused: boolean,
		layout: BrowserLayout,
		theme: Theme,
	): string {
		const width = layout.listWidth;
		const cursor = focused ? "› " : "  ";
		const checked = this.selectedKeys.has(selectionKey(entry));
		const checkbox = checked ? "[x] " : "[ ] ";

		const age = padStartTo(
			truncateToWidth(formatAge(entry.updatedAt, this.openedAt), AGE_WIDTH, ""),
			AGE_WIDTH,
		);
		// Every row shares the scoped project, so the prefix would only cost name width.
		const name = this.scope === "project" ? entry.name : `${entry.projectName} / ${entry.name}`;
		const nameRoom = width - visibleWidth(cursor) - visibleWidth(checkbox) - AGE_WIDTH - 2;

		// The badge is a nicety and the name is the identifier, so the badge only appears
		// when the name still fits beside it.
		const badgeText =
			width >= BADGE_MIN_LIST_WIDTH && entry.sessionType
				? truncateToWidth(sessionTypeLabel(entry.sessionType), MAX_BADGE_WIDTH, "")
				: "";
		const badge =
			badgeText && visibleWidth(name) <= nameRoom - visibleWidth(badgeText) - 1
				? ` ${badgeText}`
				: "";

		const labelWidth = Math.max(4, nameRoom - visibleWidth(badge));
		const label = truncateToWidth(name, labelWidth, "…", true);

		const styled =
			`${focused ? theme.fg("accent", cursor) : cursor}` +
			`${checked ? theme.fg("success", checkbox) : theme.fg("dim", checkbox)}` +
			`${focused ? theme.bold(label) : label}` +
			`${badge ? theme.fg("muted", badge) : ""}` +
			`  ${theme.fg("dim", age)}`;

		const padded = padTo(styled, width);
		return focused ? theme.bg("selectedBg", padded) : padded;
	}

	private buildPreview(layout: BrowserLayout, theme: Theme): string[] {
		const width = layout.previewWidth;
		const entry = this.focusedEntry();
		if (!entry) {
			const placeholder = this.filtered.length === 0 ? "" : "No memory focused.";
			return padLines([theme.fg("dim", placeholder)], layout.previewLines, width);
		}

		const head: string[] = [
			theme.bold(
				theme.fg("accent", truncateToWidth(`${entry.projectName} / ${entry.name}`, width, "…")),
			),
		];
		if (layout.previewLines >= MIN_PREVIEW_LINES_FOR_FACTS) {
			const facts = [
				entry.sessionType || null,
				`${formatTimestamp(entry.updatedAt)} · ${formatAge(entry.updatedAt, this.openedAt)} ago`,
				entry.tags.length > 0 ? entry.tags.join(", ") : null,
			].filter((fact): fact is string => fact !== null);
			head.push(theme.fg("dim", truncateToWidth(facts.join(" · "), width, "…")));
			head.push("");
		}

		const body = wrapPreviewText(entry.preview || "(empty memory)", width, theme);
		const room = Math.max(1, layout.previewLines - head.length);
		const overflow = body.length > room;
		const viewport = overflow ? Math.max(1, room - 1) : room;
		const maxScroll = Math.max(0, body.length - viewport);
		const scroll = Math.min(this.previewScroll, maxScroll);

		const lines = [...head, ...body.slice(scroll, scroll + viewport)];
		if (overflow) {
			const position = `${scroll + 1}-${Math.min(body.length, scroll + viewport)}/${body.length}`;
			lines.push(padStartTo(theme.fg("dim", truncateToWidth(position, width, "")), width));
		}
		return padLines(lines, layout.previewLines, width);
	}

	private buildFooter(layout: BrowserLayout, theme: Theme): string {
		const dim = (s: string) => theme.fg("dim", s);
		const muted = (s: string) => theme.fg("muted", s);
		const hint = (keys: string, description: string) => `${dim(keys)} ${muted(description)}`;

		const hints: string[] = [];
		if (this.filtered.length > 0) {
			const arrows = `${this.keyLabel("tui.select.up")}${this.keyLabel("tui.select.down")}`;
			hints.push(hint(arrows, "move"), hint("tab", "select"));
		}
		hints.push(
			hint(this.keyLabel("tui.select.confirm"), "insert"),
			hint(this.keyLabel("tui.select.cancel"), "cancel"),
		);
		if (this.scopeAvailable()) hints.push(hint("shift+tab", "scope"));
		if (layout.previewLines > 0) hints.push(hint("shift+↑↓", "preview"));

		const separator = theme.fg("borderMuted", " · ");
		while (hints.length > 2 && visibleWidth(hints.join(" · ")) > layout.contentWidth) {
			hints.pop();
		}
		return truncateToWidth(hints.join(separator), layout.contentWidth, "");
	}

	private emptyStateMessages(): string[] {
		if (this.index.length === 0) {
			return ["No memories stored yet.", "Save one with /save-summary."];
		}
		const query = this.searchInput.getValue().trim();
		if (query) {
			const messages = [`No memories match "${query}".`];
			if (this.scope === "project") messages.push("shift+tab searches every project.");
			return messages;
		}
		return ["No memories in this project.", "shift+tab shows every project."];
	}

	// ── State ─────────────────────────────────────────────────────────────────

	private computeFiltered(): RecentMemory[] {
		return filterMemories(this.index, this.searchInput.getValue(), this.scope, this.currentProject);
	}

	private scopeAvailable(): boolean {
		return this.currentProject !== null;
	}

	private moveFocus(delta: number): void {
		if (this.filtered.length === 0) return;
		const next = clamp(this.focusedIndex + delta, 0, this.filtered.length - 1);
		if (next === this.focusedIndex) return;
		this.focusedIndex = next;
		this.previewScroll = 0;
		this.refresh();
	}

	private scrollPreview(delta: number): void {
		const next = Math.max(0, this.previewScroll + delta);
		if (next === this.previewScroll) return;
		this.previewScroll = next;
		this.refresh();
	}

	private toggleScope(): void {
		if (!this.scopeAvailable()) return;
		this.scope = this.scope === "project" ? "all" : "project";
		this.filtered = this.computeFiltered();
		this.focusedIndex = 0;
		this.previewScroll = 0;
		this.refresh();
	}

	private toggleSelection(): void {
		const entry = this.focusedEntry();
		if (!entry) return;
		const key = selectionKey(entry);
		if (!this.selectedKeys.delete(key)) this.selectedKeys.add(key);
		this.refresh();
	}

	private submit(): void {
		const selected = [...this.selectedKeys].map(decodeSelectionKey);
		if (selected.length > 0) {
			this.onSubmit(selected);
			return;
		}
		const entry = this.focusedEntry();
		this.onSubmit(entry ? [{ projectName: entry.projectName, memoryName: entry.name }] : []);
	}

	private focusedEntry(): RecentMemory | undefined {
		return this.filtered[this.focusedIndex];
	}

	private keyLabel(
		keybinding: "tui.select.up" | "tui.select.down" | "tui.select.confirm" | "tui.select.cancel",
	): string {
		const keys = this.keybindings.getKeys(keybinding);
		return keys.length > 0 ? formatKeyLabel(keys[0] ?? "") : "";
	}

	private refresh(): void {
		this.invalidate();
		this.requestRender();
	}
}

/**
 * Derives dialog geometry from the terminal, matching the clamp the overlay applies
 * so the rendered box always fits exactly in the space it is given.
 */
export function computeBrowserLayout(
	width: number,
	terminalRows: number,
	scopeAvailable: boolean,
): BrowserLayout {
	const available = Math.max(1, terminalRows - OVERLAY_VERTICAL_MARGIN);
	const overlayCap = Math.max(
		1,
		Math.min(Math.floor(terminalRows * OVERLAY_HEIGHT_RATIO), available),
	);
	const height = Math.min(PREFERRED_HEIGHT, overlayCap);

	const innerWidth = Math.max(1, width - 2);
	const contentWidth = Math.max(1, innerWidth - 2);

	let showScope = scopeAvailable;
	let showFooter = true;
	let bodyLines = height - chromeLines(showScope, showFooter);
	if (bodyLines < MIN_BODY_LINES && showScope) {
		showScope = false;
		bodyLines = height - chromeLines(showScope, showFooter);
	}
	if (bodyLines < MIN_BODY_LINES) {
		showFooter = false;
		bodyLines = height - chromeLines(showScope, showFooter);
	}
	bodyLines = Math.max(1, bodyLines);

	const split = contentWidth >= SPLIT_MIN_CONTENT_WIDTH && bodyLines >= MIN_BODY_LINES;
	if (split) {
		const listWidth = clamp(
			Math.round(contentWidth * LIST_WIDTH_RATIO),
			MIN_LIST_WIDTH,
			MAX_LIST_WIDTH,
		);
		return {
			height,
			innerWidth,
			contentWidth,
			showScope,
			showFooter,
			split,
			listWidth,
			listLines: bodyLines,
			previewWidth: contentWidth - listWidth - SPLIT_SEPARATOR_WIDTH,
			previewLines: bodyLines,
		};
	}

	const previewLines =
		bodyLines >= STACKED_MIN_BODY_LINES
			? Math.max(MIN_STACKED_PREVIEW_LINES, Math.floor(bodyLines * STACKED_PREVIEW_RATIO))
			: 0;
	return {
		height,
		innerWidth,
		contentWidth,
		showScope,
		showFooter,
		split,
		listWidth: contentWidth,
		listLines: previewLines > 0 ? bodyLines - previewLines - 1 : bodyLines,
		previewWidth: contentWidth,
		previewLines,
	};
}

/**
 * Applies the scope filter, then matches what is left against the query.
 *
 * Every space-separated token must appear as a substring, with memories matching in
 * their project or memory name ranked above ones matching only in prose. Substrings
 * rather than subsequences keep a typed word narrowing the list: memory haystacks are
 * long enough that fuzzy matching admits nearly everything. A single-token query that
 * matches nothing literally falls back to fuzzy matching, so abbreviations like
 * `authref` still find `auth-refactor`; a multi-token query is treated as deliberate
 * and returns nothing rather than noise. Equally ranked memories keep their
 * newest-first order.
 */
export function filterMemories(
	index: readonly IndexedMemory[],
	query: string,
	scope: BrowseScope,
	currentProject: string | null,
): RecentMemory[] {
	const scoped =
		scope === "project" && currentProject
			? index.filter((item) => item.entry.projectName === currentProject)
			: [...index];

	const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return scoped.map((item) => item.entry);

	const literal: { entry: RecentMemory; proseOnly: number }[] = [];
	for (const item of scoped) {
		if (!tokens.every((token) => item.searchText.includes(token))) continue;
		const proseOnly = tokens.filter((token) => !item.titleText.includes(token)).length;
		literal.push({ entry: item.entry, proseOnly });
	}
	if (literal.length > 0) {
		literal.sort((a, b) => a.proseOnly - b.proseOnly);
		return literal.map((item) => item.entry);
	}

	const [token] = tokens;
	if (tokens.length > 1 || !token) return [];

	const fuzzy: { entry: RecentMemory; score: number }[] = [];
	for (const item of scoped) {
		const match = fuzzyMatch(token, item.searchText);
		if (match.matches) fuzzy.push({ entry: item.entry, score: match.score });
	}
	fuzzy.sort((a, b) => a.score - b.score);
	return fuzzy.map((item) => item.entry);
}

/** First visible row index for a viewport that keeps the cursor roughly centered. */
export function visibleWindowStart(
	focusedIndex: number,
	total: number,
	visibleCount: number,
): number {
	if (total <= visibleCount) return 0;
	const centered = focusedIndex - Math.floor(visibleCount / 2);
	return clamp(centered, 0, total - visibleCount);
}

/** Builds the lowercased haystacks {@link filterMemories} matches queries against. */
export function indexMemories(entries: readonly RecentMemory[]): IndexedMemory[] {
	return entries.map((entry) => ({
		entry,
		titleText: `${entry.projectName} ${entry.name}`.toLowerCase(),
		searchText: [entry.projectName, entry.name, entry.sessionType, entry.description, ...entry.tags]
			.filter(Boolean)
			.join(" ")
			.toLowerCase(),
	}));
}

export function formatAge(date: Date | null | undefined, now: Date): string {
	if (!date) return "—";
	const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
	if (seconds < 60) return "now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	if (days < 30) return `${Math.floor(days / 7)}w`;
	if (days < 365) return `${Math.floor(days / 30)}mo`;
	return `${Math.floor(days / 365)}y`;
}

/** Local wall-clock timestamp; memories are browsed in the timezone they were saved in. */
export function formatTimestamp(date: Date | null | undefined): string {
	if (!date) return "unknown";
	const pad = (value: number) => String(value).padStart(2, "0");
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
		`${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

function chromeLines(showScope: boolean, showFooter: boolean): number {
	// Both borders, the search row and the divider above the body, plus optional rows.
	return 4 + (showScope ? 1 : 0) + (showFooter ? 2 : 0);
}

/** Renders preview text, highlighting the `field:` headers `formatMemoryPreview` emits. */
function wrapPreviewText(preview: string, width: number, theme: Theme): string[] {
	const lines: string[] = [];
	for (const line of preview.split("\n")) {
		if (line.length === 0) {
			lines.push("");
			continue;
		}
		const styled = /^[A-Za-z_][A-Za-z0-9_]*:$/.test(line) ? theme.fg("accent", line) : line;
		lines.push(...wrapTextWithAnsi(styled, width));
	}
	return lines;
}

function sessionTypeLabel(sessionType: string): string {
	return SESSION_TYPE_LABELS[sessionType] ?? sessionType;
}

function selectionKey(entry: Pick<RecentMemory, "projectName" | "name">): string {
	return `${entry.projectName}\0${entry.name}`;
}

function decodeSelectionKey(key: string): SelectedMemoryRef {
	const [projectName = "", memoryName = ""] = key.split("\0");
	return { projectName, memoryName };
}

function matchesAnyKey(data: string, keys: readonly KeyId[]): boolean {
	return keys.some((key) => matchesKey(data, key));
}

function formatKeyLabel(key: string): string {
	switch (key) {
		case "up":
			return "↑";
		case "down":
			return "↓";
		case "left":
			return "←";
		case "right":
			return "→";
		case "escape":
			return "esc";
		case "pageUp":
			return "pgup";
		case "pageDown":
			return "pgdn";
		default:
			return key;
	}
}

/** Fits text to exactly `width` columns, so no row can push past the dialog frame. */
function padTo(text: string, width: number): string {
	if (visibleWidth(text) > width) return truncateToWidth(text, width, "…", true);
	return `${text}${" ".repeat(Math.max(0, width - visibleWidth(text)))}`;
}

function padStartTo(text: string, width: number): string {
	const padding = Math.max(0, width - visibleWidth(text));
	return `${" ".repeat(padding)}${text}`;
}

function padLines(lines: string[], count: number, width: number): string[] {
	const padded = lines.slice(0, count).map((line) => padTo(line, width));
	while (padded.length < count) padded.push(" ".repeat(width));
	return padded;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
