import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { MEMORY_DB_PATH_ENV } from "../../src/db/path.ts";
import type { MemoryStore } from "../../src/memory/store.ts";

// Bun's test runner cannot load better-sqlite3 (a native module), so the DB
// integration suite runs under Node instead. openMemoryStore caches its store
// at module scope and ignores `path` after the first call, so we point the DB
// at a fresh temp file via the env override and open a single store for the
// whole file. Tests isolate via unique project/memory names.
let tempDir: string;
let store: MemoryStore;

before(async () => {
	tempDir = mkdtempSync(join(tmpdir(), "ancient-mariner-test-"));
	process.env[MEMORY_DB_PATH_ENV] = join(tempDir, "test.db");
	// Imported after the env override is set so the first store opens our temp DB.
	const { openMemoryStore } = await import("../../src/memory/store.ts");
	store = openMemoryStore();
});

after(() => {
	rmSync(tempDir, { recursive: true, force: true });
	delete process.env[MEMORY_DB_PATH_ENV];
});

describe("openMemoryStore", () => {
	test("getOrCreateProject creates then returns the same row", () => {
		const created = store.getOrCreateProject("proj-a");
		const fetched = store.getOrCreateProject("proj-a");
		assert.equal(created.name, "proj-a");
		assert.equal(fetched.id, created.id);
	});

	test("createMemory reports created then conflict", () => {
		const first = store.createMemory("proj-a", "mem-1", { description: "one" });
		assert.equal(first.created, true);

		const second = store.createMemory("proj-a", "mem-1", { description: "two" });
		assert.equal(second.created, false);
		// conflict returns the existing row, not the new data
		assert.equal(second.memory.data.description, "one");
	});

	test("updateMemory reports updated true/false", () => {
		store.createMemory("proj-a", "mem-2", { description: "before" });
		const updated = store.updateMemory("proj-a", "mem-2", { description: "after" });
		assert.equal(updated.updated, true);
		assert.equal(updated.memory?.data.description, "after");

		const missing = store.updateMemory("proj-a", "does-not-exist", { x: 1 });
		assert.equal(missing.updated, false);
		assert.equal(missing.memory, null);
	});

	test("getMemory returns the row or null", () => {
		store.createMemory("proj-a", "mem-3", { title: "T" });
		assert.equal(store.getMemory("proj-a", "mem-3")?.data.title, "T");
		assert.equal(store.getMemory("proj-a", "nope"), null);
	});

	test("getMemories preserves order, skips misses, does not create projects", () => {
		store.createMemory("proj-b", "x", { v: 1 });
		store.createMemory("proj-b", "y", { v: 2 });

		const found = store.getMemories([
			{ projectName: "proj-b", name: "y" },
			{ projectName: "proj-b", name: "missing" },
			{ projectName: "proj-b", name: "x" },
			{ projectName: "ghost-project", name: "z" },
		]);

		assert.deepEqual(
			found.map((m) => m.name),
			["y", "x"],
		);
		// read-only: must not have created the non-existent project
		assert.deepEqual(store.listMemories("ghost-project"), []);
	});

	test("listMemories is scoped to the project", () => {
		const names = store.listMemories("proj-b").map((m) => m.name);
		assert.deepEqual(names.sort(), ["x", "y"]);
	});

	test("listRecentMemories derives preview fields", () => {
		store.createMemory("proj-c", "recent", {
			sessionType: "implementation",
			description: "recent desc",
		});

		const recent = store.listRecentMemories(50, 0);
		const row = recent.find((r) => r.projectName === "proj-c" && r.name === "recent");
		assert.ok(row);
		assert.equal(row?.description, "recent desc");
		assert.equal(row?.sessionType, "implementation");
		assert.ok(row?.preview.includes("recent desc"));
	});

	test("countMemories reflects inserts", () => {
		const before = store.countMemories();
		store.createMemory("proj-count", "a", {});
		store.createMemory("proj-count", "b", {});
		assert.equal(store.countMemories(), before + 2);
	});
});
