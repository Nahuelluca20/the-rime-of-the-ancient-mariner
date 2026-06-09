import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	type MemoryTarget,
	type MergeDecision,
	type SaveCoordinator,
	buildMergeInstructions,
} from "./merge.ts";
import type { AgentMemory, MemoryStore } from "./store.ts";

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

export interface SaveSummaryOutcome {
	status: "created" | "replaced" | "merged" | "merge-requested" | "canceled" | "error";
	message: string;
	severity: "info" | "warning";
}

export async function saveSessionSummary(
	ctx: ExtensionContext,
	store: MemoryStore,
	coordinator: SaveCoordinator,
	summary: SessionSummary,
	promptDecision: (target: MemoryTarget, existing: AgentMemory) => Promise<MergeDecision>,
): Promise<SaveSummaryOutcome> {
	const resolved = coordinator.resolveTarget(ctx);
	if ("severity" in resolved) {
		return { status: "error", ...resolved };
	}

	const target: MemoryTarget = { projectName: resolved.projectName, name: resolved.name };
	const data = { ...resolved.data, ...summary };

	// Re-entry: the user already approved a mix, so this call carries the
	// model's merged summary — write it directly, replacing the old data.
	if (coordinator.consumePendingMerge(target)) {
		const { updated } = store.updateMemory(target.projectName, target.name, data);
		if (updated) {
			return {
				status: "merged",
				message: `Merged summary saved to "${target.name}" in project "${target.projectName}".`,
				severity: "info",
			};
		}
		// The memory disappeared between approval and write; fall through to create.
	}

	const existing = store.getMemory(target.projectName, target.name);

	if (!existing) {
		store.createMemory(target.projectName, target.name, data);
		return {
			status: "created",
			message: `Saved summary "${target.name}" to project "${target.projectName}".`,
			severity: "info",
		};
	}

	const decision = await promptDecision(target, existing);

	if (decision === "replace") {
		store.updateMemory(target.projectName, target.name, data);
		return {
			status: "replaced",
			message: `Replaced memory "${target.name}" in project "${target.projectName}" with the new summary.`,
			severity: "info",
		};
	}

	if (decision === "mix") {
		coordinator.approveMerge(target);
		return {
			status: "merge-requested",
			message: buildMergeInstructions(target, existing),
			severity: "info",
		};
	}

	return {
		status: "canceled",
		message: `The save was canceled (user choice, or no interactive UI to confirm overwriting); memory "${target.name}" in project "${target.projectName}" was left untouched. Do not retry unless asked.`,
		severity: "warning",
	};
}
