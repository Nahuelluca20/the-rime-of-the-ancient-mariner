import { basename } from "node:path";
import type {
	AgentToolResult,
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { getSessionInfo } from "../session/info.ts";
import { type SessionSummary, createSessionMemory } from "../session/memory.ts";
import { MemoryBrowserDialog } from "../ui/memory-browser.ts";
import { createMemoryCatalog } from "./catalog.ts";
import {
	type MemoryInfoForRetrieval,
	formatMemoriesForContext,
	resolveMemoryForContext,
} from "./context.ts";
import type { MemoryRepository } from "./repository.ts";
import type { AgentMemory } from "./types.ts";

export interface GetMemoryParams {
	projectName: string;
	memoryName: string;
}

export interface ListProjectMemoriesParams {
	projectName: string;
}

export interface InsertMemoriesParams {
	memories: MemoryInfoForRetrieval[];
}

export interface MemoryInsertionOptions {
	triggerTurn?: boolean;
}

export interface MemoryInsertionResult {
	memoryLoads: number;
}

export interface MemoryLibraryOptions {
	repository: MemoryRepository;
	sendMessage: ExtensionAPI["sendMessage"];
}

/**
 * Newest memories loaded into the browser dialog. Search and scope filtering run over
 * this slice, so it is large enough to cover a store worth browsing without holding
 * every memory body in memory.
 */
const BROWSE_INDEX_LIMIT = 500;

/**
 * User-facing memory operations for pi tools and commands.
 *
 * The library hides persistence lookup rules, context framing, session-memory
 * updates, recent-memory pagination, and picker UI orchestration so extensions
 * only declare how pi exposes each operation.
 */
export interface MemoryLibrary {
	getMemory(params: GetMemoryParams): AgentToolResult<AgentMemory | null>;
	listProjectMemories(params: ListProjectMemoriesParams): AgentToolResult<AgentMemory[]>;
	saveCurrentSessionSummary(
		ctx: ExtensionContext,
		summary: SessionSummary,
	): AgentToolResult<{ severity: "info" | "warning" } & SessionSummary>;
	updateCurrentSessionInfo(ctx: ExtensionContext): void;
	insertMemories(
		params: InsertMemoriesParams,
		options?: MemoryInsertionOptions,
	): AgentToolResult<MemoryInsertionResult>;
	pickAndInsertRecentMemories(ctx: ExtensionContext): Promise<void>;
}

function textResult<TDetails>(text: string, details: TDetails): AgentToolResult<TDetails> {
	return {
		content: [{ type: "text", text }],
		details,
	};
}

function frameMemoriesForModel(text: string): string {
	return `<recalled_memories read_only="true">\n${text}\n</recalled_memories>\n\nThese memories are recalled as read-only context. Do NOT save a new session summary as a result of loading them.`;
}

export function createMemoryLibrary({
	repository,
	sendMessage,
}: MemoryLibraryOptions): MemoryLibrary {
	const catalog = createMemoryCatalog(repository);
	const context = resolveMemoryForContext({ repository });
	const sessionMemory = createSessionMemory(repository);

	function sendMemoriesToModel(
		memoryInfo: MemoryInfoForRetrieval[],
		options: MemoryInsertionOptions = {},
	): MemoryInsertionResult {
		const memories = context.getMemories(memoryInfo);
		const text = formatMemoriesForContext(memories);

		if (text) {
			sendMessage(
				{ customType: "memories", content: frameMemoriesForModel(text), display: true },
				{ deliverAs: "steer", triggerTurn: options.triggerTurn },
			);
		}

		return { memoryLoads: memories.length };
	}

	return {
		getMemory(params) {
			const memory = repository.findMemory(params.projectName, params.memoryName);
			if (!memory) {
				return textResult(
					`Memory "${params.memoryName}" not found in project "${params.projectName}".`,
					null,
				);
			}
			return textResult(JSON.stringify(memory.data, null, 2), memory);
		},

		listProjectMemories(params) {
			const memories = repository.listMemories(params.projectName);
			const names = memories.map(
				(m) => `- ${m.name} (updated: ${m.updatedAt?.toISOString() ?? "unknown"})`,
			);
			return textResult(
				names.length > 0
					? names.join("\n")
					: `No memories found for project "${params.projectName}".`,
				memories,
			);
		},

		saveCurrentSessionSummary(ctx, summary) {
			const { message, severity } = sessionMemory.saveSummary(ctx, summary);
			return textResult(message, { severity, ...summary });
		},

		updateCurrentSessionInfo(ctx) {
			const { message, severity } = sessionMemory.updateInfo(ctx);
			ctx.ui.notify(message, severity);
		},

		insertMemories(params, options) {
			return textResult("Done", sendMemoriesToModel(params.memories, options));
		},

		async pickAndInsertRecentMemories(ctx) {
			const entries = catalog.listRecentMemories(BROWSE_INDEX_LIMIT, 0);
			const totalCount = repository.countMemories();
			const currentProject = basename(getSessionInfo(ctx).cwd) || null;

			const selected = await ctx.ui.custom<MemoryInfoForRetrieval[] | null>(
				(tui, theme, keybindings, done) =>
					new MemoryBrowserDialog({
						title: "Memory Library",
						entries,
						totalCount,
						currentProject,
						keybindings,
						getTheme: () => ctx.ui.theme ?? theme,
						terminalRows: () => tui.terminal.rows,
						requestRender: () => tui.requestRender(),
						onSubmit: done,
						onCancel: () => done(null),
					}),
				{
					overlay: true,
					overlayOptions: { width: "90%", minWidth: 70, maxHeight: "90%", margin: 2 },
				},
			);

			if (!selected) return;
			if (selected.length === 0) {
				ctx.ui.notify("No memories selected.", "info");
				return;
			}

			const { memoryLoads } = sendMemoriesToModel(selected, { triggerTurn: true });
			ctx.ui.notify(`Inserted ${memoryLoads} memor${memoryLoads === 1 ? "y" : "ies"}.`, "info");
		},
	};
}
