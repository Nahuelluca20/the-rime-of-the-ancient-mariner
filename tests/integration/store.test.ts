import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { MEMORY_DB_PATH_ENV } from "../../src/db/path.ts";
import type { MemoryCatalog } from "../../src/memory/catalog.ts";
import type { MemoryRepository } from "../../src/memory/repository.ts";

// Bun's test runner cannot load better-sqlite3 (a native module), so the DB
// integration suite runs under Node instead. We point the DB at a fresh temp
// file via the env override and open a single repository for the whole file.
// Tests isolate via unique project/memory names.
let tempDir: string;
let repository: MemoryRepository;
let catalog: MemoryCatalog;

before(async () => {
	tempDir = mkdtempSync(join(tmpdir(), "ancient-mariner-test-"));
	process.env[MEMORY_DB_PATH_ENV] = join(tempDir, "test.db");
	// Imported after the env override is set so the first repository opens our temp DB.
	const { createMemoryCatalog } = await import("../../src/memory/catalog.ts");
	const { openMemoryRepository } = await import("../../src/memory/repository.ts");
	repository = openMemoryRepository();
	catalog = createMemoryCatalog(repository);
});

after(() => {
	rmSync(tempDir, { recursive: true, force: true });
	delete process.env[MEMORY_DB_PATH_ENV];
});

describe("MemoryRepository", () => {
	test("findProject reads and ensureProject creates project rows", () => {
		assert.equal(repository.findProject("proj-a"), null);

		const created = repository.ensureProject("proj-a");
		const fetched = repository.findProject("proj-a");
		assert.equal(created.name, "proj-a");
		assert.equal(fetched?.id, created.id);
	});

	test("createMemory reports created then conflict", () => {
		const first = repository.createMemory("proj-a", "mem-1", { description: "one" });
		assert.equal(first.created, true);

		const second = repository.createMemory("proj-a", "mem-1", { description: "two" });
		assert.equal(second.created, false);
		// conflict returns the existing row, not the new data
		assert.equal(second.memory.data.description, "one");
	});

	test("updateMemory reports updated true/false", () => {
		repository.createMemory("proj-a", "mem-2", { description: "before" });
		const updated = repository.updateMemory("proj-a", "mem-2", { description: "after" });
		assert.equal(updated.updated, true);
		assert.equal(updated.memory?.data.description, "after");

		const missing = repository.updateMemory("proj-a", "does-not-exist", { x: 1 });
		assert.equal(missing.updated, false);
		assert.equal(missing.memory, null);

		const missingProject = repository.updateMemory("ghost-update-project", "does-not-exist", {
			x: 1,
		});
		assert.equal(missingProject.updated, false);
		assert.equal(repository.findProject("ghost-update-project"), null);
	});

	test("getMemory returns the row or null", () => {
		repository.createMemory("proj-a", "mem-3", { title: "T" });
		assert.equal(repository.findMemory("proj-a", "mem-3")?.data.title, "T");
		assert.equal(repository.findMemory("proj-a", "nope"), null);
		assert.equal(repository.findMemory("ghost-get-project", "nope"), null);
		assert.equal(repository.findProject("ghost-get-project"), null);
	});

	test("getMemories preserves order, skips misses, does not create projects", () => {
		repository.createMemory("proj-b", "x", { v: 1 });
		repository.createMemory("proj-b", "y", { v: 2 });

		const found = repository.findMemories([
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
		assert.deepEqual(repository.listMemories("ghost-project"), []);
		assert.equal(repository.findProject("ghost-project"), null);
	});

	test("listMemories is scoped to the project", () => {
		const names = repository.listMemories("proj-b").map((m) => m.name);
		assert.deepEqual(names.sort(), ["x", "y"]);
	});

	test("listRecentMemories derives preview fields", () => {
		repository.createMemory("proj-c", "recent", {
			sessionType: "implementation",
			description: "recent desc",
		});

		const recent = catalog.listRecentMemories(50, 0);
		const row = recent.find((r) => r.projectName === "proj-c" && r.name === "recent");
		assert.ok(row);
		assert.equal(row?.description, "recent desc");
		assert.equal(row?.sessionType, "implementation");
		assert.ok(row?.preview.includes("recent desc"));
	});

	test("countMemories reflects inserts", () => {
		const before = repository.countMemories();
		repository.createMemory("proj-count", "a", {});
		repository.createMemory("proj-count", "b", {});
		assert.equal(repository.countMemories(), before + 2);
	});
});
