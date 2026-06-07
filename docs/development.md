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

## How It Works

- **`extensions/`** — the production extension files, declared in `package.json` → `"pi"."extensions"`. These are what users get when they install the package.
- **`package.json["pi"].skills` and `package.json["pi"].prompts`** — the production source of skills and prompt templates for installed package usage.
- **`.pi/extensions/index.ts`** — a local dev harness that re-exports all extensions from a single file. This lets you load everything with one `--extension` flag during development.
- **`lifeCycleExtension(pi, { discoverResources: true })`** — local-only resource discovery. This makes prompts and skills available when using `pi --extension .pi/extensions/index.ts`, because that mode loads only the extension entrypoint and not the package manifest resources.
- **`.pi/` is gitignored** — it never ships to users and is never committed.

When you add a new extension file, remember to add its import to `.pi/extensions/index.ts`.

Do **not** enable `discoverResources` in package/production loading. The installed package already declares `skills/` and `prompts/` in `package.json`; enabling both would load the same prompt templates twice and produce `[Prompt conflicts]` warnings.

## Verification

| Step | Command |
|------|---------|
| Build | `bun run build` |
| Lint | `bun run lint` |
| DB migrations | `bun run db:generate` |
| Interactive test | `pi --extension .pi/extensions/index.ts` |
