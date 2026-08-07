import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createSubagentLibrary } from "../src/subagents/search.ts";
import { createSubagentsOrchestrator } from "../src/subagents/subagents-orchestrator.ts";

export default function subAgentsExtension(pi: ExtensionAPI) {
	const baseDir = dirname(fileURLToPath(import.meta.url));
	const subagents = createSubagentLibrary({
		promptTemplatePath: join(baseDir, "..", "prompts", "subagent-codebase-search.md"),
		exec: pi.exec,
	});
	const subAgentsOrchestrator = createSubagentsOrchestrator({ pi });

	// pi.registerTool({
	// 	name: "subagent_search",
	// 	label: "Subagent Search",
	// 	description:
	// 		"Delegate read-only codebase analysis or search to an isolated Pi subagent and return its findings.",
	// 	promptSnippet: "Research the codebase in a separate read-only agent context",
	// 	promptGuidelines: [
	// 		"Use subagent_search for codebase discovery or analysis that benefits from an isolated context window; do not use it to modify code.",
	// 	],
	// 	parameters: Type.Object({
	// 		task: Type.String({
	// 			description: "Focused codebase research task for the subagent",
	// 			minLength: 1,
	// 		}),
	// 	}),
	// 	async execute(_toolCallId, params, signal, _onUpdate, ctx) {
	// 		return subagents.searchCodebase({ task: params.task, cwd: ctx.cwd, signal });
	// 	},
	// });

	pi.registerTool({
		name: "list_available_subagents",
		label: "List Available Subagents",
		description: "List specialized subagents with their purpose and prompt path.",
		promptSnippet: "Discover specialized subagents available for delegated tasks",
		promptGuidelines: [
			"Before researching, exploring, investigating, reviewing, or explaining a codebase directly, call list_available_subagents to find a matching specialized subagent.",
			"Use list_available_subagents when a delegated task could benefit from an isolated context window or specialized instructions.",
		],
		parameters: Type.Object({}),
		async execute() {
			return subAgentsOrchestrator.list();
		},
	});

	pi.registerTool({
		name: "subagent_execute",
		label: "Subagent Execute",
		description:
			"Run a discovered specialized subagent in an isolated Pi process with full coding tools. The subagent can edit files and execute shell commands.",
		promptSnippet: "Delegate a task to a specialized isolated subagent",
		promptGuidelines: [
			"After list_available_subagents finds a subagent whose description matches the task, call subagent_execute with its exact prompt path and a focused task.",
			"For codebase search, exploration, or implementation-understanding requests, use the matching codebase-research subagent through subagent_execute before investigating in the parent context.",
		],
		parameters: Type.Object({
			promptPath: Type.String({
				description: "Exact prompt path returned by list_available_subagents",
				minLength: 1,
			}),
			task: Type.String({
				description: "Task to delegate to the subagent",
				minLength: 1,
			}),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			return subAgentsOrchestrator.run({
				promptPath: params.promptPath,
				task: params.task,
				cwd: ctx.cwd,
				signal,
			});
		},
	});
}
