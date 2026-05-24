# AGENTS.md — the-ancient-mariner

> Guide for AI agents working with this pi package codebase.

---

## 1. Project Overview

`the-ancient-mariner` is a [pi](https://pi.dev) package — a plugin for the pi coding agent. It extends pi with custom tools, commands, event handlers, skills, prompts, and themes.

This package uses **Effect-TS** as its primary async/effect system and **better-sqlite3** for local data storage. The MVP goal is knowledge tracking: detecting stale code, storing summaries, and enabling search/retrieval.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.8+ (ES2022, strict mode) |
| Effects / Async | [Effect-TS](https://effect.website/) |
| Platform APIs | `@effect/platform` + `@effect/platform-node` |
| Validation / Schemas | [Typebox](https://github.com/sinclairzx81/typebox) |
| Local DB | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Package Runtime | [pi-coding-agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) SDK |
| Bundler / Runtime | Bun |
| Lint & Format | [Biome](https://biomejs.dev/) 1.9.4 |
| Git Hooks | Husky + lint-staged |

---

## 3. Directory Layout

```
the-ancient-mariner/
├── src/                  # Core TypeScript source
│   └── example.ts        # Entry-point / demo program
├── extensions/           # pi extensions (tools, commands, event handlers)
│   └── example-effect.ts # Canonical example of an Effect-TS extension
├── skills/               # pi skills (empty — add `.md` skill files here)
├── prompts/              # pi prompt templates (empty — add `.md` prompts here)
├── docs/                 # Project documentation
│   └── mvp.md            # MVP requirements doc
├── dist/                 # Compiled output (gitignored, do not edit)
├── package.json          # pi package manifest + npm config
├── tsconfig.json         # TypeScript config (NodeNext, ESM, declarations)
├── biome.json            # Biome formatter + linter config
└── AGENTS.md             # This file
```

**Key:** `src/` compiles to `dist/` via `tsc`. `extensions/`, `skills/`, `prompts/` are consumed by pi at runtime via the paths declared in `package.json` under the `"pi"` key.

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

### 4.2 Effect-TS Patterns

Use `Effect.gen` for sequential effectful code. Provide platform layers explicitly. Always run with `Effect.runPromise` (or `runPromiseExit`) at the edge.

```typescript
import { Console, Effect } from "effect";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const content = yield* fs.readFileString("./file.txt");
	yield* Console.log(content);
	return content.length;
});

const runnable = Effect.provide(program, NodeFileSystem.layer);
const result = await Effect.runPromise(runnable);
```

### 4.3 Typebox Schemas (Extensions)

When registering pi tools, define parameters with Typebox:

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
	// register tools, commands, events
}
```

See `extensions/example-effect.ts` for a full working example.

---

## 5. Build & Development Workflow

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies |
| `bun run build` | Compile `src/` → `dist/` with declarations + source maps |
| `bun run lint` | Run Biome linter |
| `bun run lint:fix` | Run Biome linter + auto-fix |
| `bun run format` | Run Biome formatter |

**Pre-commit:** Husky runs `lint-staged` on `*.{js,ts,json,md}` via `biome check --write --no-errors-on-unmatched`.

---

## 6. Extension Development

The canonical reference is **`extensions/example-effect.ts`**. It demonstrates three patterns:

1. **Tool** — `pi.registerTool()` with Effect-TS execution
2. **Command** — `pi.registerCommand()` callable from pi's UI
3. **Event handler** — `pi.on("session_start", ...)`

Guidelines:
- Keep effects pure; push side-effects into `Effect.sync` or platform layers.
- Provide Node-specific layers (e.g., `NodeFileSystem.layer`) before running.
- Return structured tool results with `content: [{ type: "text", text: "..." }]` and optional `details`.

---

## 7. Testing / Verification

There is **no test framework** configured yet. Verify changes by:

1. Building: `bun run build` (must produce clean `dist/`)
2. Linting: `bun run lint` (must pass with zero errors)
3. For extensions: load the package in pi and exercise the tool/command interactively.

---

## 8. Adding Skills & Prompts

- **Skills**: Add Markdown files to `skills/`. pi consumes them as context-injection skill files.
- **Prompts**: Add Markdown files to `prompts/`. pi loads them as prompt templates.

Both directories are referenced in `package.json` → `"pi"` and are currently empty — ready for incremental additions.

---

## 9. Key Dependencies

### Runtime
- `@effect/platform` & `@effect/platform-node` — Effect platform abstractions
- `better-sqlite3` — Synchronous SQLite driver
- `@earendil-works/pi-coding-agent` — pi SDK types and APIs

### Dev
- `typescript` — Compiler
- `@biomejs/biome` — Linter / formatter
- `husky` + `lint-staged` — Git hooks
- `@types/node` — Node type definitions
- `typebox` — JSON Schema builder

---

## 10. Notes / Gotchas

- **ESM only**: `package.json` has `"type": "module"`. Use `.ts` for source, `.js` for compiled imports.
- **NodeNext resolution**: `tsconfig.json` sets `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`. Import paths must include `.js` extensions in compiled output (TypeScript handles this).
- **Do not commit `dist/`**: It is gitignored; it is rebuilt by `tsc`.
- **Do not commit `node_modules/`**: Gitignored.
- **Context from `docs/mvp.md`**: The MVP targets knowledge tracking (staleness detection, search, summary, store). Future extensions should align with that direction.
