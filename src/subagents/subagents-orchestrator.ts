import { basename, extname, resolve } from "node:path";
import {
	type AgentToolResult,
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	type ExtensionAPI,
	type ExtensionUIContext,
	type SlashCommandInfo,
	formatSize,
	truncateHead,
} from "@earendil-works/pi-coding-agent";

export type SubagentAccess = "full" | "read-only";

interface SubagentsOrchestratorOptions {
	pi: Pick<ExtensionAPI, "exec" | "getCommands">;
	resolveAccess: () => SubagentAccess;
}

export interface RunSubagentParams {
	promptPath: string;
	task: string;
	cwd: string;
	signal?: AbortSignal;
	ui?: Pick<ExtensionUIContext, "notify">;
}

export interface SubagentExecutionDetails {
	promptName: string;
	promptPath: string;
	command: string;
	args: string[];
	cwd: string;
	exitCode: number;
	stderr: string;
	truncated: boolean;
}

export interface SubagentsOrchestrator {
	list(): Promise<AgentToolResult<SubagentTemplate[]>>;

	/** Runs a discovered subagent prompt in an isolated Pi process. */
	run(params: RunSubagentParams): Promise<AgentToolResult<SubagentExecutionDetails>>;
}

export type SubagentTemplate = {
	name: string;
	path: string;
	description?: string;
	baseDir?: string;
};

const FULL_CODING_TOOLS = "read,bash,edit,write,grep,find,ls";
const READ_ONLY_TOOLS = "read,grep,find,ls";

function normalizePromptPath(promptPath: string, cwd: string): string {
	const pathWithoutAtPrefix = promptPath.startsWith("@") ? promptPath.slice(1) : promptPath;
	return resolve(cwd, pathWithoutAtPrefix);
}

function formatOutput(stdout: string): { text: string; truncated: boolean } {
	const output = truncateHead(stdout, {
		maxBytes: DEFAULT_MAX_BYTES,
		maxLines: DEFAULT_MAX_LINES,
	});
	if (!output.truncated) return { text: output.content || "(no output)", truncated: false };

	return {
		text: `${output.content}\n\n[Subagent output truncated: ${output.outputLines} of ${output.totalLines} lines, ${formatSize(output.outputBytes)} of ${formatSize(output.totalBytes)}.]`,
		truncated: true,
	};
}

function formatFailure(result: { code: number; stderr: string; stdout: string }): string {
	const diagnostics = result.stderr.trim() || result.stdout.trim() || "No diagnostic output.";
	return `Subagent execution failed (exit code ${result.code}): ${diagnostics}`;
}

export function createSubagentsOrchestrator({
	pi,
	resolveAccess,
}: SubagentsOrchestratorOptions): SubagentsOrchestrator {
	function subagentPromptTemplates(): SlashCommandInfo[] {
		return pi
			.getCommands()
			.filter((command) => command.source === "prompt" && command.name.startsWith("subagent-"));
	}

	return {
		async list(): Promise<AgentToolResult<SubagentTemplate[]>> {
			const templates: SubagentTemplate[] = subagentPromptTemplates().map((template) => ({
				name: template.name,
				description: template.description,
				path: template.sourceInfo.path,
				baseDir: template.sourceInfo.baseDir,
			}));

			return {
				content: [
					{
						type: "text",
						text: templates.length
							? templates
									.map(
										(template) =>
											`name: ${template.name}\ndescription: ${template.description ?? ""}\npath: ${template.path}\nbaseDir: ${template.baseDir ?? ""}`,
									)
									.join("\n\n")
							: "No subagent prompt templates are available.",
					},
				],
				details: templates,
			};
		},

		async run({ promptPath, task, cwd, signal, ui }) {
			const normalizedTask = task.trim();
			if (!normalizedTask) {
				throw new Error("Subagent task must not be empty.");
			}

			const requestedPath = normalizePromptPath(promptPath, cwd);
			const template = subagentPromptTemplates().find(
				(candidate) => normalizePromptPath(candidate.sourceInfo.path, cwd) === requestedPath,
			);
			if (!template) {
				throw new Error(
					"Unknown subagent prompt path. Call list_available_subagents and use one of its paths.",
				);
			}

			const authoritativePath = normalizePromptPath(template.sourceInfo.path, cwd);
			const promptName = basename(authoritativePath, extname(authoritativePath));
			ui?.notify(`Running subagent: ${promptName}`, "info");

			const args = [
				"-p",
				"--no-session",
				"--no-extensions",
				"--no-skills",
				"--no-prompt-templates",
				"--prompt-template",
				authoritativePath,
				"--tools",
				resolveAccess() === "full" ? FULL_CODING_TOOLS : READ_ONLY_TOOLS,
				`/${promptName} ${normalizedTask}`,
			];
			const result = await pi.exec("pi", args, { cwd, signal });

			if (result.killed) {
				throw new Error("Subagent execution was cancelled.");
			}
			if (result.code !== 0) {
				throw new Error(formatFailure(result));
			}

			const output = formatOutput(result.stdout);
			return {
				content: [{ type: "text", text: output.text }],
				details: {
					promptName,
					promptPath: authoritativePath,
					command: "pi",
					args,
					cwd,
					exitCode: result.code,
					stderr: result.stderr,
					truncated: output.truncated,
				},
			};
		},
	};
}
