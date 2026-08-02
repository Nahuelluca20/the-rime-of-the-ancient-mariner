import { describe, expect, test } from "bun:test";
import type { ExecOptions, ExecResult } from "@earendil-works/pi-coding-agent";
import { createSubagentLibrary } from "../../src/subagents/search.ts";

interface Invocation {
	command: string;
	args: string[];
	options?: ExecOptions;
}

function createLibrary(result: ExecResult, invocations: Invocation[]) {
	return createSubagentLibrary({
		promptTemplatePath: "/package/prompts/subagent-codebase-search.md",
		exec: async (command, args, options) => {
			invocations.push({ command, args, options });
			return result;
		},
	});
}

describe("createSubagentLibrary", () => {
	test("runs the isolated read-only Pi command in the target project", async () => {
		const invocations: Invocation[] = [];
		const library = createLibrary(
			{ stdout: "## Findings\n\nLocated the entrypoint.", stderr: "", code: 0, killed: false },
			invocations,
		);
		const signal = new AbortController().signal;

		const result = await library.searchCodebase({
			task: "Find the application entrypoint",
			cwd: "/projects/example",
			signal,
		});

		expect(result.content[0]).toEqual({
			type: "text",
			text: "## Findings\n\nLocated the entrypoint.",
		});
		expect(result.details).toMatchObject({
			cwd: "/projects/example",
			exitCode: 0,
			truncated: false,
		});
		expect(invocations).toEqual([
			{
				command: "pi",
				args: [
					"-p",
					"--no-session",
					"--no-extensions",
					"--no-skills",
					"--no-prompt-templates",
					"--prompt-template",
					"/package/prompts/subagent-codebase-search.md",
					"--tools",
					"read,grep,find,ls",
					"/subagent-codebase-search Find the application entrypoint",
				],
				options: { cwd: "/projects/example", signal },
			},
		]);
	});

	test("throws child-process diagnostics for a failed search", async () => {
		const invocations: Invocation[] = [];
		const library = createLibrary(
			{ stdout: "", stderr: "No model is configured", code: 1, killed: false },
			invocations,
		);

		await expect(
			library.searchCodebase({ task: "Find auth", cwd: "/projects/example" }),
		).rejects.toThrow("Subagent search failed (exit code 1): No model is configured");
	});

	test("reports cancellation when Pi kills the child process", async () => {
		const invocations: Invocation[] = [];
		const library = createLibrary({ stdout: "", stderr: "", code: 143, killed: true }, invocations);

		await expect(
			library.searchCodebase({ task: "Find auth", cwd: "/projects/example" }),
		).rejects.toThrow("Subagent search was cancelled.");
	});
});
