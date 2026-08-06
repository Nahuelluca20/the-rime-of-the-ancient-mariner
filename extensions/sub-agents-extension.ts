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

	pi.registerTool({
		name: "subagent_search",
		label: "Subagent Search",
		description:
			"Delegate read-only codebase analysis or search to an isolated Pi subagent and return its findings.",
		promptSnippet: "Research the codebase in a separate read-only agent context",
		promptGuidelines: [
			"Use subagent_search for codebase discovery or analysis that benefits from an isolated context window; do not use it to modify code.",
		],
		parameters: Type.Object({
			task: Type.String({
				description: "Focused codebase research task for the subagent",
				minLength: 1,
			}),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			return subagents.searchCodebase({ task: params.task, cwd: ctx.cwd, signal });
		},
	});

	pi.registerTool({
		name: "list_available_subagents",
		label: "List Available Subagents",
		description: "List the available subagent in the repo/project/global for use it.",
		parameters: {},
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			return subAgentsOrchestrator.list();
		},
	});

	// pi.registerTool({
	// 	name: "subagent_execute",
	// 	label: "Subagent Execute",
	// 	parameters: Type.Object({
	// 		subAgentInstruction: Type.String({
	// 			description: "The task/instruction/info for the subagent prompt",
	// 			minLength: 10,
	// 		}),
	//
	// 	}),
	// 	async execute(_toolCallId, params, signal, onUpdate, ctx) {
	// 		return null;
	// 	},
	// });
}
