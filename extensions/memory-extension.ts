import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createMemoryLibrary } from "../src/memory/library.ts";
import { openMemoryRepository } from "../src/memory/repository.ts";
import { SESSION_TYPES } from "../src/session/memory.ts";

export default function (pi: ExtensionAPI) {
	const memoryLibrary = createMemoryLibrary({
		repository: openMemoryRepository(),
		sendMessage: pi.sendMessage,
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
			return memoryLibrary.getMemory(params);
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
			return memoryLibrary.listProjectMemories(params);
		},
	});

	pi.registerTool({
		name: "save_session_summary",
		label: "Save Session Summary",
		description:
			"Persist a session summary, including optional session type and tags, into the current session's memory row.",
		promptGuidelines: [
			"Call save_session_summary ONLY when the user explicitly asks to save or persist a session summary (e.g. they run /save-summary, say 'save a summary', or ask to wrap up). Loading or recalling memories with get_memory / list_memories / insert_memories is read-only and is never by itself a trigger to save.",
		],
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
			return memoryLibrary.saveCurrentSessionSummary(ctx, params);
		},
	});

	pi.registerCommand("update-info", {
		description: "Update the current session's stored memory in place",
		handler: async (_args, ctx) => {
			memoryLibrary.updateCurrentSessionInfo(ctx);
		},
	});

	pi.registerTool({
		name: "insert_memories",
		label: "Insert Memories into the context of the session",
		description: "Insert Memories into the context",
		promptGuidelines: [
			"insert_memories injects recalled memories as read-only context. Loading memories is never a reason to call save_session_summary.",
		],
		parameters: Type.Object({
			memories: Type.Array(
				Type.Object({
					projectName: Type.String({ description: "Project name" }),
					memoryName: Type.String({ description: "Memory name" }),
				}),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			return memoryLibrary.insertMemories(params);
		},
	});

	pi.registerCommand("recent-memories", {
		description: "Pick recent memories and insert them into the LLM context",
		handler: async (_args, ctx) => {
			await memoryLibrary.pickAndInsertRecentMemories(ctx);
		},
	});
}
