---
description: Understand and explain an existing module, flow, API, or behavior
argument-hint: "<module/flow/question>"
---
Understand and explain the following existing code or behavior.

```text
$@
```

This is a `code-understanding` session: optimize for an accurate mental model, not changes or implementation planning.

## Constraints

- Stay strictly read-only: do not edit, write, delete, install packages, change configuration, run migrations, or commit.
- Prefer targeted file reads over broad scans.
- Trace actual code paths before explaining behavior.
- Distinguish confirmed facts from assumptions.
- If the question is ambiguous, ask a concise clarifying question or state the interpretation you used.

## Understanding workflow

1. Identify the exact module, flow, API, command, prompt, tool, or behavior to explain.
2. Read project guidance and relevant docs/config if they affect interpretation.
3. Locate entrypoints and call sites.
4. Follow the flow through the smallest necessary set of files.
5. Identify key data shapes, state transitions, side effects, and external integrations.
6. Note conventions, invariants, and edge cases that are easy to miss.
7. Summarize the mental model in terms a future agent can reuse.

## Response format

Return a concise code-understanding brief:

1. **Understanding goal** — what was explained.
2. **Short answer** — the core mental model in a few sentences.
3. **Flow / architecture** — step-by-step behavior or component relationships.
4. **Key files and symbols** — `path`: important functions/types and responsibilities.
5. **Data and state** — important shapes, persistence, mutation, or lifecycle details.
6. **Gotchas / edge cases** — meaningful details a future session should know.
7. **Open questions** — only if something remains unknown.
8. **Memory handoff** — 3–6 bullets suitable for saving as `code-understanding`.

Do not implement anything. The goal is explanation and durable understanding.
