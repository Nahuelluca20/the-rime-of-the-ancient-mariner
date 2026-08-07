# the-rime-of-the-ancient-mariner

> A [pi](https://pi.dev) package for knowledge tracking and agent memory — persistent session storage, read-only plan mode, and summarization tools for the pi coding agent.

---

## Overview

`the-rime-of-the-ancient-mariner` extends the pi coding agent with persistent, project-scoped memory backed by SQLite. It tracks session metadata, stores agent memories as JSON documents, enforces a native read-only plan mode, and provides tools for summarization and search. Built as a pi package, all extensions, prompts, and skills load directly at runtime.

## Features

| Feature | Description |
|---------|-------------|
| **Agent Memory Store** | Persist project-scoped key-value memories with JSON data via SQLite + Drizzle ORM |
| **Session Tracking** | Save and update session metadata with `update-info` command |
| **Typed Session Summaries** | Distill a session into `{title, description, context, sessionType, tags}` and merge into persistent memory |
| **Recent Memory Picker** | Browse newest memories with visible session-type badges, preview contents with `Tab`, and insert selected memories into the LLM context |
| **Plan Mode** | Collaborative read-only planning through System Architecture, Program Design, and reviewable Vertical Slices |
| **Subagents** | Discover prompt-based subagents and run them in isolated pi processes |
| **Session Info** | Inspect session metadata (ID, file, name, CWD, entry count, leaf) |
| **Prompts & Skills** | Planning, isolated codebase research, exploration, understanding, and typed summary prompts; `save-summary` skill |

## Installation

```bash
# Install as a pi package
pi install the-ancient-mariner

# Or clone and link locally
git clone <repo-url>
cd the-rime-of-the-ancient-mariner
bun install
bun run build
```

The package declares its extensions, skills, prompts, and themes in `package.json` under the `"pi"` key. pi auto-discovers and loads them.

## Usage

Once installed, pi loads all extensions, skills, and prompts automatically. The following tools, commands, and skills become available:

### Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_memory` | Retrieve a specific memory by name | `project: string`, `name: string` |
| `list_memories` | List all stored memories for a project | `project: string` |
| `save_session_summary` | Persist a typed session summary into the session's memory row | `title: string`, `description: string`, `context: string`, optional `sessionType`, `tags` |
| `insert_memories` | Insert selected memories into the current LLM context | `memories: { projectName, memoryName }[]` |
| `get_current_session` | Return current pi session metadata | _(none)_ |
| `count_lines` | Count lines in a file | `path: string` |
| `list_available_subagents` | List loaded `subagent-*` prompt templates and their authoritative paths | _(none)_ |
| `subagent_execute` | Run a discovered prompt in an isolated pi process with full coding tools | `promptPath: string`, `task: string` |

`subagent_execute` accepts only paths returned by `list_available_subagents`. Its child process has the full built-in coding tool set (`read`, `bash`, `edit`, `write`, `grep`, `find`, and `ls`), so selected prompts can modify files and execute shell commands. It is intentionally unavailable while native plan mode is active. Cancelling the parent tool terminates the child process; failed children report their exit code and prefer `stderr` diagnostics, falling back to `stdout` when needed.

Supported `sessionType` values are `implementation`, `code-exploration`, `implementation-exploration`, `code-understanding`, and `mixed`.

### Commands

| Command | Description |
|---------|-------------|
| `/update-info` | Update the current session's stored memory in place |
| `/recent-memories` | Open a paged picker for recent memories and send selected memories to the LLM |
| `/session-info` | Print current session metadata (ID, file, name, CWD, entries) |
| `/plan-mode [on\|off\|toggle\|status]` | Toggle native read-only plan mode |
| `Shift+Tab` | Toggle native read-only plan mode, if `Shift+Tab` is not already bound to a built-in pi action |
| `--plan` (flag) | Start pi with plan mode enabled from the start |

### Recent Memories

Use `/recent-memories` to open an overlay dialog showing the newest stored memories, five per page. The dialog displays each memory's project, name, session-type badge, description, and last update date. Press `Tab` on a focused memory to open a larger preview of its stored data; long previews remain scrollable with the arrow keys.

Keyboard shortcuts in the table:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move through memories on the current page |
| `Tab` | Open preview for the focused memory |
| `Space` | Select or unselect the focused memory |
| `←` / `→` | Move between pages |
| `Enter` | Insert selected memories into the LLM context |
| `Esc` | Cancel |

Keyboard shortcuts in preview mode:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Scroll the preview text |
| `Space` | Select or unselect the previewed memory |
| `Enter` | Insert selected memories into the LLM context |
| `Tab` / `Esc` | Return to the table |

Submitted memories are formatted with the same context renderer used by the `insert_memories` tool and sent as a `memories` custom message. Inserted context includes `sessionType`, `tags`, `cwd`, `title`, `description`, and `context` when present. Preview text is formatted separately for human-readable browsing and does not change what gets inserted into the LLM context.

### Plan Mode

Plan mode is a native read-only mode that blocks all filesystem writes, code edits, config changes, and unsafe bash commands. Its prompt guides the human and agent through System Architecture, Program Design, and end-to-end Vertical Slices, with explicit alignment checkpoints between phases. The final plan requires implementation to stop after every slice for human review. The agent can only use read-only tools (`read`, `grep`, `find`, `ls`, safe `bash` commands, etc.) and must call `plan_exit` to request user approval before leaving.

The extension registers `Shift+Tab` as a shortcut for toggling plan mode. In default pi, `Shift+Tab` is already bound to `app.thinking.cycle`, so users who want the plan-mode shortcut must remap that built-in action in `~/.pi/agent/keybindings.json` to avoid a collision:

```json
{
	"app.clipboard.pasteImage": "ctrl+v",
	"app.thinking.toggle": "ctrl+r",
	"app.thinking.cycle": "ctrl+t"
}
```

After editing the file, run `/reload` in pi. With the example above, `Shift+Tab` toggles plan mode, `Ctrl+T` cycles thinking level, `Ctrl+R` hides/shows thinking blocks, and `Ctrl+V` keeps the default paste-image behavior on macOS.

**Blocked operations in plan mode:**
- All file writes (`edit`, `write`)
- Destructive bash (`rm`, `mv`, `mkdir`, `git commit`, `npm install`, etc.)
- Package managers, editors, system control commands

**Allowed operations in plan mode:**
- `read`, `grep`, `find`, `ls`, `bash` (read-only subset), `question` / `questionnaire` when available, `plan_exit`
- Safe bash: `cat`, `head`, `tail`, `grep`, `find`, `ls`, `git status/log/diff`, `curl`, `jq`, `rg`, `fd`, etc.

### Skills

| Skill | Description |
|-------|-------------|
| `save-summary` | Triggered via `/save-summary` — classifies the session type, distills title/description/context/tags, and persists via `save_session_summary` |

### Prompts

| Prompt | Description |
|--------|-------------|
| `plan.md` | Collaborative planning through System Architecture, Program Design, and reviewable Vertical Slices |
| `subagent-codebase-search.md` | Isolated read-only research handoff with optional architecture, program-design, and focused code excerpts |
| `explore-codebase.md` | Read-only `code-exploration` workflow for codebase orientation |
| `explore-implementation.md` | Read-only `implementation-exploration` workflow for comparing approaches before coding |
| `understand-code.md` | Read-only `code-understanding` workflow for explaining existing modules, flows, APIs, or behavior |
| `save-summary.md` | Guides the agent to classify and persist a typed session summary |

## Architecture

The repo has two distinct execution surfaces:

```
the-rime-of-the-ancient-mariner/
├── src/                    # Domain layer (compiled by tsc → dist/)
│   ├── memory/             # Knowledge store: schema, repository, catalog, previews
│   │   ├── schema.ts       # Drizzle schema (projects, agent_memories tables)
│   │   ├── types.ts        # Public type re-exports
│   │   ├── repository.ts   # MemoryRepository: persistence-only table access
│   │   ├── catalog.ts      # MemoryCatalog: recent-memory browsing projections
│   │   └── preview.ts      # Human-readable preview formatting for memory picker UI
│   ├── session/
│   │   ├── info.ts         # getSessionInfo(ctx) — session metadata extraction
│   │   └── memory.ts       # SessionMemory: current-session memory operations
│   ├── plan-mode/
│   │   ├── session.ts      # PlanModeSession: openPlanModeSession()
│   │   ├── prompt.ts       # Template rendering helpers
│   │   └── bash-safety.ts  # Read-only bash command validation
│   ├── subagents/
│   │   └── subagents-orchestrator.ts # Prompt discovery and full-tool subagent execution
│   ├── ui/
│   │   └── memories-table.ts # Recent memory picker dialog
│   └── db/
│       └── connection.ts   # openDb() — internal sqlite + Drizzle + auto-migration
├── extensions/             # pi extensions (runtime-loaded, NOT compiled)
│   ├── lifecycle.ts        # session_start + resources_discover events
│   ├── memory-extension.ts # Memory tools + update-info command
│   ├── session-extension.ts# Session info tool + command
│   ├── sub-agents-extension.ts # Subagent discovery and execution tools
│   └── plan-mode.ts        # Plan mode tool, command, flag, and hooks
├── skills/                 # pi skills (Markdown)
│   └── save-summary.md
├── prompts/                # pi prompt templates (Markdown)
│   ├── plan.md
│   ├── subagent-codebase-search.md
│   ├── explore-codebase.md
│   ├── explore-implementation.md
│   ├── understand-code.md
│   └── save-summary.md
├── migrations/             # Drizzle-generated SQL migrations
└── dist/                   # Compiled output (gitignored, vestigial)
```

**Key principle:** Business logic lives in `src/` behind named interfaces. Extensions in `extensions/` register tools, commands, and event handlers with pi, delegating all logic to `src/`. Extensions import `.ts` files directly because pi loads them at runtime without `tsc`.

## Persistence

Data is stored in a global SQLite database (default: `~/.pi/agent/the-ancient-mariner/rime-ancient-mariner.db`) with auto-migration on first access.

### Schema

| Table | Columns | Notes |
|-------|---------|-------|
| `projects` | `id`, `name` (unique), `created_at` | One row per project directory |
| `agent_memories` | `id`, `name`, `project_id` (FK → projects), `created_at`, `updated_at`, `data` (JSON) | Memories are unique per (project, name); cascade-deletes with project |

### Memory APIs

```ts
const repository = openMemoryRepository(); // Auto-opens DB, runs migrations
const catalog = createMemoryCatalog(repository);

repository.createMemory("my-project", "session-001", { summary: "..." });
repository.updateMemory("my-project", "session-001", { summary: "updated" });
repository.findMemory("my-project", "session-001");
repository.listMemories("my-project");
catalog.listRecentMemories(5, 0); // newest first, paged, includes session type + preview text
repository.countMemories();
```

Reads do not create project rows; writes create project rows only when needed through `ensureProject()` inside the repository.

## Development

### Commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies |
| `bun run build` | Compile `src/` → `dist/` via `tsc` |
| `bun run lint` | Biome linter check |
| `bun run lint:fix` | Biome linter + auto-fix |
| `bun run format` | Biome formatter |
| `bun run db:generate` | Generate Drizzle migration from schema changes |
| `bun run db:studio` | Open Drizzle Studio against the global ancient-mariner DB |

### Local Testing

Create `.pi/extensions/index.ts` (gitignored) as a dev harness:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import lifeCycleExtension from "../../extensions/lifecycle.ts";
import memoryExtension from "../../extensions/memory-extension.ts";
import sessionExtension from "../../extensions/session-extension.ts";
import planModeExtension from "../../extensions/plan-mode.ts";
import subAgentsExtension from "../../extensions/sub-agents-extension.ts";

export default function (pi: ExtensionAPI) {
	sessionExtension(pi);
	memoryExtension(pi);
	lifeCycleExtension(pi, { discoverResources: true });
	subAgentsExtension(pi);
	planModeExtension(pi);
}
```

Then run pi with:

```bash
pi --extension .pi/extensions/index.ts
```

### Schema Change Workflow

1. Edit `src/memory/schema.ts`
2. Run `bun run db:generate`
3. Commit the new migration file alongside the schema change
4. The DB auto-migrates on next `openMemoryRepository()` call

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.8+ (ES2022, strict mode) |
| Runtime / Bundler | Bun |
| Package SDK | `@earendil-works/pi-coding-agent` |
| Validation / Schemas | [TypeBox](https://github.com/sinclairzx81/typebox) |
| Local DB | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (sync) |
| ORM / Migrations | [Drizzle ORM](https://orm.drizzle.team/) + drizzle-kit |
| Lint & Format | [Biome](https://biomejs.dev/) 1.9.4 |
| Git Hooks | Husky + lint-staged |

## License

ISC
