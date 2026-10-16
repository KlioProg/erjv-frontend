# ERJVPOS — Codex Working Rules

## Purpose

Make the **smallest safe change** that satisfies the request. Reduce unnecessary context loading, tool calls, repeated planning, and rework **without compromising correctness, accessibility, or existing behavior**.

Follow higher-priority instructions and repository rules. These guidelines do not override mandatory instructions from tools or skills.

## 1. Scope and Discovery

- Begin with the requested feature and its direct dependencies. Expand the search only when necessary.
- Prefer targeted file searches and relevant excerpts over reading the entire repository.
- Reuse known project patterns before creating new abstractions.
- For straightforward changes, implement directly; for complex or risky changes, write a brief plan first.
- Ask questions only when an essential product or technical decision is unresolved.
- Avoid unrelated refactors, broad formatting changes, and speculative improvements.
- Stop when the requested task is complete.

## 2. Skills and Tool Usage

**Use skills selectively.** An installed skill is not automatically relevant to every task.

| Task | Preferred guidance |
| --- | --- |
| Small styling, copy, icon, or spacing edit | Existing project conventions; no extra skill required |
| shadcn/ui component changes | `shadcn` when relevant |
| Page-level UI design | `frontend-design` when relevant |
| Detailed visual polish | `impeccable` when relevant |
| Complex debugging | Relevant debugging guidance |
| Architecture, stock reservations, or concurrency | Relevant backend/engineering guidance |

- Prefer **one relevant skill** for ordinary tasks. Combine skills only when they provide genuinely different, necessary guidance.
- Read the selected skill's `SKILL.md` and only the supporting material needed for the task.
- Do not re-read documentation already available in the current working context without a reason.
- Do not invoke broad brainstorming, multi-agent planning, or repeated review cycles for routine edits unless a governing instruction requires them.
- Use subagents, external plugins, and additional tools only when they materially improve the result.
- Never skip a skill or workflow that a higher-priority instruction explicitly requires.

## 3. Frontend Design System

Preserve the existing React, TypeScript, Tailwind CSS, and shadcn/ui architecture.

**Approved visual direction:**

- White-first, modern shadcn/ui New York aesthetic
- Inter font where available; graphite text and refined neutral surfaces
- Brand green: `#80B918`
- Accessible foreground/background contrast; use dark text on bright green, or a darker green for white text
- Consistent 4px-based spacing, restrained shadows, purposeful cards, and minimal decorative nesting
- Efficient desktop tables and usable landscape-tablet controls

Reuse existing components such as `ManagementPage`, `StatusTabNav`, and `DataTableActions` rather than creating similar alternatives.

### Canonical Table Rule

**`DataTable` is the canonical table implementation for normal tabular feature screens.** Configure it with domain-specific columns, filters, actions, and data.

- Do not manually recreate tables or introduce competing table components unless `DataTable` fundamentally cannot support the requirement.
- Keep feature-specific logic within its domain; keep reusable table behavior in the shared component.
- Preserve sorting, filtering, pagination, row actions, accessibility, and other existing behavior when migrating a table.
- Remove old table markup only after confirming the replacement works.

## 4. Architecture and Business Logic

- **Pages compose.**
- **Components render.**
- **Hooks coordinate.**
- **Services communicate.**
- **Utilities transform.**
- **Schemas validate.**
- **The backend owns persisted business data and business rules.**

Preserve existing API contracts, validation, authentication, permissions, and operational statuses. Do not invent backend behavior, fabricate persisted data, or change business logic to solve a visual problem.

## 5. Implementation and Verification

Match the depth of investigation and testing to the risk of the change.

| Scope | Approach | Verification |
| --- | --- | --- |
| Small UI change | Inspect affected component, make focused edit | Targeted inspection and relevant checks |
| Shared component or page change | Inspect direct consumers, reuse established patterns | Relevant tests, TypeScript/lint, build when warranted |
| Business-critical workflow | Analyze invariants, plan incrementally, implement carefully | Thorough relevant tests, integration and concurrency checks as applicable |

- Avoid rerunning the entire test suite after every minor edit; run broad checks at meaningful checkpoints.
- Never suppress errors, disable tests, or reduce required verification merely to save tokens.
- For visual work, inspect the rendered interface when browser tooling is available. Never claim visual QA without actually performing it.
- Report checks that were **not** run and why.

## 6. Boundaries

Unless explicitly requested:

- Do not modify backend files for frontend-only tasks.
- Do not change database schemas, migrations, or API contracts.
- Do not add dependencies or modify lockfiles unnecessarily.
- Do not alter unrelated modules or rewrite working components without justification.
- Do not commit or push changes.

## 7. Communication

Keep completion reports concise and include:

- What changed and the relevant files
- Checks run and their results
- Any unresolved blocker, risk, or limitation

Do not generate lengthy plans, documentation, or post-implementation proposals unless requested or warranted by the task.

**Principle: Focused investigation → selective skills → smallest safe implementation → proportional verification.**