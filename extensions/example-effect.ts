import type { BeforeProviderRequestEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Console, Effect, pipe } from "effect";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// ── Custom tool using Effect ──
	pi.registerTool({
		name: "count_lines",
		label: "Count Lines",
		description: "Count lines in a file using Effect-TS",
		parameters: Type.Object({
			path: Type.String({ description: "File path" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			// Build an Effect program
			const program = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const content = yield* fs.readFileString(params.path);
				const lines = content.split("\n").length;
				return lines;
			});

			// Provide the Node implementation and run
			const runnable = Effect.provide(program, NodeFileSystem.layer);
			const lines = await Effect.runPromise(runnable);

			return {
				content: [{ type: "text", text: `${lines} lines in ${params.path}` }],
				details: { lines, path: params.path },
			};
		},
	});

	// ── Command using Effect ──
	pi.registerCommand("effect-demo", {
		description: "Run a simple Effect demo",
		handler: async (_args, ctx) => {
			const program = Effect.gen(function* () {
				yield* Console.log("Running Effect inside pi extension");
				const result = yield* Effect.sync(() => Math.random());
				return result;
			});

			const value = await Effect.runPromise(program);
			ctx.ui.notify(`Effect produced: ${value}`, "info");
			const choice = await ctx.ui.select("Elegí:", ["A", "B", "C"]);
		},
	});

	// ── Event handler using Effect ──
	pi.on("session_start", async (_event, ctx) => {
		const program = pipe(
			Effect.sync(() => new Date().toISOString()),
			Effect.tap((date) => Effect.sync(() => ctx.ui.notify(`Session started at ${date}`, "info"))),
		);
		await Effect.runPromise(program);
	});
}
