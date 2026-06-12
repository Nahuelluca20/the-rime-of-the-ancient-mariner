import { CustomEditor, type ExtensionContext } from "@earendil-works/pi-coding-agent";

export type PlanModeEditorFactory = NonNullable<
	ReturnType<ExtensionContext["ui"]["getEditorComponent"]>
>;

const RESET = "\x1b[0m";
const PLAN_MODE_GOLD = [214, 162, 58] as const;

export const PLAN_MODE_LABEL = "Making a good plan";

type Rgb = readonly [number, number, number];

function fgCode([red, green, blue]: Rgb): string {
	return `\x1b[38;2;${red};${green};${blue}m`;
}

function planModeGold(text: string): string {
	return `${fgCode(PLAN_MODE_GOLD)}${text}${RESET}`;
}

export function planModeBorder(text: string): string {
	return planModeGold(text);
}

export function planModeTitle(text: string): string {
	return planModeGold(` ${text} `);
}

export function planModeMuted(text: string): string {
	return planModeGold(text);
}

function truncatePlainText(text: string, width: number): string {
	return [...text].slice(0, Math.max(0, width)).join("");
}

function renderPlanModeTopBorder(width: number): string {
	if (width <= 0) return "";

	const label = truncatePlainText(` ${PLAN_MODE_LABEL} `, width);
	const fillWidth = Math.max(0, width - label.length);

	return `${planModeBorder(label)}${planModeBorder("─".repeat(fillWidth))}`;
}

class PlanModeEditor extends CustomEditor {
	render(width: number): string[] {
		this.borderColor = planModeBorder;
		const lines = super.render(width);
		if (lines.length === 0) return lines;

		lines[0] = renderPlanModeTopBorder(width);
		return lines;
	}
}

export function createPlanModeEditorFactory(): PlanModeEditorFactory {
	return (tui, theme, keybindings) => new PlanModeEditor(tui, theme, keybindings);
}
