import { basename } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSessionInfo } from "../session/info.ts";
import { openMemoryStore } from "./store.ts";

export interface SaveSessionResult {
	message: string;
	severity: "info" | "warning";
}

export function saveSession(ctx: ExtensionContext): SaveSessionResult {
	const info = getSessionInfo(ctx);

	if (!info.sessionName) {
		return {
			message: "This session has no name. Use the /name command to set one before saving.",
			severity: "warning",
		};
	}

	const projectName = basename(info.cwd);
	const store = openMemoryStore();

	const { created } = store.putMemory(projectName, info.sessionName, {
		cwd: info.cwd,
		sessionId: info.sessionId,
	});

	if (!created) {
		return {
			message: `A memory named "${info.sessionName}" already exists in project "${projectName}". An update command will be added separately.`,
			severity: "warning",
		};
	}

	return {
		message: `Saved session "${info.sessionName}" to project "${projectName}".`,
		severity: "info",
	};
}
