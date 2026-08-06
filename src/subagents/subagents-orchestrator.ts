import type {
	AgentToolResult,
	ExtensionAPI,
	SlashCommandInfo,
} from "@earendil-works/pi-coding-agent";

interface SubagentsOrchestratorOptions {
	pi: ExtensionAPI;
}

interface SubagentsOrchestrator {
	list(): Promise<AgentToolResult<SubagentTemplate[]>>;
}

type SubagentTemplate = {
	name: string;
	path: string;
	description?: string;
	baseDir?: string;
};

export function createSubagentsOrchestrator({
	pi,
}: SubagentsOrchestratorOptions): SubagentsOrchestrator {
	function subAgentsPromptsTemplates(): SlashCommandInfo[] {
		const promptSlashCommands = pi
			.getCommands()
			.filter((command) => command.source === "prompt" && command.name.startsWith("subagent-"));
		return promptSlashCommands;
	}

	// async function runSubAgent() {
	// 	return;
	// }
	return {
		async list(): Promise<AgentToolResult<SubagentTemplate[]>> {
			const templates: SubagentTemplate[] = subAgentsPromptsTemplates().map((template) => ({
				name: template.name,
				description: template.description,
				path: template.sourceInfo.path,
				baseDir: template.sourceInfo.baseDir,
			}));

			return {
				content: [
					{
						type: "text",
						text: templates.length
							? templates
									.map(
										(template) =>
											`name: ${template.name}\ndescription: ${template.description ?? ""}\npath: ${template.path}\nbaseDir: ${template.baseDir ?? ""}`,
									)
									.join("\n\n")
							: "No subagent prompt templates are available.",
					},
				],
				details: templates,
			};
		},
	};
}
