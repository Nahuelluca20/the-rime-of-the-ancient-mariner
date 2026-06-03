---
description: Explore and understand the codebase with a structured read-only flow
argument-hint: "[focus or question]"
---
Explore and understand this codebase before proposing or making changes.

This is a `code-exploration` session: optimize for reusable findings and orientation, not implementation.

Optional focus / question from the user:

```text
$@
```

## Constraints

- Stay strictly read-only: do not edit, write, delete, install packages, change configuration, run migrations, or commit.
- Prefer fast discovery commands (`pwd`, `find`, `rg`, `ls`, `git status --short`) and targeted file reads.
- Do not read huge generated/vendor directories unless they are directly relevant.
- If the optional focus above is blank, perform a general orientation of the whole project.
- If the optional focus is present, prioritize that area while still mapping enough surrounding context to understand it.

## Exploration workflow

1. Identify the project root, visible directory structure, and major files.
2. Read project guidance and overview docs first, such as `AGENTS.md`, `CLAUDE.md`, `README.md`, and relevant files in `docs/`.
3. Inspect package/build/config files to understand language, runtime, dependencies, scripts, and tooling.
4. Find entrypoints and important modules, then read representative source files instead of every file.
5. Trace the main architecture:
   - core domain concepts
   - module boundaries
   - data flow and persistence
   - external integrations
   - extension/plugin points
   - commands, tools, or UI flows
6. Identify conventions for formatting, testing, verification, errors, and naming.
7. Note uncertainties, risky areas, and follow-up questions only if they materially affect understanding.

## Response format

Return a concise codebase brief with these sections:

1. **High-level summary** — what this project does and who/what uses it.
2. **Tech stack and tooling** — languages, runtimes, frameworks, scripts, storage, tests.
3. **Project map** — important directories/files and their responsibilities.
4. **Architecture and data flow** — how the main pieces interact.
5. **Key workflows** — build/test/run commands and important runtime flows.
6. **Conventions** — style, patterns, and project-specific rules to follow.
7. **Focus findings** — answer the optional focus/question if one was provided.
8. **Open questions / risks** — only the meaningful unknowns.
9. **Memory handoff** — 3–6 bullets that would be useful if this session is later saved with `/save-summary` as `code-exploration`.

Do not implement anything. The goal is understanding and orientation only.
