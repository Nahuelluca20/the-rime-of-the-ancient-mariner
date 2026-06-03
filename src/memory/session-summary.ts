import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolveSession } from "./session-commands.ts";
import type { MemoryStore } from "./store.ts";

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

export interface SaveSummaryResult {
	message: string;
	severity: "info" | "warning";
}

export function saveSessionSummary(
	ctx: ExtensionContext,
	store: MemoryStore,
	summary: SessionSummary,
): SaveSummaryResult {
	const resolved = resolveSession(ctx);
	if ("severity" in resolved) return resolved;

	const existing = store.getMemory(resolved.projectName, resolved.name);

	if (existing) {
		store.updateMemory(resolved.projectName, resolved.name, {
			...existing.data,
			...summary,
		});
		return {
			message: `Updated summary for "${resolved.name}" in project "${resolved.projectName}".`,
			severity: "info",
		};
	}

	store.createMemory(resolved.projectName, resolved.name, {
		...resolved.data,
		...summary,
	});
	return {
		message: `Saved summary "${resolved.name}" to project "${resolved.projectName}".`,
		severity: "info",
	};
}
