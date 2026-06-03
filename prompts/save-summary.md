---
description: Summarize this session by type and persist it via save_session_summary
argument-hint: "[session-type hint]"
---
Save a typed summary of this session using the `save-summary` skill.

Optional session type hint from the user:

```text
$@
```

Valid session types are:

- `implementation`
- `code-exploration`
- `implementation-exploration`
- `code-understanding`
- `mixed`

If the hint is blank, infer the type from the transcript. If the hint conflicts with the transcript, prefer the transcript and mention the mismatch briefly after saving.
