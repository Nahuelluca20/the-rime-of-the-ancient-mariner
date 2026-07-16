import { DynamicBorder, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";
import type { GitBranchCatalog } from "./branches.js";

/**
 * Open the local-branch picker for the command's project directory.
 *
 * The picker owns loading feedback, dialog construction, cancellation, and the
 * selected-branch notification. It deliberately does not check out a branch.
 */
export async function openLocalBranchPicker(
	ctx: ExtensionCommandContext,
	branchCatalog: GitBranchCatalog,
): Promise<void> {
	const branches = await branchCatalog.listRecent(ctx.cwd);
	if (branches.length === 0) {
		ctx.ui.notify("No local Git branches found.", "info");
		return;
	}

	const items: SelectItem[] = branches.map((branch) => ({
		value: branch.name,
		label: branch.isCurrent ? `${branch.name} (current)` : branch.name,
		description: `Last commit: ${branch.lastCommitAt.toISOString()}`,
	}));

	const selectedBranch = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Local branches")), 1, 0));

		const list = new SelectList(items, Math.min(items.length, 10), {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});
		list.onSelect = (item) => done(item.value);
		list.onCancel = () => done(null);
		container.addChild(list);
		container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0));
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				list.handleInput(data);
				tui.requestRender();
			},
		};
	});

	if (selectedBranch) {
		ctx.ui.notify(`Selected branch: ${selectedBranch}`, "info");
	}
}
