import type { AgentMemoryData } from "./types.ts";

/**
 * Formats raw memory data for human-readable previews in selection UIs.
 */
const PREVIEW_FIELD_ORDER = [
	"sessionType",
	"title",
	"description",
	"tags",
	"context",
	"cwd",
	"sessionId",
] as const;

export function formatMemoryPreview(data: AgentMemoryData): string {
	const orderedEntries = orderPreviewEntries(data);
	const fields = orderedEntries
		.map(([key, value]) => formatPreviewField(key, value))
		.filter((field): field is string => field !== null);

	if (fields.length > 0) return fields.join("\n\n");

	return "(empty memory)";
}

function orderPreviewEntries(data: AgentMemoryData): [string, unknown][] {
	const entries = Object.entries(data);
	const entryByKey = new Map(entries);
	const ordered: [string, unknown][] = [];

	for (const key of PREVIEW_FIELD_ORDER) {
		if (entryByKey.has(key)) {
			ordered.push([key, entryByKey.get(key)]);
			entryByKey.delete(key);
		}
	}

	return [...ordered, ...entryByKey.entries()];
}

function formatPreviewField(key: string, value: unknown): string | null {
	if (typeof value === "string") {
		if (value.length === 0) return null;
		return `${key}:\n${value}`;
	}

	if (value === null || value === undefined) return null;

	return `${key}:\n${JSON.stringify(value, null, 2)}`;
}
