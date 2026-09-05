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
	test("strips frontmatter and substitutes all plan-info placeholders", () => {
		const template = "---\nx: y\n---\nInfo: ${planInfo}\nAgain: ${planInfo}\nTask: $@";
		const output = renderPlanPrompt(template, { planInfo: "PI" });

		expect(output).toBe("Info: PI\nAgain: PI\nTask: $@");
	});
});

describe("buildPlanInfo", () => {
	test("describes enforcement and plan exit without listing tools", () => {
		const output = buildPlanInfo();
		expect(output).toContain("Native enforcement blocks");
		expect(output).toContain("plan_exit");
		expect(output).not.toContain("Available read-only tools");
	});
});
