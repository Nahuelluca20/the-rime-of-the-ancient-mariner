import { readFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { resolveMemoryForContext } from "../src/memory/context.ts";
import { saveSession, updateSession } from "../src/memory/session-commands.ts";
import { saveSessionSummary } from "../src/memory/session-summary.ts";
import { openMemoryStore } from "../src/memory/store.ts";

const store = openMemoryStore();
const context = resolveMemoryForContext({ store: store });

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "count_lines",
		label: "Count Lines",
		description: "Count lines in a file using plain TypeScript",
		parameters: Type.Object({
			path: Type.String({ description: "File path" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const content = await readFile(params.path, "utf8");
			const lines = content.split("\n").length;

			return {
				content: [{ type: "text", text: `${lines} lines in ${params.path}` }],
				details: { lines, path: params.path },
			};
		},
	});

	pi.registerTool({
		name: "get_memory",
		label: "Get Memory",
		description: "Retrieve a specific memory by name from the ancient-mariner store",
		parameters: Type.Object({
			project: Type.String({ description: "Project name" }),
			name: Type.String({ description: "Memory name" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const memory = store.getMemory(params.project, params.name);
			if (!memory) {
				return {
					content: [
						{
							type: "text",
							text: `Memory "${params.name}" not found in project "${params.project}".`,
						},
					],
					details: null,
				};
			}
			return {
				content: [{ type: "text", text: JSON.stringify(memory.data, null, 2) }],
				details: memory,
			};
		},
	});

	pi.registerTool({
		name: "list_memories",
		label: "List Memories",
		description: "List all stored memories for a given project",
		parameters: Type.Object({
			project: Type.String({ description: "Project name" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const memories = store.listMemories(params.project);
			const names = memories.map(
				(m) => `- ${m.name} (updated: ${m.updatedAt?.toISOString() ?? "unknown"})`,
			);
			return {
				content: [
					{
						type: "text",
						text:
							names.length > 0
								? names.join("\n")
								: `No memories found for project "${params.project}".`,
					},
				],
				details: memories,
			};
		},
	});

	pi.registerTool({
		name: "save_session_summary",
		label: "Save Session Summary",
		description:
			"Persist a {title, description, context} summary into the current session's memory row.",
		parameters: Type.Object({
			title: Type.String(),
			description: Type.String(),
			context: Type.String(),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { message, severity } = saveSessionSummary(ctx, store, params);
			return {
				content: [{ type: "text", text: message }],
				details: { severity, ...params },
			};
		},
	});

	pi.registerCommand("update-info", {
		description: "Update the current session's stored memory in place",
		handler: async (_args, ctx) => {
			const { message, severity } = updateSession(ctx, store);
			ctx.ui.notify(message, severity);
		},
	});

	pi.registerTool({
		name: "insert_memories",
		label: "Insert Memories into the context of the session",
		description: "Insert Memories into the context",
		parameters: Type.Array(
			Type.Object({
				projectName: Type.String(),
				memoryName: Type.String(),
			}),
		),
		async execute(_toolCallId, parameters, _signal, _onUpdate, _ctx) {
			const memories = context.getMemories(parameters);

			for (const memory of memories) {
				pi.sendMessage(
					{
						customType: `${memory.name}`,
						content: JSON.stringify(memory.data, null, 2),
						display: true,
					},
					{
						deliverAs: "steer",
					},
				);
			}

			return {
				content: [{ type: "text", text: "Done" }],
				details: { memoryLoads: parameters.length },
			};
		},
	});
}
