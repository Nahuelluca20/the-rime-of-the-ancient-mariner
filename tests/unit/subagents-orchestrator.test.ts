import { describe, expect, test } from "bun:test";
import {
	DEFAULT_MAX_LINES,
	type ExecOptions,
	type ExecResult,
	type ExtensionAPI,
	type SlashCommandInfo,
} from "@earendil-works/pi-coding-agent";
import { createSubagentsOrchestrator } from "../../src/subagents/subagents-orchestrator.ts";

interface Invocation {
	command: string;
	args: string[];
	options?: ExecOptions;
}

function promptCommand(
	name: string,
	path: string,
	description = "A test subagent",
): SlashCommandInfo {
	return {
		name,
		description,
		source: "prompt",
		sourceInfo: {
			path,
			source: "test-package",
			scope: "temporary",
			origin: "package",
			baseDir: "/package/prompts",
		},
	};
}

function createHarness(commands: SlashCommandInfo[], result: ExecResult) {
	const invocations: Invocation[] = [];
	const pi: Pick<ExtensionAPI, "exec" | "getCommands"> = {
		getCommands: () => commands,
		exec: async (command, args, options) => {
			invocations.push({ command, args, options });
			return result;
		},
	};

	return {
		invocations,
		orchestrator: createSubagentsOrchestrator({ pi }),
	};
}

describe("createSubagentsOrchestrator", () => {
	test("lists only prompt commands with the subagent prefix", async () => {
		const subagent = promptCommand(
			"subagent-worker",
			"/package/prompts/subagent-worker.md",
			"Implement delegated work",
		);
		const regularPrompt = promptCommand("review", "/package/prompts/review.md");
		const extensionCommand: SlashCommandInfo = {
			...promptCommand("subagent-extension", "/extension.ts"),
			source: "extension",
		};
		const { orchestrator } = createHarness([subagent, regularPrompt, extensionCommand], {
			stdout: "",
			stderr: "",
			code: 0,
			killed: false,
		});

		const result = await orchestrator.list();

		expect(result.details).toEqual([
			{
				name: "subagent-worker",
				description: "Implement delegated work",
				path: "/package/prompts/subagent-worker.md",
				baseDir: "/package/prompts",
			},
		]);
		expect(result.content[0]).toEqual({
			type: "text",
			text: [
				"name: subagent-worker",
				"description: Implement delegated work",
				"path: /package/prompts/subagent-worker.md",
				"baseDir: /package/prompts",
			].join("\n"),
		});
	});

	test("runs a discovered prompt with full coding tools in an isolated Pi process", async () => {
		const commands = [promptCommand("subagent-worker:1", "/package/prompts/subagent-worker.md")];
		const { invocations, orchestrator } = createHarness(commands, {
			stdout: "Implemented the delegated task.",
			stderr: "",
			code: 0,
			killed: false,
		});
		const signal = new AbortController().signal;
		const notifications: Array<{ message: string; type: string | undefined }> = [];

		const result = await orchestrator.run({
			promptPath: "@/package/prompts/subagent-worker.md",
			task: "  Add the feature  ",
			cwd: "/projects/example",
			signal,
			ui: {
				notify(message, type) {
					notifications.push({ message, type });
				},
			},
		});

		expect(result.content[0]).toEqual({
			type: "text",
			text: "Implemented the delegated task.",
		});
		expect(result.details).toMatchObject({
			promptName: "subagent-worker",
			promptPath: "/package/prompts/subagent-worker.md",
			cwd: "/projects/example",
			exitCode: 0,
			truncated: false,
		});
		expect(notifications).toEqual([{ message: "Running subagent: subagent-worker", type: "info" }]);
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
					"/package/prompts/subagent-worker.md",
					"--tools",
					"read,bash,edit,write,grep,find,ls",
					"/subagent-worker Add the feature",
				],
				options: { cwd: "/projects/example", signal },
			},
		]);
	});

	test("rejects a prompt path that was not discovered", async () => {
		const { invocations, orchestrator } = createHarness(
			[promptCommand("subagent-worker", "/package/prompts/subagent-worker.md")],
			{ stdout: "", stderr: "", code: 0, killed: false },
		);

		await expect(
			orchestrator.run({
				promptPath: "/tmp/arbitrary.md",
				task: "Run arbitrary instructions",
				cwd: "/projects/example",
			}),
		).rejects.toThrow("Unknown subagent prompt path");
		expect(invocations).toHaveLength(0);
	});

	test("rejects a whitespace-only task before starting Pi", async () => {
		const { invocations, orchestrator } = createHarness(
			[promptCommand("subagent-worker", "/package/prompts/subagent-worker.md")],
			{ stdout: "", stderr: "", code: 0, killed: false },
		);

		await expect(
			orchestrator.run({
				promptPath: "/package/prompts/subagent-worker.md",
				task: "   ",
				cwd: "/projects/example",
			}),
		).rejects.toThrow("Subagent task must not be empty");
		expect(invocations).toHaveLength(0);
	});

	test("reports stderr when the child process fails", async () => {
		const { orchestrator } = createHarness(
			[promptCommand("subagent-worker", "/package/prompts/subagent-worker.md")],
			{ stdout: "", stderr: "No model is configured", code: 1, killed: false },
		);

		await expect(
			orchestrator.run({
				promptPath: "/package/prompts/subagent-worker.md",
				task: "Implement the feature",
				cwd: "/projects/example",
			}),
		).rejects.toThrow("Subagent execution failed (exit code 1): No model is configured");
	});

	test("uses stdout diagnostics when a failed child has no stderr", async () => {
		const { orchestrator } = createHarness(
			[promptCommand("subagent-worker", "/package/prompts/subagent-worker.md")],
			{ stdout: "Prompt template could not be loaded", stderr: "", code: 2, killed: false },
		);

		await expect(
			orchestrator.run({
				promptPath: "/package/prompts/subagent-worker.md",
				task: "Implement the feature",
				cwd: "/projects/example",
			}),
		).rejects.toThrow(
			"Subagent execution failed (exit code 2): Prompt template could not be loaded",
		);
	});

	test("reports cancellation when the child process is killed", async () => {
		const { orchestrator } = createHarness(
			[promptCommand("subagent-worker", "/package/prompts/subagent-worker.md")],
			{ stdout: "", stderr: "", code: 143, killed: true },
		);

		await expect(
			orchestrator.run({
				promptPath: "/package/prompts/subagent-worker.md",
				task: "Implement the feature",
				cwd: "/projects/example",
			}),
		).rejects.toThrow("Subagent execution was cancelled");
	});

	test("returns a placeholder when the child produces no output", async () => {
		const { orchestrator } = createHarness(
			[promptCommand("subagent-worker", "/package/prompts/subagent-worker.md")],
			{ stdout: "", stderr: "", code: 0, killed: false },
		);

		const result = await orchestrator.run({
			promptPath: "/package/prompts/subagent-worker.md",
			task: "Implement the feature",
			cwd: "/projects/example",
		});

		expect(result.content).toEqual([{ type: "text", text: "(no output)" }]);
		expect(result.details).toMatchObject({ exitCode: 0, stderr: "", truncated: false });
	});

	test("truncates oversized subagent output", async () => {
		const stdout = Array.from(
			{ length: DEFAULT_MAX_LINES + 1 },
			(_, index) => `line ${index}`,
		).join("\n");
		const { orchestrator } = createHarness(
			[promptCommand("subagent-worker", "/package/prompts/subagent-worker.md")],
			{ stdout, stderr: "", code: 0, killed: false },
		);

		const result = await orchestrator.run({
			promptPath: "/package/prompts/subagent-worker.md",
			task: "Produce a large report",
			cwd: "/projects/example",
		});

		expect(result.details.truncated).toBe(true);
		expect(result.content[0]?.type === "text" && result.content[0].text).toContain(
			"[Subagent output truncated:",
		);
	});
});
