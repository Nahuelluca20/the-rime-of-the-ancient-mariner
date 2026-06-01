import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import type { RecentMemory } from "../memory/store.ts";

interface SimpleTheme {
	fg(category: string, text: string): string;
	bg(category: string, text: string): string;
	bold(text: string): string;
}

export interface MemoriesTableDialogOptions {
	title?: string;
	rows: RecentMemory[];
	onClose: () => void;
	theme: SimpleTheme;
}

/**
 * Overlay dialog that renders recent memories as a three-column table
 * (project name │ memory name │ updated date) and closes on Enter / Escape.
 */
export class MemoriesTableDialog {
	private title?: string;
	private rows: RecentMemory[];
	private onClose: () => void;
	private theme: SimpleTheme;

	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(opts: MemoriesTableDialogOptions) {
		this.title = opts.title;
		this.rows = opts.rows;
		this.onClose = opts.onClose;
		this.theme = opts.theme;
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
			this.onClose();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const borderFg = (s: string) => this.theme.fg("accent", s);
		const muted = (s: string) => this.theme.fg("dim", s);

		const cw = Math.max(30, width - 2);
		const padX = 1;
		const gutter = " ".repeat(padX);
		const innerW = Math.max(10, cw - padX * 2);

		const contentLine = (inner: string) => {
			const fill = " ".repeat(Math.max(0, innerW - visibleLen(inner)));
			return `${borderFg("│")}${gutter}${inner}${fill}${gutter}${borderFg("│")}`;
		};
		const blankLine = () => contentLine("");

		const dateW = 16; // "YYYY-MM-DD HH:mm"
		const sep = " │ ";
		const sepW = sep.length;
		const remaining = Math.max(2, innerW - dateW - sepW * 2);
		const projectW = Math.max(1, Math.floor(remaining / 2));
		const nameW = Math.max(1, remaining - projectW);

		const row = (project: string, name: string, date: string, decorate?: (s: string) => string) => {
			const style = decorate ?? ((s: string) => s);
			const cells = [
				style(padCell(project, projectW)),
				style(padCell(name, nameW)),
				style(padCell(date, dateW)),
			].join(muted(sep));
			return contentLine(cells);
		};

		const lines: string[] = [];

		if (this.title) {
			const padded = ` ${this.title} `;
			const dashes = "─".repeat(Math.max(0, cw - padded.length));
			lines.push(borderFg(`╭${padded}${dashes}╮`));
		} else {
			lines.push(borderFg(`╭${"─".repeat(cw)}╮`));
		}

		lines.push(blankLine());
		lines.push(row("project name", "memory name", "updated date", (s) => this.theme.bold(s)));
		lines.push(contentLine(muted("─".repeat(innerW))));

		if (this.rows.length === 0) {
			lines.push(contentLine(muted("No memories found.")));
		} else {
			for (const r of this.rows) {
				lines.push(row(r.projectName, r.name, formatDate(r.updatedAt)));
			}
		}

		lines.push(blankLine());
		lines.push(contentLine(muted("Enter / Esc to close")));
		lines.push(borderFg(`╰${"─".repeat(cw)}╯`));

		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI SGR escapes to measure visible width
const ANSI_SGR = /\x1b\[[0-9;]*m/g;

function visibleLen(str: string): number {
	return str.replace(ANSI_SGR, "").length;
}

function padCell(text: string, width: number): string {
	const truncated = truncateToWidth(text, width);
	const padding = " ".repeat(Math.max(0, width - visibleLen(truncated)));
	return `${truncated}${padding}`;
}

function formatDate(date: Date | null | undefined): string {
	if (!date) return "unknown";
	return date.toISOString().slice(0, 16).replace("T", " ");
}
