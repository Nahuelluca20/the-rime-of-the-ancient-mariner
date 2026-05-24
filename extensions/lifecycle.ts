import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const baseDir = dirname(fileURLToPath(import.meta.url));

	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify(`Session started at ${new Date().toISOString()}`, "info");
	});

	pi.on("resources_discover", async (_event, _ctx) => {
		return {
			promptPaths: [join(baseDir, "..", "prompts")],
		};
	});
}
