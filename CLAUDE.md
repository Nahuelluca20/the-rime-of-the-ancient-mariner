# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the deeper agent-facing reference (conventions, dependencies, examples). This file captures only the high-signal context for getting productive quickly.

## What this repo is

`the-ancient-mariner` is a **pi package** — a plugin for the [pi coding agent](https://pi.dev). It extends pi with tools, commands, event handlers, skills, and prompts. The MVP target (`docs/mvp.md`) is knowledge tracking: detecting stale code, storing summaries, and enabling search/retrieval over agent memories.

## Commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies |
| `bun run build` | Compile `src/` → `dist/` via `tsc` (declarations + source maps) |
| `bun run lint` | Biome check |
| `bun run lint:fix` | Biome check + auto-fix |
| `bun run format` | Biome format |
| `bun run db:generate` | Emit a new Drizzle migration into `migrations/` from `db/schema.ts` |
| `bun run db:studio` | Open Drizzle Studio against the local SQLite DB |

There is **no test framework configured**. Verify changes by building, linting, and exercising extensions inside pi.

## Architecture

This repo has **two distinct execution surfaces**, which is the most important thing to understand before editing:

1. **`src/`** — compiled to `dist/` by `tsc` (`tsconfig.json` sets `rootDir: ./src`). Currently only contains `example.ts`. Anything here follows ESM + NodeNext rules: relative imports in compiled output need `.js` suffixes.

2. **`extensions/`, `skills/`, `prompts/`, `themes/`** — consumed by pi **at runtime** via the paths declared in `package.json` under the `"pi"` key. These are **not** built by `tsc`; pi loads the `.ts` files directly. That is why `extensions/example-typebox.ts` can import `../db/index.ts` with a `.ts` extension — it never goes through the TypeScript compiler.

### Extension shape

Every extension file exports a default function that receives `ExtensionAPI` and registers tools / commands / event handlers:

```ts
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name, parameters: Type.Object({...}), async execute(...) {...} });
  pi.registerCommand("name", { handler: async (args, ctx) => {...} });
  pi.on("session_start", async (event, ctx) => {...});
}
```

Canonical example: `extensions/example-typebox.ts`. Tool parameter schemas use **TypeBox** (`typebox`), not Zod.

### Persistence layer

- `db/schema.ts` — Drizzle schema. Current tables: `projects` (unique `name`) and `agent_memories` (JSON `data` column, FK to `projects` with cascade delete). Exports inferred row types (`Project`, `AgentMemory`, `New*`).
- `db/index.ts` — exposes `initDb(path = "rime-ancient-mariner.db")`. It opens `better-sqlite3`, wraps it in `drizzle()`, and **runs migrations automatically** from the `migrations/` folder before returning the `Db` handle.
- Schema change workflow: edit `db/schema.ts` → `bun run db:generate` → commit the new migration file alongside the schema change.
- Default DB file lives at the repo root as `rime-ancient-mariner.db`.

> Note: `AGENTS.md` §4.2 describes Effect-TS patterns, but the live extension (`extensions/example-typebox.ts`) uses plain async/await + TypeBox. Prefer the example file as the source of truth for new extension code.

## Conventions & gotchas

- **ESM only** (`"type": "module"`). Source is TypeScript, compiled output is `.js`.
- **Biome** enforces tabs, double quotes, semicolons, trailing commas, 100-char lines. Pre-commit hook (Husky + lint-staged) runs `biome check --write` on staged `*.{js,ts,json,md}`.
- **Do not commit** `dist/` or `node_modules/` (both gitignored).
