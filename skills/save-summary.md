---
name: save-summary
description: Use when the user runs /save-summary, asks to save a summary, or is wrapping up work that should be persisted. Classifies the session as implementation, code-exploration, implementation-exploration, code-understanding, or mixed, then calls save_session_summary once with title, description, context, sessionType, and tags.
---

# Save Adaptive Session Summary

Distill the current session into a durable memory and call `save_session_summary` exactly once.

This skill must not assume the session implemented a feature. First classify what kind of work happened, then write the summary format that fits that work.

## Session types

Choose exactly one `sessionType`:

- `implementation` — code/config/docs were changed to deliver a fix, feature, refactor, or other concrete artifact.
- `code-exploration` — the session was read-only orientation or investigation of a codebase, module, or repo.
- `implementation-exploration` — the session explored how a future implementation could be done, compared approaches, or produced a plan without executing it.
- `code-understanding` — the session explained how existing code, a flow, an API, or architecture works.
- `mixed` — the transcript contains multiple meaningful threads of different types and no single type dominates.

If the user explicitly provided a desired type in the prompt, use it unless the transcript clearly contradicts it.

## Required fields

- **title** — ≤ ~6 words, plain text. Answers what this memory is about.
- **description** — one sentence (~200 chars max). Intent + outcome.
- **context** — multi-paragraph markdown adapted to the chosen `sessionType`.
- **sessionType** — one of the exact values above.
- **tags** — 2–6 lowercase strings useful for retrieval, e.g. `memory`, `prompt`, `sqlite`, `plan-mode`.

## Context templates

### `implementation`

Use when changes were made.

```markdown
## Goal
What the user wanted to change or deliver.

## Changes made
- `path`: what changed and why.

## Decisions
Design/API/storage/UX choices made and why.

## Verification
Commands run and outcomes, or why verification was not run.

## Open questions / next steps
Anything unresolved.
```

### `code-exploration`

Use when the session mapped or investigated code without proposing one concrete implementation path.

```markdown
## Exploration goal
What the user wanted to inspect or learn.

## Key findings
Concise findings that a future session should reuse.

## Code map
- `path`: responsibility or relevance.

## Conventions / constraints
Project rules, runtime assumptions, constraints, or gotchas discovered.

## Open questions / next steps
Remaining unknowns or useful follow-up reads.
```

### `implementation-exploration`

Use when the session explored how to implement something, compared approaches, or produced a plan.

```markdown
## Exploration goal
Feature/change/problem being considered.

## Recommended approach
The approach selected or favored, with rationale.

## Alternatives considered
Other approaches and why they were rejected or deferred.

## Likely files / APIs
- `path`: expected role in a future implementation.

## Risks / edge cases
Known pitfalls, compatibility issues, validation needs.

## Next implementation steps
Concrete steps for the next session.
```

### `code-understanding`

Use when the session explained existing behavior.

```markdown
## Understanding goal
Flow, module, API, or behavior the user wanted explained.

## Mental model
The concise explanation a future agent should start from.

## Flow / architecture
Step-by-step behavior or component relationships.

## Key files
- `path`: what it does in this flow.

```

### `mixed`

Use when there were multiple substantial threads.

```markdown
## Session overview
One paragraph connecting the threads.

## Threads
### <thread name> (`sessionType`)
Goal, findings, decisions, code touched/read, and next steps for this thread.

## Cross-thread decisions
Decisions or constraints that affect more than one thread.

```

## Procedure

1. Work from the transcript already in context. Do not re-read files unless a fact is unclear.
2. Classify the session using the session types above.
3. Draft the required fields faithfully — no invented decisions, no marketing tone.
4. Prefer precise file paths when the transcript contains them.
5. Call `save_session_summary` once with `title`, `description`, `context`, `sessionType`, and `tags`.
6. Report the tool's returned message to the user.

## Failure handling

- If the tool returns a warning that the session has no name, stop and tell the user to run `/name <session-name>` first, then retry. Do not loop.
