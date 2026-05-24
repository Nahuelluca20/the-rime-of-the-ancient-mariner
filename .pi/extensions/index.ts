import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import lifeCycleExtension from "../../extensions/lifecycle.ts";
import memoryExtension from "../../extensions/memory-extension.ts";
import sessionExtension from "../../extensions/session-extension.ts";

export default function (pi: ExtensionAPI) {
	sessionExtension(pi);
	memoryExtension(pi);
	lifeCycleExtension(pi);
}
