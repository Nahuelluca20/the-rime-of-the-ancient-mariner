import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface LifecycleExtensionOptions {
	discoverResources?: boolean;
}

export default function lifecycleExtension(
	pi: ExtensionAPI,
	options: LifecycleExtensionOptions = {},
) {
	const baseDir = dirname(fileURLToPath(import.meta.url));

	if (options.discoverResources) {
		pi.on("resources_discover", async (_event, _ctx) => {
			return {
				promptPaths: [join(baseDir, "..", "prompts")],
				skillPaths: [join(baseDir, "..", "skills")],
			};
		});
	}
}
