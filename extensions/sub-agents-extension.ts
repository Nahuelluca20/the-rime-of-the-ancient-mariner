import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createSubagentsOrchestrator } from "../src/subagents/subagents-orchestrator.ts";

export default function subAgentsExtension(pi: ExtensionAPI) {
	const subAgentsOrchestrator = createSubagentsOrchestrator({ pi });

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
				ui: ctx.ui,
			});
		},
	});
}
