# AGENTS.md — the-ancient-mariner

> Guide for AI agents working with this pi package codebase.

---

## 1. Project Overview

`the-ancient-mariner` is a [pi](https://pi.dev) package — a plugin for the pi coding agent. It extends pi with custom tools, commands, event handlers, skills, prompts, and themes.

The MVP goal (`docs/mvp.md`) is **knowledge tracking**: detecting stale code, storing summaries, and enabling search/retrieval over agent memories. Persistence is local via SQLite + Drizzle.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.8+ (ES2022, strict mode) |
| Async | Plain `async`/`await` (no Effect-TS) |
| Validation / Schemas | [TypeBox](https://github.com/sinclairzx81/typebox) |
| Local DB | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (sync) |
| ORM / Migrations | [Drizzle ORM](https://orm.drizzle.team/) + drizzle-kit |
| Package Runtime | [pi-coding-agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) SDK |
| Bundler / Runtime | Bun |
| Lint & Format | [Biome](https://biomejs.dev/) 1.9.4 |
| Git Hooks | Husky + lint-staged |

---

## 3. Directory Layout

```
the-ancient-mariner/
├── src/                       # Domain layer (compiled by tsc)
│   ├── memory/
│   │   ├── schema.ts          # Drizzle schema (internal)
│   │   ├── types.ts           # Public type re-exports
│   │   ├── repository.ts      # MemoryRepository: persistence-only table access
│   │   └── catalog.ts         # MemoryCatalog: recent-memory browsing projections
│   ├── session/
│   │   ├── info.ts            # getSessionInfo(ctx) — single source for session metadata
│   │   └── memory.ts          # SessionMemory: current-session memory operations
│   ├── ui/
│   │   └── memory-browser.ts  # MemoryBrowserDialog: searchable memory library overlay
│   └── db/
│       └── connection.ts      # openDb() — internal; feature persistence modules import it
├── extensions/                # pi extensions (runtime-loaded; not compiled)
│   ├── lifecycle.ts           # session_start + optional local resources_discover
│   ├── memory-extension.ts        # tools backed by src/memory
│   └── session-extension.ts       # tool + command backed by src/session
├── migrations/                # Drizzle migrations (generated from src/memory/schema.ts)
├── skills/                    # pi skills (empty — add .md skill files here)
├── prompts/                   # pi prompt templates
├── themes/                    # pi themes
├── docs/
│   ├── mvp.md                 # MVP requirements
│   └── development.md         # Local testing setup
├── dist/                      # Compiled output (gitignored, vestigial — no consumer)
├── drizzle.config.ts          # Drizzle CLI config (schema path lives here)
├── package.json               # pi package manifest
├── tsconfig.json              # TypeScript config (NodeNext, ESM, declarations)
├── biome.json                 # Biome formatter + linter config
└── AGENTS.md                  # This file
```

**Rule of thumb:**
- **`src/`** holds domain logic behind named interfaces (`MemoryRepository`, `MemoryCatalog`, `SessionMemory`, `getSessionInfo`). Compiled by `tsc`. ESM + NodeNext → relative imports in compiled output need `.js` suffixes.
- **`extensions/`, `skills/`, `prompts/`, `themes/`** are consumed by pi **at runtime** via paths declared in `package.json["pi"]`. They are **not** built by `tsc`; pi loads `.ts` directly. That's why extensions can import `../src/**/*.ts` files directly.
- Extensions should stay thin: register tools/commands/events and delegate to `src/`.

---

## 4. Code Conventions

### 4.1 Formatting (Biome)

Configured in `biome.json`:
- **Indent**: Tabs
- **Quotes**: Double
- **Semicolons**: Always
- **Trailing commas**: All
- **Line width**: 100 characters

Run formatting / linting:
```bash
bun run lint      # check only
bun run lint:fix  # check + auto-fix
bun run format    # format only
```

### 4.2 Async patterns

Use plain `async`/`await`. Side effects (file I/O, DB queries via Drizzle, etc.) are awaited or executed synchronously (better-sqlite3 is sync). No Effect-TS, no platform layers.

```typescript
import { readFile } from "node:fs/promises";

async function countLines(path: string): Promise<number> {
	const content = await readFile(path, "utf8");
	return content.split("\n").length;
}
```

For shared resources (DB connection, repository handles), initialize lazily at first use and cache at module level.

### 4.3 TypeBox Schemas (Extensions)

When registering pi tools, define parameters with TypeBox:

```typescript
import { Type } from "typebox";

pi.registerTool({
	name: "my_tool",
	parameters: Type.Object({
		path: Type.String({ description: "File path" }),
		depth: Type.Optional(Type.Number({ default: 1 })),
	}),
	// ...
});
```

### 4.4 Extension Structure

Every extension file exports a default function receiving `ExtensionAPI`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	// register tools, commands, events — delegate logic to src/
}
```

Canonical examples in this repo:
- `extensions/memory-extension.ts` — tool registration
- `extensions/lifecycle.ts` — `session_start` + optional local-only `resources_discover`
- `extensions/session-extension.ts` — tool + command sharing logic via `src/session/info.ts`

---

## 5. Build & Development Workflow

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies |
| `bun run build` | Compile `src/` → `dist/` with declarations + source maps |
| `bun run lint` | Run Biome linter |
| `bun run lint:fix` | Run Biome linter + auto-fix |
| `bun run format` | Run Biome formatter |
| `bun run db:generate` | Emit a new Drizzle migration from `src/memory/schema.ts` |
| `bun run db:studio` | Open Drizzle Studio against the global ancient-mariner DB |

**Pre-commit:** Husky runs `lint-staged` on `*.{js,ts,json,md}` via `biome check --write --no-errors-on-unmatched`.

---

## 6. Persistence Layer

- **`src/memory/schema.ts`** — Drizzle schema (internal). Tables: `projects` (unique `name`) and `agent_memories` (JSON `data`, FK to `projects`, cascade delete). Exports `AgentMemoryData` and inferred row types.
- **`src/memory/types.ts`** — public type re-exports. Consumers import from here, not from `schema.ts`.
- **`src/memory/repository.ts`** — `MemoryRepository` owns persistence-only operations. Reads use `findProject()` and never create rows; writes use `ensureProject()` when a parent project row is needed.
- **`src/memory/catalog.ts`** — `MemoryCatalog` owns browsing projections such as recent-memory previews.
- **`src/db/connection.ts`** — `openDb(path)` opens better-sqlite3, wraps in Drizzle, runs migrations. Internal; feature-level persistence modules import it. Extensions never touch Drizzle directly.

Schema change workflow:
1. Edit `src/memory/schema.ts`
2. Run `bun run db:generate`
3. Commit the new migration file alongside the schema change

Default DB file: `~/.pi/agent/the-ancient-mariner/rime-ancient-mariner.db`. Override with `THE_ANCIENT_MARINER_DB_PATH` if needed.

---

## 7. Testing / Verification

There is **no test framework** configured. Verify changes by:

1. **Build**: `bun run build` (must compile cleanly)
2. **Lint**: `bun run lint` (must pass with zero errors)
3. **DB sanity**: `bun run db:generate` — no spurious migration if schema unchanged
4. **Extensions**: load the package in pi and exercise the tool/command interactively

### Local Testing Setup

The `.pi/extensions/` directory is **gitignored** — each developer creates it locally. It aggregates all extensions into a single entrypoint for pi to load during development.

Create `.pi/extensions/index.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import lifeCycleExtension from "../../extensions/lifecycle.ts";
import memoryExtension from "../../extensions/memory-extension.ts";
import sessionExtension from "../../extensions/session-extension.ts";
import planModeExtension from "../../extensions/plan-mode.ts";

export default function (pi: ExtensionAPI) {
	sessionExtension(pi);
	memoryExtension(pi);
	lifeCycleExtension(pi, { discoverResources: true });
	planModeExtension(pi);
}
```

Then run pi loading just that entrypoint:

```bash
pi --extension .pi/extensions/index.ts
```

---

## 8. Adding Skills & Prompts

- **Skills**: Add Markdown files to `skills/`. pi consumes them as context-injection skill files.
- **Prompts**: Add Markdown files to `prompts/`. pi loads them as prompt templates.

Both directories are referenced in `package.json` → `"pi"`.

---

## 9. Key Dependencies

### Runtime
- `better-sqlite3` — Synchronous SQLite driver
- `drizzle-orm` — ORM and query builder
- `@earendil-works/pi-coding-agent` — pi SDK types and APIs (devDependency)

### Dev
- `typescript` — Compiler
- `drizzle-kit` — Migration generator + Drizzle Studio
- `@biomejs/biome` — Linter / formatter
- `husky` + `lint-staged` — Git hooks
- `@types/node`, `@types/better-sqlite3` — Type definitions
- `typebox` — JSON Schema builder

---

## 10. Notes / Gotchas

- **ESM only**: `package.json` has `"type": "module"`. Source is `.ts`; compiled imports use `.js`.
- **NodeNext resolution**: `tsconfig.json` sets `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`. Compiled-output imports need `.js` extensions.
- **Extensions import `.ts` directly** because pi loads them at runtime without `tsc`. Do not change those imports to `.js`.
- **`dist/` is vestigial**: `tsc` compiles `src/` to it, but `package.json` has no `main`/`exports` field — nobody consumes it. Don't commit it; don't depend on it.
- **Local resource discovery only**: `lifeCycleExtension(pi, { discoverResources: true })` is for the local `.pi/extensions/index.ts` harness only. Do not enable it for package/production loading because `package.json["pi"]` already declares `skills/` and `prompts/`; enabling both causes prompt collisions.
- **MVP direction (`docs/mvp.md`)**: knowledge tracking — staleness detection, search, summary, store. New tools should live in `extensions/memory-extension.ts` and delegate to `src/memory/`.
- **Overlay components must size themselves to the terminal.** pi clips an overlay with `overlayLines.slice(0, maxHeight)`, so a component that renders a fixed number of lines loses its footer and bottom border on short terminals. `MemoryBrowserDialog` derives its height on every render from `tui.terminal.rows` using the same clamp its `overlayOptions` declare (`maxHeight: "90%"`, `margin: 2`); if those options change, `computeBrowserLayout` has to change with them. `tests/unit/memory-browser.test.ts` pins the invariant, along with every rendered line being exactly the requested width.
- **Read theme and terminal size through callbacks, not captured values.** `ctx.ui.custom` hands the factory a `theme` snapshot; `ctx.ui.theme` is a live getter, so passing `() => ctx.ui.theme` keeps an open dialog correct across a theme switch.
