import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createGitBranchCatalog } from "../src/git/branches.ts";
import { openLocalBranchPicker } from "../src/git/ui.ts";

export default function gitExtension(pi: ExtensionAPI) {
	const branchCatalog = createGitBranchCatalog();

	pi.registerCommand("git-branches", {
		description: "Browse local Git branches ordered by their most recent commit",
		handler: async (_args, ctx) => openLocalBranchPicker(ctx, branchCatalog),
	});
}
