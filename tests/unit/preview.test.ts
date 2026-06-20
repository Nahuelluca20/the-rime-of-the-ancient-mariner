import { describe, expect, test } from "bun:test";
import { formatMemoryPreview } from "../../src/memory/preview.ts";

describe("formatMemoryPreview", () => {
	test("renders known fields in PREVIEW_FIELD_ORDER with extras appended", () => {
		const output = formatMemoryPreview({
			extra: "last",
			description: "a desc",
			sessionType: "implementation",
		});

		const sessionTypeIdx = output.indexOf("sessionType:");
		const descriptionIdx = output.indexOf("description:");
		const extraIdx = output.indexOf("extra:");

		expect(sessionTypeIdx).toBeGreaterThanOrEqual(0);
		expect(sessionTypeIdx).toBeLessThan(descriptionIdx);
		expect(descriptionIdx).toBeLessThan(extraIdx);
	});

	test("skips empty strings and null/undefined values", () => {
		const output = formatMemoryPreview({
			title: "",
			description: null,
			context: undefined,
			cwd: "/repo",
		});

		expect(output).toBe("cwd:\n/repo");
	});

	test("renders objects and arrays as pretty JSON", () => {
		const output = formatMemoryPreview({ tags: ["a", "b"] });
		expect(output).toBe(`tags:\n${JSON.stringify(["a", "b"], null, 2)}`);
	});

	test("returns placeholder for an empty memory", () => {
		expect(formatMemoryPreview({})).toBe("(empty memory)");
		expect(formatMemoryPreview({ title: "", description: null })).toBe("(empty memory)");
	});
});
