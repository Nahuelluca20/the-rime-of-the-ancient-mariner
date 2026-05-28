const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export interface PlanPromptInput {
	task: string;
	planInfo: string;
}

export function stripFrontmatter(markdown: string): string {
	return markdown.replace(FRONTMATTER_PATTERN, "").trimStart();
}

export function renderPlanPrompt(template: string, input: PlanPromptInput): string {
	return stripFrontmatter(template)
		.replaceAll("${planInfo}", input.planInfo)
		.replaceAll("$@", input.task.trim());
}

export function buildPlanInfo(readOnlyTools: string[]): string {
	return [
		"Native pi plan mode is active for this turn.",
		"No plan file is writable while this mode is active: write the plan in the chat instead.",
		"The plan-file exception in this template is disabled by native enforcement.",
		`Available read-only tools: ${readOnlyTools.join(", ")}. Every other tool is blocked.`,
		"Native enforcement: all filesystem writes, code edits, config changes, commits, installs, and other non-read-only actions are blocked until the user approves leaving plan mode.",
		"When the plan is complete, call the plan_exit tool to ask the user for approval to leave plan mode.",
	].join("\n");
}
