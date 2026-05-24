import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { getSessionInfo } from "../src/session/info.ts";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "get_current_session",
		label: "Get Current Session",
		description: "Return the current pi session metadata.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const info = getSessionInfo(ctx);
			return {
				content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
				details: info,
			};
		},
	});

	pi.registerCommand("session-info", {
		description: "Print current session metadata",
		handler: async (_args, ctx) => {
			const info = getSessionInfo(ctx);
			const lines = [
				`Session ID: ${info.sessionId}`,
				`File: ${info.sessionFile ?? "(ephemeral)"}`,
				`Name: ${info.sessionName ?? "(unset)"}`,
				`CWD: ${info.cwd}`,
				`Entries: ${info.entryCount}`,
				`Leaf: ${info.leafId ?? "(none)"}`,
			];
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
