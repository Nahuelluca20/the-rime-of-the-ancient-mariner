import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const MEMORY_DB_FILE_NAME = "rime-ancient-mariner.db";
export const MEMORY_DB_DIR_NAME = "the-ancient-mariner";
export const MEMORY_DB_PATH_ENV = "THE_ANCIENT_MARINER_DB_PATH";

function expandTilde(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path;
}

export function getPiAgentDir(): string {
	const agentDir = process.env.PI_CODING_AGENT_DIR;
	return agentDir ? resolve(expandTilde(agentDir)) : join(homedir(), ".pi", "agent");
}

export function getDefaultMemoryDbPath(): string {
	const override = process.env[MEMORY_DB_PATH_ENV];
	if (override) return resolve(expandTilde(override));
	return join(getPiAgentDir(), MEMORY_DB_DIR_NAME, MEMORY_DB_FILE_NAME);
}

export function getMemoryDbDir(path = getDefaultMemoryDbPath()): string {
	return dirname(path);
}
