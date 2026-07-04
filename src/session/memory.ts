import { basename } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { MemoryRepository } from "../memory/repository.ts";
import type { AgentMemoryData } from "../memory/types.ts";
import { getSessionInfo } from "./info.ts";

export const SESSION_TYPES = [
	"implementation",
	"code-exploration",
	"implementation-exploration",
	"code-understanding",
	"mixed",
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

export interface SessionSummary {
	title: string;
	description: string;
	context: string;
	sessionType?: SessionType;
	tags?: string[];
}

export interface SessionActionResult {
	message: string;
	severity: "info" | "warning";
}

/**
 * Stores and updates memories that represent the current pi session.
 */
export interface SessionMemory {
	/**
	 * Creates a memory row for the current named session without overwriting existing data.
	 */
	saveInfo(ctx: ExtensionContext): SessionActionResult;

	/**
	 * Replaces the current named session's metadata in an existing memory row.
	 */
	updateInfo(ctx: ExtensionContext): SessionActionResult;

	/**
	 * Creates or updates the current named session's memory row with a durable summary.
	 */
	saveSummary(ctx: ExtensionContext, summary: SessionSummary): SessionActionResult;
}

interface CurrentSessionMemory {
	projectName: string;
	name: string;
	data: AgentMemoryData;
}

function resolveCurrentSessionMemory(
	ctx: ExtensionContext,
): CurrentSessionMemory | SessionActionResult {
	const info = getSessionInfo(ctx);
	if (!info.sessionName) {
		return {
			message: "This session has no name. Use the /name command to set one before saving.",
			severity: "warning",
		};
	}
	return {
		projectName: basename(info.cwd),
		name: info.sessionName,
		data: { cwd: info.cwd, sessionId: info.sessionId },
	};
}

function isActionResult(
	value: CurrentSessionMemory | SessionActionResult,
): value is SessionActionResult {
	return "severity" in value;
}

/**
 * Binds current-session memory operations to a generic memory store.
 */
export function createSessionMemory(repository: MemoryRepository): SessionMemory {
	return {
		saveInfo(ctx) {
			const session = resolveCurrentSessionMemory(ctx);
			if (isActionResult(session)) return session;

			const { created } = repository.createMemory(session.projectName, session.name, session.data);
			if (!created) {
				return {
					message: `A memory named "${session.name}" already exists in project "${session.projectName}". Use /update-info to overwrite it.`,
					severity: "warning",
				};
			}
			return {
				message: `Saved session "${session.name}" to project "${session.projectName}".`,
				severity: "info",
			};
		},

		updateInfo(ctx) {
			const session = resolveCurrentSessionMemory(ctx);
			if (isActionResult(session)) return session;

			const { updated } = repository.updateMemory(session.projectName, session.name, session.data);
			if (!updated) {
				return {
					message: `No memory named "${session.name}" exists in project "${session.projectName}". Use /save-info first.`,
					severity: "warning",
				};
			}
			return {
				message: `Updated memory "${session.name}" in project "${session.projectName}".`,
				severity: "info",
			};
		},

		saveSummary(ctx, summary) {
			const session = resolveCurrentSessionMemory(ctx);
			if (isActionResult(session)) return session;

			const existing = repository.findMemory(session.projectName, session.name);
			if (existing) {
				repository.updateMemory(session.projectName, session.name, {
					...existing.data,
					...summary,
				});
				return {
					message: `Updated summary for "${session.name}" in project "${session.projectName}".`,
					severity: "info",
				};
			}

			repository.createMemory(session.projectName, session.name, {
				...session.data,
				...summary,
			});
			return {
				message: `Saved summary "${session.name}" to project "${session.projectName}".`,
				severity: "info",
			};
		},
	};
}
