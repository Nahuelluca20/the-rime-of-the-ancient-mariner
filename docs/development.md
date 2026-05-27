# Local Development & Testing

## Setup

```bash
git clone <repo-url>
cd the-ancient-mariner
bun install
```

## Local Testing with pi

The `.pi/extensions/` directory is **gitignored** — each developer creates it locally. It aggregates all extensions into a single entrypoint for pi to load during development.

Create `.pi/extensions/index.ts`:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import lifeCycleExtension from "../extensions/lifecycle.ts";
import memoryExtension from "../extensions/memory-extension.ts";
import sessionExtension from "../extensions/session-extension.ts";
import planModeExtension from "../extensions/plan-mode.ts";

export default function (pi: ExtensionAPI) {
	sessionExtension(pi);
	memoryExtension(pi);
	lifeCycleExtension(pi);
	planModeExtension(pi);
}
```

Then run pi loading just that entrypoint:

```bash
pi --extension .pi/extensions/index.ts
```

## How It Works

- **`extensions/`** — the production extension files, declared in `package.json` → `"pi"."extensions"`. These are what users get when they install the package.
- **`.pi/extensions/index.ts`** — a local dev harness that re-exports all extensions from a single file. This lets you load everything with one `--extension` flag during development.
- **`.pi/` is gitignored** — it never ships to users and is never committed.

When you add a new extension file, remember to add its import to `.pi/extensions/index.ts`.

## Verification

| Step | Command |
|------|---------|
| Build | `bun run build` |
| Lint | `bun run lint` |
| DB migrations | `bun run db:generate` |
| Interactive test | `pi --extension .pi/extensions/index.ts` |
