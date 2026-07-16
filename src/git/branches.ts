import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Git exports repository-local variables while running hooks. Those variables
// take precedence over cwd and would make a command inspect the hook's repository
// instead of the project directory requested by the caller.
const LOCAL_GIT_ENVIRONMENT_VARIABLES = [
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

/** A local Git branch, ordered by the timestamp of its latest commit. */
export interface GitBranch {
	name: string;
	isCurrent: boolean;
	lastCommitAt: Date;
}

/** Operations for reading branches from a project Git repository. */
export interface GitBranchCatalog {
	/**
	 * List local branches in descending latest-commit order for a project directory.
	 *
	 * A directory that Git cannot inspect has no branches for this feature, so it
	 * returns the same empty list as a repository with no commits.
	 */
	listRecent(cwd: string): Promise<GitBranch[]>;
}

/**
 * Create a catalog of branches for Git projects.
 *
 * Git invocation, local-ref filtering, sorting, parsing, and failures remain
 * private to this module as new branch browsing operations are added.
 */
export function createGitBranchCatalog(): GitBranchCatalog {
	return {
		async listRecent(cwd) {
			try {
				const { stdout } = await execFileAsync(
					"git",
					[
						"for-each-ref",
						"--format=%(HEAD)%00%(refname:short)%00%(committerdate:iso-strict)",
						"--sort=-committerdate",
						"refs/heads",
					],
					{
						cwd,
						encoding: "utf8",
						env: environmentWithoutGitRepository(),
						maxBuffer: 1024 * 1024,
					},
				);
				return parseLocalBranches(stdout);
			} catch {
				return [];
			}
		},
	};
}

function environmentWithoutGitRepository(): NodeJS.ProcessEnv {
	const environment = { ...process.env };
	for (const variable of LOCAL_GIT_ENVIRONMENT_VARIABLES) {
		delete environment[variable];
	}
	return environment;
}

function parseLocalBranches(output: string): GitBranch[] {
	return output
		.split("\n")
		.filter(Boolean)
		.flatMap((line) => {
			const [head, name, timestamp] = line.split("\0");
			if (!name || !timestamp) return [];

			const lastCommitAt = new Date(timestamp);
			if (Number.isNaN(lastCommitAt.getTime())) return [];

			return [{ name, isCurrent: head === "*", lastCommitAt }];
		});
}
