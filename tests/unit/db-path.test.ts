import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	MEMORY_DB_DIR_NAME,
	MEMORY_DB_FILE_NAME,
	MEMORY_DB_PATH_ENV,
	getDefaultMemoryDbPath,
	getMemoryDbDir,
	getPiAgentDir,
} from "../../src/db/path.ts";

const ENV_KEYS = [MEMORY_DB_PATH_ENV, "PI_CODING_AGENT_DIR"] as const;

describe("db/path", () => {
	const saved: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const key of ENV_KEYS) {
			saved[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of ENV_KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	});

	test("getPiAgentDir defaults to ~/.pi/agent", () => {
		expect(getPiAgentDir()).toBe(join(homedir(), ".pi", "agent"));
	});

	test("getPiAgentDir honors PI_CODING_AGENT_DIR with tilde expansion", () => {
		process.env.PI_CODING_AGENT_DIR = "~/custom-agent";
		expect(getPiAgentDir()).toBe(join(homedir(), "custom-agent"));
	});

	test("getDefaultMemoryDbPath builds the default path", () => {
		expect(getDefaultMemoryDbPath()).toBe(
			join(homedir(), ".pi", "agent", MEMORY_DB_DIR_NAME, MEMORY_DB_FILE_NAME),
		);
	});

	test("getDefaultMemoryDbPath honors the override env with tilde expansion", () => {
		process.env[MEMORY_DB_PATH_ENV] = "~/db/custom.db";
		expect(getDefaultMemoryDbPath()).toBe(join(homedir(), "db", "custom.db"));
	});

	test("getMemoryDbDir returns the directory of the path", () => {
		expect(getMemoryDbDir("/a/b/c.db")).toBe("/a/b");
	});
});
