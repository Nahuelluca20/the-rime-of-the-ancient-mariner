import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface SessionInfo {
	sessionId: string;
	sessionFile: string | null;
	sessionName: string | null;
	cwd: string;
	entryCount: number;
	leafId: string | null;
}

export function getSessionInfo(ctx: ExtensionContext): SessionInfo {
	const sm = ctx.sessionManager;
	return {
		sessionId: sm.getSessionId(),
		sessionFile: sm.getSessionFile() ?? null,
		sessionName: sm.getSessionName() ?? null,
		cwd: sm.getCwd(),
		entryCount: sm.getEntries().length,
		leafId: sm.getLeafId() ?? null,
	};
}
