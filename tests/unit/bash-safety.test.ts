import { describe, expect, test } from "bun:test";
import { isReadOnlyBashCommand } from "../../src/plan-mode/bash-safety.ts";

describe("isReadOnlyBashCommand", () => {
	test("rejects empty and whitespace-only commands", () => {
		expect(isReadOnlyBashCommand("")).toBe(false);
		expect(isReadOnlyBashCommand("   ")).toBe(false);
		expect(isReadOnlyBashCommand("\n\t")).toBe(false);
	});

	test("allows allow-listed read-only commands", () => {
		expect(isReadOnlyBashCommand("cat file.txt")).toBe(true);
		expect(isReadOnlyBashCommand("ls -la")).toBe(true);
		expect(isReadOnlyBashCommand("git status")).toBe(true);
		expect(isReadOnlyBashCommand("git log --oneline")).toBe(true);
		expect(isReadOnlyBashCommand("rg pattern")).toBe(true);
		expect(isReadOnlyBashCommand("npm ls")).toBe(true);
		expect(isReadOnlyBashCommand("  grep foo bar.txt  ")).toBe(true);
	});

	test("rejects destructive commands", () => {
		expect(isReadOnlyBashCommand("rm -rf /tmp/x")).toBe(false);
		expect(isReadOnlyBashCommand("git commit -m 'x'")).toBe(false);
		expect(isReadOnlyBashCommand("echo hi > file.txt")).toBe(false);
		expect(isReadOnlyBashCommand("cat x | sh")).toBe(false);
		expect(isReadOnlyBashCommand("sudo ls")).toBe(false);
		expect(isReadOnlyBashCommand("npm install")).toBe(false);
	});

	test("fails closed for commands not on the allow-list", () => {
		expect(isReadOnlyBashCommand("frobnicate --all")).toBe(false);
	});

	test("conservatively rejects safe commands that mention a destructive word", () => {
		// Documented contract: a destructive substring anywhere rejects the line.
		expect(isReadOnlyBashCommand('grep "git commit" file')).toBe(false);
	});
});
