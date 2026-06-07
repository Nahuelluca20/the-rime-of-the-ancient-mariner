# Changelog

## [0.1.1] - 2026-06-07

- update root for creation of database
- lifecycle discover prompts and skills only in local dev mode  

## [0.1.0] - 2026-06-03

Initial development snapshot covering work from 2026-05-18 to 2026-06-03.

### Added

- Initial pi package structure with TypeScript, Bun, Biome, Husky, and lint-staged setup.
- Local SQLite persistence using `better-sqlite3`, Drizzle ORM, Drizzle migrations, and DB scripts.
- `projects` and `agent_memories` tables for project-scoped JSON memories.
- Memory domain layer with lazy cached store initialization, project creation, memory creation, updates, reads, listing, recent-memory queries, and batch retrieval.
- Session metadata support via `get_current_session` tool and `/session-info` command.
- Memory/session commands including `/save-info` and `/update-info`.
- Memory tools: `get_memory`, `list_memories`, `save_session_summary`, and `insert_memories`.
- `save-summary` skill and prompt for persisting durable session summaries.
- Typed session summaries with `sessionType` and `tags`; supported types are `implementation`, `code-exploration`, `implementation-exploration`, `code-understanding`, and `mixed`.
- Native read-only plan mode with `/plan-mode`, `--plan`, `plan_exit`, read-only tool enforcement, unsafe bash blocking, status/widget UI, and session-state restoration.
- Read-only exploration and understanding prompts: `explore-codebase`, `explore-implementation`, and `understand-code`.
- Memory context injection that formats selected memories into a single steer message.
- `/recent-memories` picker with paginated selection, insertion into LLM context, preview mode, scrollable previews, session-type badges, and Vim-style navigation keys.

### Changed

- Replaced the early Effect-TS extension example with plain async/await plus TypeBox schemas.
- Split implementation into a compiled `src/` domain layer and thin runtime-loaded `extensions/`.
- Moved DB code from `db/` into `src/db/` and memory schema/types/store into `src/memory/`.
- Updated extension imports to use `.ts` runtime imports for pi-loaded extension files.
- Refined plan mode after design review by documenting bash-safety limitations, tightening tool restoration, and simplifying `plan_exit` details.
- Aligned `prompts/plan.md` with native plan mode: plans stay in chat while write tools are blocked.
- Refactored memory retrieval to batch through `store.getMemories`.
- Changed inserted memory context from one message per memory to one formatted `memories` message.
- Expanded context rendering to include `sessionType`, `tags`, `cwd`, `title`, `description`, and `context` when present.
- Updated memory previews to use a human-readable field order for typed summaries.
- Evolved `/recent-memories` from a basic table into an interactive picker with pagination, selection, preview, and keyboard navigation.
- Made `save-summary` adaptive by classifying session type before writing the summary.

### Fixed

- Wrapped `insert_memories` parameters in `Type.Object` so tool schemas are object-shaped for provider compatibility.
- Made Husky `prepare` tolerant with `husky || true`.

### Documentation

- Added project README covering features, usage, architecture, persistence, plan mode, recent memories, prompts, skills, and development workflow.
- Added local development/testing documentation for the `.pi/extensions/index.ts` harness.
- Updated agent guidance in `AGENTS.md` and `CLAUDE.md` as the architecture moved from examples to the memory/domain-layer design.
- Documented the recent memory picker, preview mode, inserted context format, keyboard shortcuts, and session-type badges.
