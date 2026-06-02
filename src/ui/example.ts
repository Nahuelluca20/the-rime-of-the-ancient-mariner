import { Key, matchesKey, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

// ── Types ────────────────────────────────────────────────────

/** Minimal theme interface — the actual object has fg(), bg(), bold(), etc. */
interface SimpleTheme {
	fg(category: string, text: string): string;
	bg(category: string, text: string): string;
	bold(text: string): string;
}

export interface SimpleDialogOptions {
	/** Title shown in the top border. */
	title?: string;
	/** Body text. Can contain newlines. */
	text: string;
	/** Minimum inner height (lines of content, excluding borders and hint). Default 0. */
	minHeight?: number;
	/** Called when the dialog is dismissed. */
	onClose: () => void;
	/** Theme object from pi's callback. */
	theme: SimpleTheme;
}

// ── Component ────────────────────────────────────────────────

/**
 * Minimal overlay dialog that displays text and closes on Enter / Escape.
 *
 * @example
 * ```ts
 * import { SimpleDialog } from "../src/ui/example.ts";
 *
 * const dialog = new SimpleDialog({
 *   title: "Info",
 *   text: "Operation completed successfully.",
 *   onClose: () => done(),
 *   theme,
 * });
 * ```
 */
export class SimpleDialog {
	private title?: string;
	private text: string;
	private minHeight: number;
	private onClose: () => void;
	private theme: SimpleTheme;

	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(opts: SimpleDialogOptions) {
		this.title = opts.title;
		this.text = opts.text;
		this.minHeight = opts.minHeight ?? 0;
		this.onClose = opts.onClose;
		this.theme = opts.theme;
	}

	// ── Keyboard ───────────────────────────────────────────

	handleInput(data: string): void {
		if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
			this.onClose();
		}
	}

	// ── Render ─────────────────────────────────────────────

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const borderFg = (s: string) => this.theme.fg("accent", s);
		const muted = (s: string) => this.theme.fg("dim", s);

		// Inner content area (excluding border chars)
		const cw = Math.max(10, width - 2);

		const lines: string[] = [];

		// ── Top border ──
		if (this.title) {
			const padded = ` ${this.title} `;
			const dashes = "─".repeat(Math.max(0, cw - padded.length));
			lines.push(borderFg(`╭${padded}${dashes}╮`));
		} else {
			lines.push(borderFg(`╭${"─".repeat(cw)}╮`));
		}

		// ── Body ──
		for (const rawLine of this.text.split("\n")) {
			for (const w of wrapTextWithAnsi(rawLine, cw)) {
				const padding = " ".repeat(Math.max(0, cw - visibleLen(w)));
				lines.push(`${borderFg("│")}${w}${padding}${borderFg("│")}`);
			}
		}

		// ── Pad to minHeight ──
		while (lines.length < this.minHeight) {
			lines.push(`${borderFg("│")}${" ".repeat(cw)}${borderFg("│")}`);
		}

		// ── Footer hint ──
		const hint = muted("Enter / Esc to close");
		lines.push(
			`${borderFg("│")}${hint}${" ".repeat(Math.max(0, cw - visibleLen(hint)))}${borderFg("│")}`,
		);

		// ── Bottom border ──
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

// ── Helpers ──────────────────────────────────────────────────

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI SGR escapes to measure visible width
const ANSI_SGR = /\x1b\[[0-9;]*m/g;

function visibleLen(str: string): number {
	return str.replace(ANSI_SGR, "").length;
}
