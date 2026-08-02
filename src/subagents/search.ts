import {
	type AgentToolResult,
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	type ExecOptions,
	type ExecResult,
	formatSize,
	truncateHead,
} from "@earendil-works/pi-coding-agent";

export interface SubagentSearchParams {
	task: string;
	cwd: string;
	signal?: AbortSignal;
}

export interface SubagentSearchDetails {
	command: string;
	args: string[];
	cwd: string;
	exitCode: number;
	stderr: string;
	truncated: boolean;
}

export interface SubagentLibraryOptions {
	promptTemplatePath: string;
	exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
}

/**
 * Runs the package's read-only codebase-search prompt in an isolated Pi process.
 *
 * The facade owns child-process isolation, Pi command arguments, output limits,
 * and execution diagnostics so extensions only provide the delegated task and cwd.
 */
export interface SubagentLibrary {
	searchCodebase(params: SubagentSearchParams): Promise<AgentToolResult<SubagentSearchDetails>>;
}

function formatFailure(result: ExecResult): string {
	const diagnostics = result.stderr.trim() || result.stdout.trim() || "No diagnostic output.";
	return `Subagent search failed (exit code ${result.code}): ${diagnostics}`;
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

export function createSubagentLibrary({
	promptTemplatePath,
	exec,
}: SubagentLibraryOptions): SubagentLibrary {
	return {
		async searchCodebase({ task, cwd, signal }) {
			const args = [
				"-p",
				"--no-session",
				"--no-extensions",
				"--no-skills",
				"--no-prompt-templates",
				"--prompt-template",
				promptTemplatePath,
				"--tools",
				"read,grep,find,ls",
				`/subagent-codebase-search ${task.trim()}`,
			];
			const result = await exec("pi", args, { cwd, signal });

			if (result.code !== 0 || result.killed) {
				throw new Error(result.killed ? "Subagent search was cancelled." : formatFailure(result));
			}

			const output = formatOutput(result.stdout);
			return {
				content: [{ type: "text", text: output.text }],
				details: {
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
