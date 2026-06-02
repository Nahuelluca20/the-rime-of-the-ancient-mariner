import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import type { RecentMemory } from "../memory/store.ts";

interface SimpleTheme {
	fg(category: string, text: string): string;
	bg(category: string, text: string): string;
	bold(text: string): string;
}

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
	theme: SimpleTheme;
}

/**
 * Overlay dialog for selecting recent memories.
 *
 * Shows memories newest-first, five per page by default. The dialog owns cursor,
 * page, and checked state so callers only provide page loading and receive the
 * final selected memory refs.
 */
export class MemoriesTableDialog {
	private title?: string;
	private rows: RecentMemory[];
	private totalRows: number;
	private pageSize: number;
	private loadPage: (pageIndex: number) => RecentMemory[];
	private onSubmit: (selected: SelectedMemoryRef[]) => void;
	private onCancel: () => void;
	private theme: SimpleTheme;

	private pageIndex = 0;
	private focusedIndex = 0;
	private selectedKeys = new Set<string>();

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
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape)) {
			this.onCancel();
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

		if (matchesKey(data, Key.up)) {
			this.focusedIndex = Math.max(0, this.focusedIndex - 1);
			this.invalidate();
			return;
		}

		if (matchesKey(data, Key.down)) {
			this.focusedIndex = Math.min(this.rows.length - 1, this.focusedIndex + 1);
			this.invalidate();
			return;
		}

		if (matchesKey(data, Key.space) || data === " ") {
			const current = this.rows[this.focusedIndex];
			if (current) this.toggleSelected(current);
			return;
		}

		this.handlePageInput(data);
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const borderFg = (s: string) => this.theme.fg("accent", s);
		const muted = (s: string) => this.theme.fg("dim", s);
		const success = (s: string) => this.theme.fg("success", s);
		const warning = (s: string) => this.theme.fg("warning", s);

		const cw = Math.max(0, width - 2);
		const padX = cw >= 2 ? 1 : 0;
		const gutter = " ".repeat(padX);
		const innerW = Math.max(0, cw - padX * 2);

		const decorateFocused = (line: string) => this.theme.bg("selectedBg", line);
		const contentLine = (inner: string, decorate?: (line: string) => string) => {
			const padded = padToWidth(inner, innerW);
			const styled = decorate ? decorate(padded) : padded;
			return `${borderFg("│")}${gutter}${styled}${gutter}${borderFg("│")}`;
		};
		const blankLine = () => contentLine("");

		const lines: string[] = [];

		if (this.title) {
			const label = truncateToWidth(` ${this.title} `, cw, "");
			const dashes = "─".repeat(Math.max(0, cw - visibleLen(label)));
			lines.push(borderFg(`╭${label}${dashes}╮`));
		} else {
			lines.push(borderFg(`╭${"─".repeat(cw)}╮`));
		}

		const pageLabel = `Page ${this.pageIndex + 1}/${this.pageCount()}`;
		const countLabel = `${this.selectedKeys.size} selected`;
		lines.push(
			contentLine(`${this.theme.bold("Recent memories")} ${muted(pageLabel)} ${muted(countLabel)}`),
		);
		lines.push(contentLine(muted("─".repeat(innerW))));

		if (this.totalRows === 0) {
			lines.push(contentLine(warning("No memories found.")));
		} else {
			for (let index = 0; index < this.rows.length; index++) {
				const row = this.rows[index];
				if (!row) continue;
				const focused = index === this.focusedIndex;
				const checked = this.selectedKeys.has(memoryKey(row));
				const cursor = focused ? ">" : " ";
				const checkbox = checked ? success("[x]") : muted("[ ]");
				const updated = formatDate(row.updatedAt);
				const prefix = `${cursor} ${checkbox} `;
				const datePart = muted(updated);
				const mainWidth = Math.max(8, innerW - visibleLen(prefix) - updated.length - 1);
				const name = `${row.projectName} / ${row.name}`;
				const main = focused ? this.theme.fg("accent", this.theme.bold(name)) : name;
				const titleLine = `${prefix}${padToWidth(main, mainWidth)} ${datePart}`;
				const description = row.description || "(no description)";
				const descriptionLine = muted(`    ${description}`);

				lines.push(contentLine(titleLine, focused ? decorateFocused : undefined));
				lines.push(contentLine(descriptionLine, focused ? decorateFocused : undefined));
			}
		}

		lines.push(blankLine());
		lines.push(
			contentLine(muted("↑↓ navigate • space select • ←/→ pages • enter insert • esc cancel")),
		);
		lines.push(borderFg(`╰${"─".repeat(cw)}╯`));

		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	private handlePageInput(data: string): void {
		if (matchesKey(data, Key.left)) {
			this.goToPage(Math.max(0, this.pageIndex - 1));
		} else if (matchesKey(data, Key.right)) {
			this.goToPage(Math.min(this.pageCount() - 1, this.pageIndex + 1));
		}
	}

	private goToPage(nextPageIndex: number): void {
		if (nextPageIndex === this.pageIndex) return;
		this.pageIndex = nextPageIndex;
		this.rows = this.loadPage(nextPageIndex);
		this.focusedIndex = Math.min(this.focusedIndex, Math.max(0, this.rows.length - 1));
		this.invalidate();
	}

	private toggleSelected(memory: RecentMemory): void {
		const key = memoryKey(memory);
		if (this.selectedKeys.has(key)) {
			this.selectedKeys.delete(key);
		} else {
			this.selectedKeys.add(key);
		}
		this.invalidate();
	}

	private getSelectedRefs(): SelectedMemoryRef[] {
		return [...this.selectedKeys].map((key) => {
			const [projectName = "", memoryName = ""] = key.split("\0");
			return { projectName, memoryName };
		});
	}

	private pageCount(): number {
		return Math.max(1, Math.ceil(this.totalRows / this.pageSize));
	}
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI SGR escapes to measure visible width
const ANSI_SGR = /\x1b\[[0-9;]*m/g;

function memoryKey(memory: Pick<RecentMemory, "projectName" | "name">): string {
	return `${memory.projectName}\0${memory.name}`;
}

function visibleLen(str: string): number {
	return str.replace(ANSI_SGR, "").length;
}

function padToWidth(text: string, width: number): string {
	const truncated = truncateToWidth(text, width);
	const padding = " ".repeat(Math.max(0, width - visibleLen(truncated)));
	return `${truncated}${padding}`;
}

function formatDate(date: Date | null | undefined): string {
	if (!date) return "unknown";
	return date.toISOString().slice(0, 16).replace("T", " ");
}
