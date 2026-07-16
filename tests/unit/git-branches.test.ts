import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitBranchCatalog } from "../../src/git/branches.ts";

const branchCatalog = createGitBranchCatalog();
const temporaryDirectory = process.platform === "win32" ? tmpdir() : "/tmp";
const temporaryDirectories: string[] = [];
const localGitEnvironmentVariables = [
	"GIT_ALTERNATE_OBJECT_DIRECTORIES",
	"GIT_CONFIG",
	"GIT_CONFIG_PARAMETERS",
	"GIT_CONFIG_COUNT",
	"GIT_OBJECT_DIRECTORY",
	"GIT_DIR",
	"GIT_WORK_TREE",
	"GIT_IMPLICIT_WORK_TREE",
	"GIT_GRAFT_FILE",
	"GIT_INDEX_FILE",
	"GIT_NO_REPLACE_OBJECTS",
	"GIT_REPLACE_REF_BASE",
	"GIT_PREFIX",
	"GIT_SHALLOW_FILE",
	"GIT_COMMON_DIR",
] as const;

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { force: true, recursive: true });
	}
});

function createRepository(): string {
	const directory = mkdtempSync(join(temporaryDirectory, "ancient-mariner-git-"));
	temporaryDirectories.push(directory);
	git(directory, ["init", "--initial-branch=main"]);
	git(directory, ["config", "user.name", "Test User"]);
	git(directory, ["config", "user.email", "test@example.com"]);
	return directory;
}

function commit(directory: string, message: string, timestamp: string): void {
	writeFileSync(join(directory, `${message}.txt`), message, "utf8");
	git(directory, ["add", "."]);
	git(directory, ["commit", "-m", message], {
		GIT_AUTHOR_DATE: timestamp,
		GIT_COMMITTER_DATE: timestamp,
	});
}

function git(directory: string, args: string[], environment: NodeJS.ProcessEnv = {}): void {
	const childEnvironment = { ...process.env, ...environment };
	for (const variable of localGitEnvironmentVariables) {
		delete childEnvironment[variable];
	}

	execFileSync("git", args, {
		cwd: directory,
		encoding: "utf8",
		env: childEnvironment,
	});
}

describe("createGitBranchCatalog", () => {
	test("lists only local branches newest first and marks the current branch", async () => {
		const directory = createRepository();
		commit(directory, "initial", "2024-01-01T00:00:00Z");
		git(directory, ["checkout", "-b", "older"]);
		commit(directory, "older", "2024-01-02T00:00:00Z");
		git(directory, ["checkout", "main"]);
		git(directory, ["checkout", "-b", "newer"]);
		commit(directory, "newer", "2024-01-03T00:00:00Z");
		git(directory, ["checkout", "main"]);
		commit(directory, "main", "2024-01-04T00:00:00Z");

		const result = await branchCatalog.listRecent(directory);

		expect(result).toEqual([
			{ name: "main", isCurrent: true, lastCommitAt: new Date("2024-01-04T00:00:00Z") },
			{ name: "newer", isCurrent: false, lastCommitAt: new Date("2024-01-03T00:00:00Z") },
			{ name: "older", isCurrent: false, lastCommitAt: new Date("2024-01-02T00:00:00Z") },
		]);
	});

	test("returns an empty list outside a Git repository", async () => {
		const directory = mkdtempSync(join(temporaryDirectory, "ancient-mariner-not-git-"));
		temporaryDirectories.push(directory);

		await expect(branchCatalog.listRecent(directory)).resolves.toEqual([]);
	});

	test("returns an empty list for a repository with no commits", async () => {
		const directory = createRepository();

		await expect(branchCatalog.listRecent(directory)).resolves.toEqual([]);
	});
});
