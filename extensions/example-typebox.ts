import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { type Db, initDb } from "../db/index.ts";

export default function (pi: ExtensionAPI) {
	let db: Db;

	// ── Custom tool using plain TS + TypeBox ──
	pi.registerTool({
		name: "count_lines",
		label: "Count Lines",
		description: "Count lines in a file using plain TypeScript",
		parameters: Type.Object({
			path: Type.String({ description: "File path" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const content = await readFile(params.path, "utf8");
			const lines = content.split("\n").length;

			return {
				content: [{ type: "text", text: `${lines} lines in ${params.path}` }],
				details: { lines, path: params.path },
			};
		},
	});

	// ── Command using plain TS ──
	pi.registerCommand("ts-demo", {
		description: "Run a simple TS demo",
		handler: async (_args, ctx) => {
			console.log("Running TS demo inside pi extension");
			const value = Math.random();
			ctx.ui.notify(`TS demo produced: ${value}`, "info");
			const choice = await ctx.ui.select("Elegí:", ["A", "B", "C"]);
		},
	});

	// ── Event handler using plain TS ──
	pi.on("session_start", async (_event, ctx) => {
		try {
			db = initDb();
			ctx.ui.notify("DB ready", "info");
		} catch (err) {
			ctx.ui.notify(`DB init failed: ${(err as Error).message}`, "error");
			return;
		}
		const date = new Date().toISOString();
		ctx.ui.notify(`Session started at ${date}`, "info");
	});

	const baseDir = dirname(fileURLToPath(import.meta.url));

	// Discovery Prompts
	pi.on("resources_discover", async (_event, _ctx) => {
		return {
			promptPaths: [join(baseDir, "..", "prompts")],
		};
	});
}
