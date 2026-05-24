import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "get_current_session",
		label: "Get Current Session",
		description:
			"Returns the current pi session metadata: ID, file path, display name, CWD, entry count, and leaf ID. Use this when you need to know which session file you are writing to.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const sm = ctx.sessionManager;

			const id = sm.getSessionId();
			const file = sm.getSessionFile();
			const name = sm.getSessionName();
			const cwd = sm.getCwd();
			const entries = sm.getEntries();
			const leafId = sm.getLeafId();
			const info = {
				sessionId: id,
				sessionFile: file ?? null,
				sessionName: name ?? null,
				cwd,
				entryCount: entries.length,
				leafId: leafId ?? null,
			};

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(info, null, 2),
					},
				],
				details: info,
			};
		},
	});

	pi.registerCommand("session-info", {
		description: "Print current session metadata",
		handler: async (_args, ctx) => {
			const sm = ctx.sessionManager;
			const lines = [
				`Session ID: ${sm.getSessionId()}`,
				`File: ${sm.getSessionFile() ?? "(ephemeral)"}`,
				`Name: ${sm.getSessionName() ?? "(unset)"}`,
				`CWD: ${sm.getCwd()}`,
				`Entries: ${sm.getEntries().length}`,
				`Leaf: ${sm.getLeafId() ?? "(none)"}`,
			];
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
