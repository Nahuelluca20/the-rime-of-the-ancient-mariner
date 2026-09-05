import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openPlanModeSession } from "../src/plan-mode/session.ts";
import {
	SUBAGENTS_AVAILABILITY_CHANGED_EVENT,
	type SubagentsAvailabilityChanged,
} from "../src/subagents/session.ts";

export default function planModeExtension(pi: ExtensionAPI) {
	const baseDir = dirname(fileURLToPath(import.meta.url));
	const planMode = openPlanModeSession(pi, {
		systemPromptPath: join(baseDir, "..", "resources", "plan-system.md"),
	});

	pi.registerFlag("with-plan", {
		description: "Start in native plan mode (read-only planning)",
		type: "boolean",
		default: false,
	});

	pi.registerTool(planMode.planExitTool());

	pi.registerCommand("plan-mode", {
		description: "Toggle native read-only plan mode",
		handler: async (args, ctx) => planMode.handleCommand(args, ctx),
	});

	pi.registerShortcut("shift+tab", {
		description: "Toggle native read-only plan mode",
		handler: async (ctx) => planMode.handleCommand("toggle", ctx),
	});

	pi.on("session_start", async (_event, ctx) => {
		planMode.restore(ctx, pi.getFlag("with-plan") === true);
	});

	pi.events.on(SUBAGENTS_AVAILABILITY_CHANGED_EVENT, (data) => {
		if (typeof data !== "object" || data === null || !("enabled" in data)) return;
		const change = data as SubagentsAvailabilityChanged;
		if (typeof change.enabled === "boolean") {
			planMode.setSubagentsEnabled(change.enabled);
		}
	});

	pi.on("before_agent_start", async (event) => planMode.beforeAgentStart(event));

	pi.on("tool_call", async (event) => planMode.blockToolCall(event));

	// agent_end still runs inside the active loop; start implementation only after it settles.
	pi.on("agent_settled", async (_event, ctx) => {
		await planMode.handleAgentSettled(ctx);
	});
}
