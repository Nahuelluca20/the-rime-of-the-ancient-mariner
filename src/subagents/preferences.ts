import { eq } from "drizzle-orm";
import { openDb } from "../db/connection.ts";
import { subagentPreferences } from "./schema.ts";

/** Stores the user's global choice for subagent tool availability. */
export interface SubagentsPreference {
	/** Returns false until the user has made and saved a choice. */
	isEnabled(): boolean;

	/** Saves the choice, replacing any previous value. */
	setEnabled(enabled: boolean): void;
}

export function openSubagentsPreference(path?: string): SubagentsPreference {
	const db = openDb(path);

	return {
		isEnabled() {
			return (
				db
					.select({ enabled: subagentPreferences.enabled })
					.from(subagentPreferences)
					.where(eq(subagentPreferences.id, 1))
					.get()?.enabled ?? false
			);
		},

		setEnabled(enabled) {
			db.insert(subagentPreferences)
				.values({ id: 1, enabled })
				.onConflictDoUpdate({
					target: subagentPreferences.id,
					set: { enabled, updatedAt: new Date() },
				})
				.run();
		},
	};
}
