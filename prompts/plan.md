---
description: Enter planning mode for a task — analyze, design, review, then finalize
argument-hint: "<task-description>"
---
Plan mode is active. The user indicated that they do not want you to execute yet — you MUST NOT make edits, write files, run non-read-only tools, change configuration, install packages, commit, or otherwise change the system. This supersedes any other instructions you have received.

## Native Plan Mode Info
${planInfo}
Treat this section as authoritative. If it says no plan file is writable, do not try to create or edit a plan file; keep your working notes and final plan in chat.

## Plan Workflow

### Phase 1: Initial Understanding
Goal: Gain a comprehensive understanding of the user's request by reading relevant code, docs, and configuration.

1. Focus on understanding the user's request and the code associated with it.
2. Use only available read-only tools. When codebase discovery is needed, you MUST first call `subagent_search` with a focused research task and use its findings before doing any necessary follow-up inspection yourself.
3. When several independent read-only checks are useful, perform them in parallel with multiple tool calls in a single message if the tool API supports it.
4. Prefer targeted exploration over broad scanning. Read project guidance, relevant entrypoints, related modules, and tests/docs that affect the requested change.
5. Ask concise clarifying questions before designing if ambiguity would materially affect the plan. Use a question/questionnaire tool if one is available; otherwise ask the user directly in chat.

### Phase 2: Design
Goal: Design an implementation approach from your exploration results and the user's intent.

**Guidelines:**
- Consider the simplest maintainable approach first.
- Identify the critical files to modify and any files that should remain untouched.
- Note important edge cases, compatibility concerns, and user-facing behavior.
- If multiple approaches are plausible, compare them briefly and choose one recommended approach.
- If requirements are still unclear, stop and ask the user before finalizing the plan.

### Phase 3: Review
Goal: Review your proposed approach for correctness and alignment with the user's request.

1. Re-read the most critical files if needed to verify assumptions.
2. Ensure the plan stays within the user's requested scope.
3. Confirm that the plan does not require writes or unsafe commands while plan mode is active.
4. Ask any remaining material questions before producing the final plan.

### Phase 4: Final Plan
Goal: Produce a final implementation plan in the destination allowed by Native Plan Mode Info.

- If no plan file is writable, write the final plan in chat.
- Include only your recommended approach, not every alternative.
- Keep the plan concise enough to scan quickly, but detailed enough to execute effectively.
- Include the paths of critical files to be modified.
- Include a verification section describing how to test the changes end-to-end.
- Clearly state any assumptions that remain after asking questions.

### Phase 5: Call plan_exit tool
At the very end of your turn, once you have asked necessary questions and produced the final plan, call `plan_exit` to request user approval to leave plan mode.

This is critical: your turn should end only by either asking the user clarifying question(s) or calling `plan_exit`. Do not use clarifying questions to ask "Is this plan okay?" — that is what `plan_exit` is for.

NOTE: At any point in this workflow, ask the user questions if requirements or approach choices are unclear. Do not make large assumptions about user intent. The goal is to present a well-researched plan and tie off loose ends before implementation begins.

## Current Task
$@
