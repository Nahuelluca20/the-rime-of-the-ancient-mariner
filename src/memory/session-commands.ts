import { basename } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSessionInfo } from "../session/info.ts";
import { type AgentMemoryData, openMemoryStore } from "./store.ts";

export interface SessionCommandResult {
	message: string;
	severity: "info" | "warning";
}

interface ResolvedSession {
	projectName: string;
	name: string;
	data: AgentMemoryData;
}

function resolveSession(ctx: ExtensionContext): ResolvedSession | SessionCommandResult {
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

export function saveSession(ctx: ExtensionContext): SessionCommandResult {
	const resolved = resolveSession(ctx);
	if ("severity" in resolved) return resolved;

	const store = openMemoryStore();
	const { created } = store.createMemory(resolved.projectName, resolved.name, resolved.data);
	if (!created) {
		return {
			message: `A memory named "${resolved.name}" already exists in project "${resolved.projectName}". Use /update-info to overwrite it.`,
			severity: "warning",
		};
	}
	return {
		message: `Saved session "${resolved.name}" to project "${resolved.projectName}".`,
		severity: "info",
	};
}

export function updateSession(ctx: ExtensionContext): SessionCommandResult {
	const resolved = resolveSession(ctx);
	if ("severity" in resolved) return resolved;

	const store = openMemoryStore();
	const { updated } = store.updateMemory(resolved.projectName, resolved.name, resolved.data);
	if (!updated) {
		return {
			message: `No memory named "${resolved.name}" exists in project "${resolved.projectName}". Use /save-info first.`,
			severity: "warning",
		};
	}
	return {
		message: `Updated memory "${resolved.name}" in project "${resolved.projectName}".`,
		severity: "info",
	};
}
