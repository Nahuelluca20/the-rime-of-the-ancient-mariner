import {
	Key,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

interface SimpleTheme {
	fg(category: string, text: string): string;
	bg(category: string, text: string): string;
	bold(text: string): string;
}

export interface SelectOption<T> {
	label: string;
	description?: string;
	value: T;
}

export interface SelectDialogOptions<T> {
	/** Title shown in the top border. */
	title?: string;
	/** Body text shown above the options. Can contain newlines. */
	message: string;
	options: SelectOption<T>[];
	onSubmit: (value: T) => void;
	/** Called on Escape. */
	onCancel: () => void;
	theme: SimpleTheme;
}

/**
 * Overlay dialog that asks the user to pick exactly one option.
 * Arrow keys / j / k move focus, Enter submits, Escape cancels.
 */
export class SelectDialog<T> {
	private title?: string;
	private message: string;
	private options: SelectOption<T>[];
	private onSubmit: (value: T) => void;
	private onCancel: () => void;
	private theme: SimpleTheme;

	private focusedIndex = 0;

	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(opts: SelectDialogOptions<T>) {
		this.title = opts.title;
		this.message = opts.message;
		this.options = opts.options;
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
			const focused = this.options[this.focusedIndex];
			if (focused) this.onSubmit(focused.value);
			return;
		}

		if (matchesKey(data, Key.up) || data === "k") {
			this.focusedIndex = Math.max(0, this.focusedIndex - 1);
			this.invalidate();
			return;
		}

		if (matchesKey(data, Key.down) || data === "j") {
			this.focusedIndex = Math.min(this.options.length - 1, this.focusedIndex + 1);
			this.invalidate();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const borderFg = (s: string) => this.theme.fg("accent", s);
		const muted = (s: string) => this.theme.fg("dim", s);

		const cw = Math.max(10, width - 2);
		const padX = cw >= 2 ? 1 : 0;
		const gutter = " ".repeat(padX);
		const innerW = Math.max(0, cw - padX * 2);

		const decorateFocused = (line: string) => this.theme.bg("selectedBg", line);
		const contentLine = (inner: string, decorate?: (line: string) => string) => {
			const padded = padToWidth(inner, innerW);
			const styled = decorate ? decorate(padded) : padded;
			return `${borderFg("│")}${gutter}${styled}${gutter}${borderFg("│")}`;
		};

		const lines: string[] = [];

		if (this.title) {
			const label = truncateToWidth(` ${this.title} `, cw, "");
			const dashes = "─".repeat(Math.max(0, cw - visibleWidth(label)));
			lines.push(borderFg(`╭${label}${dashes}╮`));
		} else {
			lines.push(borderFg(`╭${"─".repeat(cw)}╮`));
		}

		for (const rawLine of this.message.split("\n")) {
			for (const wrapped of wrapTextWithAnsi(rawLine, innerW)) {
				lines.push(contentLine(wrapped));
			}
		}
		lines.push(contentLine(""));

		for (let index = 0; index < this.options.length; index++) {
			const option = this.options[index];
			if (!option) continue;
			const focused = index === this.focusedIndex;
			const cursor = focused ? ">" : " ";
			const label = focused ? this.theme.fg("accent", this.theme.bold(option.label)) : option.label;
			const description = option.description ? ` ${muted(`— ${option.description}`)}` : "";
			lines.push(
				contentLine(`${cursor} ${label}${description}`, focused ? decorateFocused : undefined),
			);
		}

		lines.push(contentLine(""));
		lines.push(contentLine(muted("↑↓/jk navigate • enter select • esc cancel")));
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

function padToWidth(text: string, width: number): string {
	const truncated = truncateToWidth(text, width);
	const padding = " ".repeat(Math.max(0, width - visibleWidth(truncated)));
	return `${truncated}${padding}`;
}
