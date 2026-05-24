import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import exampleTypebox from "../../extensions/example-typebox.ts";
import sessionTool from "../../extensions/session-tool.ts";

export default function (pi: ExtensionAPI) {
	sessionTool(pi);
	exampleTypebox(pi);
}
