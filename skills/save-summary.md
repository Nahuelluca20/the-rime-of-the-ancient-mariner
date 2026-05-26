---
name: save-summary
description: Use when the user runs /save-summary, asks to "save a summary" of this session, or is clearly wrapping up work that should be persisted for future sessions. Produces a title/description/context triple and calls save_session_summary to merge it into the session's memory row.
---

# Save Session Summary

Distill the current session into three fields and call `save_session_summary` exactly once.

## Required fields

- **title** — ≤ ~6 words, plain text. Answers "what did this session accomplish?".
- **description** — one sentence (~200 chars max). Intent + outcome.
- **context** — multi-paragraph markdown:
  1. **Goal** — what the user was trying to do.
  2. **Decisions** — choices made and why, especially ones a future session would otherwise re-litigate.
  3. **Code touched** — files modified or read closely, one line each on what/why.
  4. **Open questions / next steps** — anything unresolved.

## Procedure

1. Work from the transcript already in context. Do not re-read files unless a fact is unclear.
2. Draft the three fields faithfully — no invented decisions, no marketing tone.
3. Call `save_session_summary` once with those three fields. The tool merges them into the session's existing memory row, creating it if needed.
4. Report the tool's returned message to the user.

## Failure handling

- If the tool returns a warning that the session has no name, stop and tell the user to run `/name <session-name>` first, then retry. Do not loop.
