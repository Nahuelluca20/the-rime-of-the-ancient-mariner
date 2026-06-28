import type { Theme } from "@earendil-works/pi-coding-agent";
import {
	Box,
	Container,
	Key,
	type KeyId,
	Spacer,
	Text,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import type { RecentMemory } from "../memory/store.ts";

export interface SelectedMemoryRef {
	projectName: string;
	memoryName: string;
}

export interface MemoriesTableDialogOptions {
	title?: string;
	rows: RecentMemory[];
	totalRows: number;
	pageSize: number;
	loadPage: (pageIndex: number) => RecentMemory[];
	onSubmit: (selected: SelectedMemoryRef[]) => void;
	onCancel: () => void;
	theme: Theme;
	/**
	 * Total dialog height in lines (including borders). The dialog is padded to this
	 * height in every mode so it never resizes when toggling or scrolling the preview.
	 * Defaults to {@link DEFAULT_MAX_HEIGHT}.
	 */
	maxHeight?: number;
}

/**
 * Overlay dialog for selecting recent memories.
 *
 * Shows memories newest-first, five per page by default. The dialog owns cursor,
 * page, checked state, and preview scrolling so callers only provide page loading
 * and receive the final selected memory refs.
 *
 * Rendering is composed from pi's TUI building blocks (`Container`, `Text`, `Box`,
 * `Spacer`) for the inner content, then wrapped with a full box (`╭│╰`) so the
 * side walls `│` frame every line. Only the bespoke behaviours (multi-select
 * checkboxes, paging, scrollable preview) are kept in-house.
 */

/** Default total dialog height (lines), includes top/bottom borders. */
const DEFAULT_MAX_HEIGHT = 26;
/**
 * Chrome lines excluding the body and the two outer borders: header row, divider,
 * spacer above the footer, and the footer row itself (4 lines). Together with the
 * 2 outer borders (already counted in maxHeight) that is 6, so bodyHeight = maxHeight - 6.
 */
const CHROME_LINES = 6;
/** Lines inside the preview body that are not the viewport: title + scroll info. */
const PREVIEW_CHROME_LINES = 2;

/**
 * Key bindings for the memories table. Each entry pairs the keys that drive an
 * action with the short hint string shown for it in the footer, so rebinding a
 * key touches only one place. `HINTS` below composes the per-arrow hints into the
 * composite phrases the footer displays.
 */
const BINDINGS = {
	previewToggle: { keys: [Key.tab, "a"], hint: "tab/a" },
	up: { keys: [Key.up, "k"], hint: "↑" },
	down: { keys: [Key.down, "j"], hint: "↓" },
	left: { keys: [Key.left, "h"], hint: "←" },
	right: { keys: [Key.right, "l"], hint: "→" },
} as const satisfies Record<string, { keys: readonly KeyId[]; hint: string }>;

const HINTS = {
	vertical: `${BINDINGS.up.hint}${BINDINGS.down.hint}/jk`,
	horizontal: `${BINDINGS.left.hint}/${BINDINGS.right.hint}/hl`,
	previewBack: `${BINDINGS.previewToggle.hint}/esc`,
} as const;

export class MemoriesTableDialog {
	private title?: string;
	private rows: RecentMemory[];
	private totalRows: number;
	private pageSize: number;
	private loadPage: (pageIndex: number) => RecentMemory[];
	private onSubmit: (selected: SelectedMemoryRef[]) => void;
	private onCancel: () => void;
	private theme: Theme;
	private maxHeight: number;

	private pageIndex = 0;
	private focusedIndex = 0;
	private selectedKeys = new Set<string>();

	private previewOpen = false;
	private previewScrollOffset = 0;

	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(opts: MemoriesTableDialogOptions) {
		this.title = opts.title;
		this.rows = opts.rows;
		this.totalRows = opts.totalRows;
		this.pageSize = opts.pageSize;
		this.loadPage = opts.loadPage;
		this.onSubmit = opts.onSubmit;
		this.onCancel = opts.onCancel;
		this.theme = opts.theme;
		this.maxHeight = opts.maxHeight ?? DEFAULT_MAX_HEIGHT;
	}

	/**
	 * Process one raw input chunk. Mutates dialog state and may resolve the dialog
	 * by invoking `onSubmit`/`onCancel`. Does not repaint on its own: per pi's
	 * `Component.handleInput` contract the host must request a render afterwards
	 * (every input, including one that closes the dialog).
	 */
	handleInput(data: string): void {
		if (this.previewOpen) {
			this.handlePreviewInput(data);
			return;
		}

		if (matchesKey(data, Key.escape)) {
			this.onCancel();
			return;
		}

		if (matchesAnyKey(data, BINDINGS.previewToggle.keys)) {
			this.openPreview();
			return;
		}

		if (matchesKey(data, Key.enter)) {
			this.onSubmit(this.getSelectedRefs());
			return;
		}

		if (this.rows.length === 0) {
			this.handlePageInput(data);
			return;
		}

		if (matchesAnyKey(data, BINDINGS.up.keys)) {
			this.focusedIndex = Math.max(0, this.focusedIndex - 1);
			this.invalidate();
			return;
		}

		if (matchesAnyKey(data, BINDINGS.down.keys)) {
			this.focusedIndex = Math.min(this.rows.length - 1, this.focusedIndex + 1);
			this.invalidate();
			return;
		}

		if (matchesKey(data, Key.space) || data === " ") {
			const current = this.currentRow();
			if (current) this.toggleSelected(current);
			return;
		}

		this.handlePageInput(data);
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const theme = this.theme;
		const accent = (s: string) => theme.fg("accent", s);
		const muted = (s: string) => theme.fg("dim", s);
		const warning = (s: string) => theme.fg("warning", s);
		const success = (s: string) => theme.fg("success", s);
		const wall = (s: string) => theme.fg("accent", s);

		// Inner area between the side walls.
		const innerW = Math.max(0, width - 2);
		// Text components use paddingX = 1, so content sits one cell in from each wall.
		const contentW = Math.max(1, innerW - 2);

		// ── Build the inner content (no borders, no side walls) ──
		const inner = new Container();

		// Header: counts (truncated so it stays a single line).
		const pageLabel = `Page ${this.pageIndex + 1}/${this.pageCount()}`;
		const countLabel = `${this.selectedKeys.size} selected`;
		const header = truncateToWidth(
			`${theme.bold("Recent memories")} ${muted(pageLabel)} ${muted(countLabel)}`,
			contentW,
			"",
		);
		inner.addChild(new Text(header, 1, 0));
		inner.addChild(new Text(muted("─".repeat(contentW)), 1, 0));

		// Body section, padded to a fixed height so the dialog never resizes.
		const body = new Container();
		if (this.totalRows === 0) {
			body.addChild(new Text(warning("No memories found."), 1, 0));
		} else if (this.previewOpen) {
			this.buildPreview(body, innerW, contentW, muted, warning, accent);
		} else {
			this.buildRows(body, contentW, muted, accent, success);
		}
		const bodyHeight = this.bodyHeight();
		const bodyLineCount = body.render(innerW).length;
		inner.addChild(body);
		const bodyPadding = Math.max(0, bodyHeight - bodyLineCount);
		if (bodyPadding > 0) {
			inner.addChild(new Spacer(bodyPadding));
		}

		// Footer (pre-truncated so it occupies a single line).
		inner.addChild(new Spacer(1));
		inner.addChild(new Text(muted(truncateToWidth(this.footerHint(), contentW, "")), 1, 0));

		const innerLines = inner.render(innerW);

		// ── Assemble the boxed view: top border (with title), walled lines, bottom ──
		const lines: string[] = [];
		if (this.title) {
			const label = truncateToWidth(` ${this.title} `, innerW, "");
			const dashes = "─".repeat(Math.max(0, innerW - visibleWidth(label)));
			lines.push(wall(`╭${label}${dashes}╮`));
		} else {
			lines.push(wall(`╭${"─".repeat(innerW)}╮`));
		}

		for (const line of innerLines) {
			lines.push(`${wall("│")}${padToWidth(line, innerW)}${wall("│")}`);
		}

		lines.push(wall(`╰${"─".repeat(innerW)}╯`));

		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	private buildRows(
		body: Container,
		contentW: number,
		muted: (s: string) => string,
		accent: (s: string) => string,
		success: (s: string) => string,
	): void {
		const theme = this.theme;
		const selectedBg = (s: string) => theme.bg("selectedBg", s);

		for (let index = 0; index < this.rows.length; index++) {
			const row = this.rows[index];
			if (!row) continue;
			const focused = index === this.focusedIndex;

			const cursor = focused ? ">" : " ";
			const checked = this.selectedKeys.has(SelectionKeys.encode(row));
			const checkbox = checked ? success("[x]") : muted("[ ]");
			const updated = formatDate(row.updatedAt);
			const prefix = `${cursor} ${checkbox} `;
			const datePart = muted(updated);
			const name = `${row.projectName} / ${row.name}`;
			const main = focused ? accent(theme.bold(name)) : name;
			const mainWidth = Math.max(8, contentW - visibleWidth(prefix) - updated.length - 1);
			const titleLine = truncateToWidth(
				`${prefix}${padToWidth(main, mainWidth)} ${datePart}`,
				contentW,
				"",
			);

			const description = row.description || "(no description)";
			const typeBadge = formatSessionTypeBadge(row.sessionType, accent);
			const descriptionText = typeBadge ? `${typeBadge} ${muted(description)}` : muted(description);
			const descriptionLine = truncateToWidth(`    ${descriptionText}`, contentW, "");

			const rowGroup = new Container();
			rowGroup.addChild(new Text(titleLine, 1, 0));
			rowGroup.addChild(new Text(descriptionLine, 1, 0));

			if (focused) {
				// Box paints the selected background across the full inner width.
				const focusedBox = new Box(0, 0, selectedBg);
				focusedBox.addChild(rowGroup);
				body.addChild(focusedBox);
			} else {
				body.addChild(rowGroup);
			}

			if (index < this.rows.length - 1) {
				body.addChild(new Spacer(1));
			}
		}
	}

	private buildPreview(
		body: Container,
		innerW: number,
		contentW: number,
		muted: (s: string) => string,
		warning: (s: string) => string,
		accent: (s: string) => string,
	): void {
		const theme = this.theme;
		const row = this.currentRow();
		if (!row) {
			body.addChild(new Text(warning("No memory focused."), 1, 0));
			return;
		}

		body.addChild(
			new Text(
				truncateToWidth(
					accent(theme.bold(`Preview: ${row.projectName} / ${row.name}`)),
					contentW,
					"",
				),
				1,
				0,
			),
		);

		// Let the pi Text component word-wrap the preview, then viewport-slice it.
		const previewComp = new Text(row.preview || "(no preview available)", 1, 0);
		const wrapped = previewComp.render(innerW);

		const viewportHeight = this.previewViewportHeight();
		// `previewScrollOffset` is a request; clip it for display only. The field is
		// left untouched so handlePreviewInput owns the only mutation path.
		const maxScrollOffset = Math.max(0, wrapped.length - viewportHeight);
		const scrollOffset = Math.min(this.previewScrollOffset, maxScrollOffset);

		const endLine = Math.min(wrapped.length, scrollOffset + viewportHeight);
		const scrollInfo =
			wrapped.length > viewportHeight
				? `lines ${scrollOffset + 1}-${endLine}/${wrapped.length}`
				: `${wrapped.length} line${wrapped.length === 1 ? "" : "s"}`;
		body.addChild(new Text(muted(truncateToWidth(scrollInfo, contentW, "")), 1, 0));

		for (const line of wrapped.slice(scrollOffset, endLine)) {
			body.addChild(new Text(line, 1, 0));
		}

		const remaining = viewportHeight - (endLine - scrollOffset);
		if (remaining > 0) {
			body.addChild(new Spacer(remaining));
		}
	}

	private handlePreviewInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesAnyKey(data, BINDINGS.previewToggle.keys)) {
			this.closePreview();
			return;
		}

		if (matchesAnyKey(data, BINDINGS.up.keys)) {
			this.previewScrollOffset = Math.max(0, this.previewScrollOffset - 1);
			this.invalidate();
			return;
		}

		if (matchesAnyKey(data, BINDINGS.down.keys)) {
			this.previewScrollOffset += 1;
			this.invalidate();
			return;
		}

		if (matchesKey(data, Key.enter)) {
			this.onSubmit(this.getSelectedRefs());
			return;
		}

		if (matchesKey(data, Key.space) || data === " ") {
			const current = this.currentRow();
			if (current) this.toggleSelected(current);
		}
	}

	private openPreview(): void {
		if (!this.currentRow()) return;
		this.previewOpen = true;
		this.previewScrollOffset = 0;
		this.invalidate();
	}

	private closePreview(): void {
		this.previewOpen = false;
		this.previewScrollOffset = 0;
		this.invalidate();
	}

	private handlePageInput(data: string): void {
		if (matchesAnyKey(data, BINDINGS.left.keys)) {
			this.goToPage(Math.max(0, this.pageIndex - 1));
		} else if (matchesAnyKey(data, BINDINGS.right.keys)) {
			this.goToPage(Math.min(this.pageCount() - 1, this.pageIndex + 1));
		}
	}

	private goToPage(nextPageIndex: number): void {
		if (nextPageIndex === this.pageIndex) return;
		this.pageIndex = nextPageIndex;
		this.rows = this.loadPage(nextPageIndex);
		this.focusedIndex = Math.min(this.focusedIndex, Math.max(0, this.rows.length - 1));
		this.closePreview();
	}

	private toggleSelected(memory: RecentMemory): void {
		const key = SelectionKeys.encode(memory);
		if (this.selectedKeys.has(key)) {
			this.selectedKeys.delete(key);
		} else {
			this.selectedKeys.add(key);
		}
		this.invalidate();
	}

	private getSelectedRefs(): SelectedMemoryRef[] {
		return [...this.selectedKeys].map(SelectionKeys.decode);
	}

	private currentRow(): RecentMemory | undefined {
		return this.rows[this.focusedIndex];
	}

	private footerHint(): string {
		const hints = HINTS;
		if (this.previewOpen)
			return `${hints.vertical} scroll preview • space select • enter insert • ${hints.previewBack} back`;
		return `${hints.vertical} navigate • ${BINDINGS.previewToggle.hint} preview • space select • ${hints.horizontal} pages • enter insert • esc cancel`;
	}

	/** Fixed body region height, so row mode and preview mode occupy the same space. */
	private bodyHeight(): number {
		return Math.max(0, this.maxHeight - CHROME_LINES);
	}

	/** Preview viewport lines = body height minus the preview title + scroll info. */
	private previewViewportHeight(): number {
		return Math.max(1, this.bodyHeight() - PREVIEW_CHROME_LINES);
	}

	private pageCount(): number {
		return Math.max(1, Math.ceil(this.totalRows / this.pageSize));
	}
}

function formatSessionTypeBadge(
	sessionType: string | null | undefined,
	decorate: (text: string) => string,
): string {
	if (!sessionType) return "";
	return decorate(`[${sessionType}]`);
}

const SelectionKeys = {
	encode(ref: Pick<RecentMemory, "projectName" | "name">): string {
		return `${ref.projectName}\0${ref.name}`;
	},
	decode(key: string): SelectedMemoryRef {
		const [projectName = "", memoryName = ""] = key.split("\0");
		return { projectName, memoryName };
	},
};

function matchesAnyKey(data: string, keys: readonly KeyId[]): boolean {
	return keys.some((key) => matchesKey(data, key));
}

function padToWidth(text: string, width: number): string {
	const truncated = truncateToWidth(text, width, "");
	const padding = " ".repeat(Math.max(0, width - visibleWidth(truncated)));
	return `${truncated}${padding}`;
}

function formatDate(date: Date | null | undefined): string {
	if (!date) return "unknown";
	return date.toISOString().slice(0, 16).replace("T", " ");
}
