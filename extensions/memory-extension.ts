import { readFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { saveSession } from "../src/memory/save-session.ts";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "count_lines",
		label: "Count Lines",
		description: "Count lines in a file using plain TypeScript",
		parameters: Type.Object({
			path: Type.String({ description: "File path" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const content = await readFile(params.path, "utf8");
			const lines = content.split("\n").length;

			return {
				content: [{ type: "text", text: `${lines} lines in ${params.path}` }],
				details: { lines, path: params.path },
			};
		},
	});

	pi.registerCommand("save-info", {
		description: "Save the current session into the memory store",
		handler: async (_args, ctx) => {
			const { message, severity } = saveSession(ctx);
			ctx.ui.notify(message, severity);
		},
	});
}
