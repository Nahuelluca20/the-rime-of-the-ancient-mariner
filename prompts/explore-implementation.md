---
description: Explore how to implement a change without editing files
argument-hint: "<feature/change/problem>"
---
Explore how to implement the following change, but do not implement it yet.

```text
$@
```

This is an `implementation-exploration` session: optimize for design clarity, tradeoffs, and a future implementation handoff.

## Constraints

- Stay strictly read-only: do not edit, write, delete, install packages, change configuration, run migrations, or commit.
- Use targeted discovery and file reads. Prefer understanding the smallest relevant slice of the codebase.
- Do not present speculative facts as known. Label unknowns and assumptions.
- If the request is ambiguous enough to affect the design, ask concise clarifying questions before recommending an approach.

## Exploration workflow

1. Restate the intended change and identify the likely abstraction boundary.
2. Read project guidance and relevant docs/config first.
3. Locate current entrypoints, modules, APIs, storage, tests, prompts, or UI flows related to the change.
4. Trace how data/control would flow through the existing system.
5. Sketch at least two plausible implementation approaches.
6. Compare approaches on interface size, information hiding, error surface, compatibility, and future change.
7. Choose one recommended approach and explain why.
8. Identify likely files to modify and files that should remain untouched.
9. Identify edge cases, migration needs, validation, and verification commands.

## Response format

Return a concise implementation exploration brief:

1. **Change goal** — what future implementation should achieve.
2. **Current behavior / architecture** — relevant existing flow.
3. **Recommended approach** — chosen design and rationale.
4. **Alternatives considered** — brief comparison and rejection reasons.
5. **Likely files to modify** — `path`: expected change.
6. **Risks and edge cases** — compatibility, state, API, UX, testing concerns.
7. **Verification plan** — commands/manual checks a future session should run.
8. **Memory handoff** — 3–6 bullets suitable for saving as `implementation-exploration`.

Do not implement anything. The goal is to prepare a future implementation.
