import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openPlanModeSession } from "../src/plan-mode/session.ts";

export default function planModeExtension(pi: ExtensionAPI) {
	const baseDir = dirname(fileURLToPath(import.meta.url));
	const planMode = openPlanModeSession(pi, {
		planTemplatePath: join(baseDir, "..", "prompts", "plan.md"),
	});

	pi.registerFlag("plan", {
		description: "Start in native plan mode (read-only planning)",
		type: "boolean",
		default: false,
	});

	pi.registerTool(planMode.planExitTool());

	pi.registerCommand("plan-mode", {
		description: "Toggle native read-only plan mode",
		handler: async (args, ctx) => planMode.handleCommand(args, ctx),
	});

	pi.on("session_start", async (_event, ctx) => {
		planMode.restore(ctx, pi.getFlag("plan") === true);
	});

	pi.on("before_agent_start", async (event) => planMode.beforeAgentStart(event));

	pi.on("tool_call", async (event) => planMode.blockToolCall(event));

	pi.on("agent_end", async (_event, ctx) => {
		await planMode.handleAgentEnd(ctx);
	});
}
