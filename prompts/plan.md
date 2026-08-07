---
description: Plan a task collaboratively through architecture, program design, and vertical slices
argument-hint: "<task-description>"
---
Plan mode is active. The user indicated that they do not want you to execute yet — you MUST NOT make edits, write files, run non-read-only tools, change configuration, install packages, commit, or otherwise change the system. This supersedes any other instructions you have received.

## Native Plan Mode Info
${planInfo}
Treat this section as authoritative. If it says no plan file is writable, do not try to create or edit a plan file; keep your working notes and final plan in chat.

## Collaboration Rules

Planning is a conversation with the human, not a single plan dump. Work through the phases below in order and do not repeat a phase the human has approved.

- Stop after System Architecture and ask the human to approve it or request changes.
- Stop after Program Design and ask the human to approve it or request changes.
- Present the final vertical-slice plan only after both earlier phases are aligned.
- If feedback invalidates an earlier decision, return to that phase and revise the downstream design.
- Use a question/questionnaire tool for checkpoints when one is available; otherwise ask directly in chat.
- Do not call `plan_exit` at an intermediate checkpoint. Call it only after presenting the final plan.

## Phase 1: Initial Understanding

Goal: understand the requested behavior and the smallest relevant area of the codebase.

1. Read relevant project guidance, code, tests, documentation, and configuration.
2. Use only available read-only tools. When codebase discovery is needed, first call `subagent_search` with a focused task and use its findings before any necessary follow-up inspection.
3. Run independent read-only checks in parallel when the tool API supports it.
4. Prefer targeted exploration and trace real entrypoints, callers, data flow, and boundaries.
5. Ask concise clarifying questions when ambiguity would materially affect the architecture.

## Phase 2: System Architecture

Goal: align on how services, clients, endpoints, schemas, queues, jobs, and stores communicate without descending into internal implementation details.

Present only artifacts that clarify the proposed system. Prefer visual communication over long prose:

- Use compact plain-text diagrams in fenced `text` blocks for cross-boundary interactions.
- Do not use Mermaid.
- Use boxes and arrows for component maps, aligned columns for sequences, and indented
  trees for hierarchy or control flow.
- Keep labels concise and lines narrow enough for a terminal. Split a crowded diagram into
  multiple focused views rather than producing one large diagram.
- Identify existing, new, and changed boundaries.
- Show request, event, and data flow, including meaningful failure paths.
- Define external contracts and endpoint shapes when relevant:

```text
PUT /api/resources/:slug
  request:  { destination: string }
  response: { resource: Resource }
```

- Define data models, schema changes, transformations, and important query shapes when relevant:

```sql
CREATE TABLE resource (
  slug         TEXT PRIMARY KEY,
  destination  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SELECT ... FROM ...
```

- State architecture decisions, compatibility constraints, and unresolved questions.
- Do not include private helper functions, detailed class internals, or line-by-line implementation steps yet.

End this phase with an explicit human approval checkpoint. Incorporate requested changes before continuing.

## Phase 3: Program Design

Goal: align on the internal control flow and code organization that implement the approved architecture.

Use the following artifacts when they add information:

### Call-stack trees

Show orchestration and control-flow changes. Use diff markers when the important part is what changes:

```text
 entrypoint
   runCommand
+    handleCreateResource
+      ResourceClient.create(input)
+        PUT /api/resources/:slug
+      renderResult
-    legacyCreateFlow
```

For dependency-heavy systems, show separate production and test call graphs when their wiring differs.

### File-tree diffs

Keep the human oriented to where code will live:

```text
 src
 └── resource
+    ├── resource-client.ts      # NEW - wraps API contract calls
+    ├── resource-client.test.ts # NEW - covers request/response mapping
~    └── resource-route.ts       # MODIFIED - wires create action into UI
```

### Key types and signatures

Specify internal contracts that are easy to misunderstand but too detailed for System Architecture:

```ts
interface Item {
  id: ItemId;
  parentId: ItemId | null;
}

interface Cursor {
  position: ItemId;
  direction: "up" | "down";
}

function resolveTarget(items: Item[], cursor: Cursor): ItemId | null;
```

Also identify ownership, state transitions, errors, edge cases, and the tests that protect the design. Compare alternatives briefly only when a real design choice remains, then recommend one.

End this phase with an explicit human approval checkpoint. Incorporate requested changes before continuing.

## Phase 4: Vertical Slices

Goal: turn the approved architecture and program design into small, end-to-end increments the human can observe, test, and review.

Do not produce a horizontal stack-order plan such as “all migrations, then all services, then all APIs, then all UI.” Each slice should deliver a thin path through every layer it needs.

For each slice provide:

1. **Observable outcome** — behavior the human can touch through a browser, `curl`, a CLI, a tool, or another realistic interface.
2. **End-to-end changes** — the minimal contract, UI/client, orchestration, service, and persistence work needed for that outcome.
3. **Files** — concrete paths expected to change.
4. **Verification** — focused automated checks plus a manual demonstration where possible.
5. **Review gate** — stop after implementation, summarize behavior and verification, and wait for human approval before starting the next slice.

Prefer an order that makes the feature testable early. When appropriate, begin with a real contract backed by mock or in-memory behavior, connect a consumer, then replace internals with durable storage and add business rules and failure handling in later slices. Adapt this sequence to the actual task rather than applying it mechanically.

Keep slices small enough that feedback can change the remaining plan without discarding a large implementation. Explicitly list dependencies between slices.

## Phase 5: Final Review and Plan

Before presenting the final plan:

1. Re-read critical files as needed and verify assumptions.
2. Ensure every slice conforms to the approved architecture and program design.
3. Confirm edge cases, compatibility, migrations, and user-visible behavior are covered.
4. Keep the plan within scope and identify files that must remain untouched.

Present the recommended plan in chat when no plan file is writable. Include the approved System Architecture and Program Design artifacts, ordered vertical slices, assumptions, and end-to-end verification.

The implementation protocol in the final plan must say:

- Implement exactly one approved vertical slice at a time.
- Run that slice's checks and provide a concise change summary.
- Stop for human code and behavior review before continuing.
- Revise unimplemented slices when feedback changes the design.
- Return to plan mode when feedback changes architecture or invalidates major program-design decisions.

## Phase 6: Call `plan_exit`

After the final plan is presented, call `plan_exit` to request approval to leave plan mode. Do not ask “Is this plan okay?” in ordinary chat; `plan_exit` is the final approval mechanism.

At any point, ask focused questions when requirements or design choices remain unclear. Do not make large assumptions merely to finish the plan.

## Current Task
$@
