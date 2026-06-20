import { describe, expect, test } from "bun:test";
import { buildPlanInfo, renderPlanPrompt, stripFrontmatter } from "../../src/plan-mode/prompt.ts";

describe("stripFrontmatter", () => {
	test("removes a leading frontmatter block", () => {
		const input = "---\ntitle: x\n---\nBody text";
		expect(stripFrontmatter(input)).toBe("Body text");
	});

	test("handles CRLF line endings", () => {
		const input = "---\r\ntitle: x\r\n---\r\nBody text";
		expect(stripFrontmatter(input)).toBe("Body text");
	});

	test("leaves content without frontmatter untouched", () => {
		expect(stripFrontmatter("Just body")).toBe("Just body");
	});
});

describe("renderPlanPrompt", () => {
	test("strips frontmatter and substitutes all placeholders", () => {
		const template = "---\nx: y\n---\nInfo: ${planInfo}\nTask: $@ and again $@";
		const output = renderPlanPrompt(template, { planInfo: "PI", task: "  do it  " });

		expect(output).toBe("Info: PI\nTask: do it and again do it");
	});
});

describe("buildPlanInfo", () => {
	test("interpolates the read-only tool list", () => {
		const output = buildPlanInfo(["read", "grep"]);
		expect(output).toContain("Available read-only tools: read, grep.");
		expect(output).toContain("plan_exit");
	});
});
