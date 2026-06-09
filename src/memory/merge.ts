import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSessionInfo } from "../session/info.ts";
import { type SessionCommandResult, resolveSession } from "./session-commands.ts";
import type { AgentMemory, AgentMemoryData } from "./store.ts";

export interface MemoryTarget {
	projectName: string;
	name: string;
}

export type MergeDecision = "mix" | "replace" | "cancel";

export interface ResolvedTarget extends MemoryTarget {
	data: AgentMemoryData;
	fromOverride: boolean;
}

/**
 * Per-process coordinator for memory saves.
 *
 * Holds two pieces of in-memory state (lost on restart, which only means the
 * next colliding save re-prompts):
 * - the target override picked via /target-memory, and
 * - the pending merge approval that lets the model's follow-up
 *   save_session_summary call write the merged summary without re-prompting.
 */
export interface SaveCoordinator {
	/** Set or clear the save target override. Always clears any pending merge. */
	setTarget(target: MemoryTarget | null): void;
	getTarget(): MemoryTarget | null;
	/**
	 * Resolve where the next save should land: the override target if one is
	 * set (works without a session name and across projects), otherwise the
	 * session-derived (project, name) from resolveSession.
	 */
	resolveTarget(ctx: ExtensionContext): ResolvedTarget | SessionCommandResult;
	/** Record that the user approved an LLM merge into the given target. */
	approveMerge(target: MemoryTarget): void;
	/** Returns true (and clears the approval) exactly once per approveMerge with a matching key. */
	consumePendingMerge(target: MemoryTarget): boolean;
	clearPendingMerge(): void;
}

function targetKey(target: MemoryTarget): string {
	return `${target.projectName}\0${target.name}`;
}

export function createSaveCoordinator(): SaveCoordinator {
	let target: MemoryTarget | null = null;
	let pendingMerge: MemoryTarget | null = null;

	return {
		setTarget(next) {
			target = next;
			pendingMerge = null;
		},

		getTarget() {
			return target;
		},

		resolveTarget(ctx) {
			if (target) {
				const info = getSessionInfo(ctx);
				return {
					...target,
					data: { cwd: info.cwd, sessionId: info.sessionId },
					fromOverride: true,
				};
			}
			const resolved = resolveSession(ctx);
			if ("severity" in resolved) return resolved;
			return { ...resolved, fromOverride: false };
		},

		approveMerge(next) {
			pendingMerge = { ...next };
		},

		consumePendingMerge(next) {
			if (!pendingMerge || targetKey(pendingMerge) !== targetKey(next)) return false;
			pendingMerge = null;
			return true;
		},

		clearPendingMerge() {
			pendingMerge = null;
		},
	};
}

/**
 * Tool-result text for the "mix" branch: it must carry the existing memory and
 * instruct the model to call save_session_summary exactly once more with the
 * merged summary, which the coordinator then writes without re-prompting.
 */
export function buildMergeInstructions(target: MemoryTarget, existing: AgentMemory): string {
	const { cwd: _cwd, sessionId: _sessionId, ...content } = existing.data;
	return [
		`A memory named "${target.name}" already exists in project "${target.projectName}" and the user chose to MIX it with your new summary.`,
		"",
		"Existing memory content:",
		"```json",
		JSON.stringify(content, null, 2),
		"```",
		"",
		"Compose ONE coherent merged summary that combines the existing content with your new summary: merge `context` and `description`, unify `tags`, and pick the best `title` and `sessionType`.",
		"Then call `save_session_summary` exactly once more with the merged fields. That next call will be saved directly without asking the user again. Do not call it more than once.",
	].join("\n");
}
