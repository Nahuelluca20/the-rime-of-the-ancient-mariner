import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { openSubagentsPreference } from "../../src/subagents/preferences.ts";

const directories: string[] = [];

function temporaryDatabasePath(): string {
	const directory = mkdtempSync(join(tmpdir(), "ancient-mariner-subagents-"));
	directories.push(directory);
	return join(directory, "preferences.db");
}

afterEach(() => {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("SubagentsPreference", () => {
	test("defaults to disabled until a preference is saved", () => {
		const preference = openSubagentsPreference(temporaryDatabasePath());

		assert.equal(preference.isEnabled(), false);
	});

	test("persists and replaces the singleton choice", () => {
		const path = temporaryDatabasePath();
		const preference = openSubagentsPreference(path);

		preference.setEnabled(true);
		assert.equal(openSubagentsPreference(path).isEnabled(), true);

		preference.setEnabled(false);
		assert.equal(openSubagentsPreference(path).isEnabled(), false);
	});
});
