const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export interface PlanPromptInput {
	planInfo: string;
}

export function stripFrontmatter(markdown: string): string {
	return markdown.replace(FRONTMATTER_PATTERN, "").trimStart();
}

export function renderPlanPrompt(template: string, input: PlanPromptInput): string {
	return stripFrontmatter(template).replaceAll("${planInfo}", input.planInfo);
}

export function buildPlanInfo(): string {
	return [
		"Native pi plan mode is active for this turn.",
		"Native enforcement blocks all writes and other non-read-only actions until the user approves leaving plan mode.",
		"When the final plan is complete, call the plan_exit tool to ask the user for approval to leave plan mode.",
	].join("\n");
}
