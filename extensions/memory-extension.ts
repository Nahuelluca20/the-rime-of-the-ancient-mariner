import { readFile } from "node:fs/promises";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	type MemoryInfoForRetrieval,
	formatMemoriesForContext,
	resolveMemoryForContext,
} from "../src/memory/context.ts";
import {
	type MemoryTarget,
	type MergeDecision,
	createSaveCoordinator,
} from "../src/memory/merge.ts";
import { updateSession } from "../src/memory/session-commands.ts";
import { SESSION_TYPES, saveSessionSummary } from "../src/memory/session-summary.ts";
import { type AgentMemory, openMemoryStore } from "../src/memory/store.ts";
import { SimpleDialog } from "../src/ui/example.ts";
import { MemoriesTableDialog, type SelectedMemoryRef } from "../src/ui/memories-table.ts";
import { SelectDialog } from "../src/ui/select-dialog.ts";

const store = openMemoryStore();
const context = resolveMemoryForContext({ store: store });
const coordinator = createSaveCoordinator();

export default function (pi: ExtensionAPI) {
	function sendMemoriesToModel(
		memoryInfo: MemoryInfoForRetrieval[],
		options: { triggerTurn?: boolean } = {},
	): number {
		const memories = context.getMemories(memoryInfo);
		const text = formatMemoriesForContext(memories);

		if (text) {
			pi.sendMessage(
				{ customType: "memories", content: text, display: true },
				{ deliverAs: "steer", triggerTurn: options.triggerTurn },
			);
		}

		return memories.length;
	}

	async function promptMergeDecision(
		ctx: ExtensionContext,
		target: MemoryTarget,
		_existing: AgentMemory,
	): Promise<MergeDecision> {
		// Headless: never overwrite an existing memory silently.
		if (!ctx.hasUI) return "cancel";

		const decision = await ctx.ui.custom<MergeDecision | null>(
			(tui, theme, _kb, done) => {
				const dialog = new SelectDialog<MergeDecision>({
					title: "Memory already exists",
					message: `"${target.name}" already exists in project "${target.projectName}".\nWhat should happen with the new summary?`,
					options: [
						{
							label: "Mix",
							description: "Have the model merge old + new into one summary",
							value: "mix",
						},
						{
							label: "Replace",
							description: "Overwrite the existing memory entirely",
							value: "replace",
						},
						{
							label: "Cancel",
							description: "Keep the existing memory; save nothing",
							value: "cancel",
						},
					],
					onSubmit: done,
					onCancel: () => done(null),
					theme,
				});
				return {
					render: (width: number) => dialog.render(width),
					invalidate: () => dialog.invalidate(),
					handleInput: (data: string) => {
						dialog.handleInput(data);
						tui.requestRender();
					},
				};
			},
			{ overlay: true, overlayOptions: { minWidth: 60, margin: 4 } },
		);

		return decision ?? "cancel";
	}

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
			projectName: Type.String({ description: "Project name" }),
			memoryName: Type.String({ description: "Memory name" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const memory = store.getMemory(params.projectName, params.memoryName);
			if (!memory) {
				return {
					content: [
						{
							type: "text",
							text: `Memory "${params.memoryName}" not found in project "${params.projectName}".`,
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
			projectName: Type.String({ description: "Project name" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const memories = store.listMemories(params.projectName);
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
								: `No memories found for project "${params.projectName}".`,
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
			"Persist a session summary, including optional session type and tags, into the current session's memory row. " +
			"If the target memory already exists the user will be asked to mix, replace, or cancel. " +
			"If the result asks you to merge, compose a single merged summary and call this tool exactly once more.",
		parameters: Type.Object({
			title: Type.String(),
			description: Type.String(),
			context: Type.String(),
			sessionType: Type.Optional(
				Type.Union(SESSION_TYPES.map((sessionType) => Type.Literal(sessionType))),
			),
			tags: Type.Optional(Type.Array(Type.String())),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const outcome = await saveSessionSummary(
				ctx,
				store,
				coordinator,
				params,
				(target, existing) => promptMergeDecision(ctx, target, existing),
			);
			return {
				content: [{ type: "text", text: outcome.message }],
				details: { status: outcome.status, severity: outcome.severity, ...params },
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
		parameters: Type.Object({
			memories: Type.Array(
				Type.Object({
					projectName: Type.String({ description: "Project name" }),
					memoryName: Type.String({ description: "Memory name" }),
				}),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const memoryLoads = sendMemoriesToModel(params.memories);

			return {
				content: [{ type: "text", text: "Done" }],
				details: { memoryLoads },
			};
		},
	});

	pi.registerCommand("recent-memories", {
		description: "Pick recent memories and insert them into the LLM context",
		handler: async (_args, ctx) => {
			const pageSize = 5;
			const loadPage = (pageIndex: number) =>
				store.listRecentMemories(pageSize, pageIndex * pageSize);
			const totalRows = store.countMemories();
			const rows = loadPage(0);

			const selected = await ctx.ui.custom<MemoryInfoForRetrieval[] | null>(
				(tui, theme, _kb, done) => {
					const dialog = new MemoriesTableDialog({
						title: "Recent Memories",
						rows,
						totalRows,
						pageSize,
						loadPage,
						onSubmit: done,
						onCancel: () => done(null),
						theme,
					});
					return {
						render: (width: number) => dialog.render(width),
						invalidate: () => dialog.invalidate(),
						handleInput: (data: string) => {
							dialog.handleInput(data);
							tui.requestRender();
						},
					};
				},
				{
					overlay: true,
					overlayOptions: { width: "90%", minWidth: 80, maxHeight: "90%", margin: 2 },
				},
			);

			if (!selected) return;
			if (selected.length === 0) {
				ctx.ui.notify("No memories selected.", "info");
				return;
			}

			const memoryLoads = sendMemoriesToModel(selected, { triggerTurn: true });
			ctx.ui.notify(`Inserted ${memoryLoads} memor${memoryLoads === 1 ? "y" : "ies"}.`, "info");
		},
	});

	pi.registerCommand("target-memory", {
		description: "Point memory saves at an existing memory (use `clear` to reset)",
		handler: async (args, ctx) => {
			if (args.trim() === "clear") {
				coordinator.setTarget(null);
				ctx.ui.notify("Memory save target cleared; saves use the session name again.", "info");
				pi.sendMessage(
					{
						customType: "memory-target",
						content:
							"The memory save target was cleared. Future save_session_summary calls write to the session-named memory again.",
						display: true,
					},
					{ deliverAs: "steer", triggerTurn: false },
				);
				return;
			}

			const pageSize = 5;
			const loadPage = (pageIndex: number) =>
				store.listRecentMemories(pageSize, pageIndex * pageSize);
			const totalRows = store.countMemories();
			const rows = loadPage(0);

			const selected = await ctx.ui.custom<SelectedMemoryRef | null>(
				(tui, theme, _kb, done) => {
					const dialog = new MemoriesTableDialog({
						title: "Target Memory",
						rows,
						totalRows,
						pageSize,
						loadPage,
						selectionMode: "single",
						onSubmit: (refs) => done(refs[0] ?? null),
						onCancel: () => done(null),
						theme,
					});
					return {
						render: (width: number) => dialog.render(width),
						invalidate: () => dialog.invalidate(),
						handleInput: (data: string) => {
							dialog.handleInput(data);
							tui.requestRender();
						},
					};
				},
				{
					overlay: true,
					overlayOptions: { width: "90%", minWidth: 80, maxHeight: "90%", margin: 2 },
				},
			);

			if (!selected) {
				ctx.ui.notify("Target unchanged.", "info");
				return;
			}

			coordinator.setTarget({ projectName: selected.projectName, name: selected.memoryName });
			ctx.ui.notify(
				`Memory saves now target "${selected.projectName} / ${selected.memoryName}".`,
				"info",
			);
			sendMemoriesToModel([selected]);
			pi.sendMessage(
				{
					customType: "memory-target",
					content: `Future save_session_summary calls will write to memory "${selected.memoryName}" in project "${selected.projectName}". It already exists, so the user will choose mix/replace/cancel at save time.`,
					display: true,
				},
				{ deliverAs: "steer", triggerTurn: false },
			);
		},
	});

	// A mix approval is only meant for the model's follow-up call within the
	// same turn; drop it if the turn ends without that call.
	pi.on("agent_end", async () => {
		coordinator.clearPendingMerge();
	});

	pi.registerCommand("pick", {
		description: "Show text in an overlay dialog",
		handler: async (args, ctx) => {
			const text = args || "No text provided. Usage: /pick <message>";

			await ctx.ui.custom<void>(
				(_tui, theme, _kb, done) => {
					const dialog = new SimpleDialog({
						title: "ancient-mariner",
						text,
						minHeight: 6,
						onClose: () => done(),
						theme,
					});
					return dialog;
				},
				{ overlay: true, overlayOptions: { margin: 20 } },
			);
		},
	});
}
