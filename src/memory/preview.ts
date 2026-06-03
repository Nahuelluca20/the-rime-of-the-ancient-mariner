import type { AgentMemoryData } from "./types.ts";

/**
 * Formats raw memory data for human-readable previews in selection UIs.
 */
export function formatMemoryPreview(data: AgentMemoryData): string {
	const fields = Object.entries(data)
		.map(([key, value]) => formatPreviewField(key, value))
		.filter((field): field is string => field !== null);

	if (fields.length > 0) return fields.join("\n\n");

	return "(empty memory)";
}

function formatPreviewField(key: string, value: unknown): string | null {
	if (typeof value === "string") {
		if (value.length === 0) return null;
		return `${key}:\n${value}`;
	}

	if (value === null || value === undefined) return null;

	return `${key}:\n${JSON.stringify(value, null, 2)}`;
}
