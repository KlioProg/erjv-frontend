# ERJVPOS Global Brand Rollout Implementation Plan

> **For agentic workers:** Use the existing independent domain boundaries for parallel presentation work; root integrates and validates shared changes. Track completion below. No commits are authorized.

**Goal:** Apply the approved Customers/Inter/white-first identity across the existing frontend without changing workflows.

**Architecture:** Keep the canonical DataTable, domain column definitions, existing shadcn/Radix primitives, and existing CSS tokens. Refine shared components once, then remove conflicting domain presentation and ornamental wrappers. Do not create a second framework or new data abstractions.

**Tech Stack:** React, TypeScript, Tailwind 4, shadcn New York, Radix, Vite, Vitest.

**Spec:** User's supplied “Global Brand & Premium SaaS Design System Implementation” brief, 17 October 2026, attachment `a9185ad1-1352-4835-a2ca-1d1c865a2bfb/Pasted text.txt`.

## Global constraints

- White `#FFFFFF`; graphite `#1C211D`; supporting text `#566057`; secondary `#F3F5F2`; muted `#ECEFEB`; border `#D2D9D1`.
- Brand `#6A994E`; filled actions `#4D7337` with white text; selected surface `#EEF4EA`.
- Preserve wordmark proportions, continuous lettering, Inter, and semantic status colors.
- Frontend presentation only. No backend, API, business rules, calculations, validation, permissions, persistence, dependencies, commits, or pushes.
- Preserve existing dirty changes. Before snapshots live under ignored `node_modules/.cache/global-brand/before` for isolated review.
- Ruling: this new global implementation brief authorizes propagation of the already rendered Customers direction; do not repeat the earlier pilot approval request.

## Review focus

1. Long records and wide tables: internal scrolling/column priorities must preserve actions and avoid document overflow.
2. Tablet input and actions: 44px coarse-pointer targets and scrollable dialogs must survive denser typography.
3. Portaled dropdowns and dialogs: options, Escape, focus return, and keyboard controls must remain usable.
4. Operational status colors: warning/success/error meanings and contrast must survive brand normalization.
5. Permissions, failure, and empty states: visual simplification must preserve restricted actions, validation, and recovery.

## Tasks

- [ ] **1. Baseline and audit.** Inventory navigation, logo callers, tokens, shared primitives, domain overrides, and redundant wrappers. Record lint, 47 unit tests, component tests, and build before root presentation edits. Preserve prior verification as context, not a substitute for current results.
- [ ] **2. Shared foundation and shell.** Root owns `src/components/ui`, `layout`, `auth`, `common`, `general`, `products`, `crm`, `src/index.css`, `index.html`, and role badge presentation in `src/features/auth/roles.ts`. Retain existing palette/font/wordmark if correct. Refine shared typography, neutral tabs/counts, alerts, menus, confirmations, search controls, auth surfaces, notifications, and remaining shell drift. Keep component APIs unchanged.
- [ ] **3. Commerce presentation.** Own `orders`, `purchases`, and `order-entry`. Normalize primary values/metadata, simplify decorative panels/header icons, preserve domain-specific tables, forms, sourcing, totals, actions, and dense composer usability. Retain mobile input sizes that prevent browser zoom.
- [ ] **4. Logistics presentation.** Own `operations`, `inventory`, and `deliveries`. Normalize warehouse/catalog/fleet/directional/history lists, stock indicators and forms, scheduling/dispatch/detail/timeline presentation. Keep every quantity, status, availability rule, table configuration, and compact incoming-action contract.
- [ ] **5. Staffing presentation.** Own `staffing`. Normalize employee/job/account directories, assignment selector and existing forms. Preserve account links, role permissions, archives, and validation.
- [ ] **6. Browser QA.** Extend only the ignored read-only fixture to cover all 13 management modules and representative forms/details with synthetic test data. Capture 1920/1440/1280/1024/768 widths in one batched inspection. Inspect screens and computed typography, colors, geometry, focus, dropdowns, selected states, errors/loading/empty, reduced motion, and real Inter rendering. Fix observed material defects together, then one confirmation pass.
- [ ] **7. Verification and report.** Run ESLint, unit/component suites, TypeScript/build, relevant formatting, and whitespace checks. Compare this turn against before snapshots for unintended logic changes. Request a fresh independent review. Record actual results, screenshots, changed pages/components/tokens, and remaining limits in `docs/ui-redesign/GLOBAL-BRAND-ROLLOUT.md`.

## Validation commands

`npm run lint`; `npm run test:unit`; `npx vitest run --no-file-parallelism`; `npm run build` (includes `tsc -b`; use the existing HTTPS API-origin build guard, never a production-config change); scoped `npx prettier --check`; `git diff --check`.

Reversible styling changes use actual browser assertions and existing behavior tests. Add behavior regression tests only if a real nontrivial defect is fixed; do not mirror class strings or rewrite business expectations to make a visual change pass.
