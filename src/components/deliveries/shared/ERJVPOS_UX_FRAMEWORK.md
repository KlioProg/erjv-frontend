# ERJVPOS UX Framework and Design Quality Standard

**Version:** 1.0  
**Adopted:** 2026-11-04 (Asia/Manila)  
**Status:** **APPROVED DIRECTION** for future ERJVPOS UX reviews and development prompts; **NOT YET CONFIRMED ADDED TO THE REPOSITORY**.  
**Applies to:** ERJVPOS frontend design, user journeys, interface reviews, QA reports, and prompts written for an external AI coding agent.  
**Working mode:** This document helps a **development prompt architect** guide an **external coding agent**. A written prompt is not an implemented or tested feature.

## 1. Framework decision

ERJVPOS uses **two complementary UX methods**:

1. **Peter Morville's UX Honeycomb — the primary quality-evaluation framework.** Evaluate whether workflows are useful, usable, desirable, findable, accessible, credible, and valuable.
2. **Lean UX (Think → Make → Check) — the implementation and improvement cycle.** Investigate a real problem, make the smallest appropriate change, verify it with evidence, and iterate if necessary.

**BASIC** (Beauty, Accessibility, Simplicity, Intuitiveness, Consistency) may be used as a **lightweight supplemental UI-polish checklist**, not an additional mandatory process. This is a heuristic checklist referenced in the user's supplied framework overview, not a replacement for the Honeycomb.

**Do not default to** the Hooked Model or engagement/habit-forming patterns. ERJVPOS is an operational business application. Accurate work, clarity, and trust matter more than maximizing time in the product. Use Design Thinking or Double Diamond only when the team needs to reconsider a larger workflow or discover genuinely unmet user needs.

### Why this fits ERJVPOS

ERJVPOS supports sales, purchases, inventory, warehouse transfers, deliveries, vehicles, financial reporting, and role-controlled management. Daily users include nontechnical office, warehouse, dispatch, and management staff. They need to perform potentially high-stakes work confidently without learning implementation jargon. UX evaluation should therefore prioritize **business correctness, task completion, findability, readable interfaces, and trustworthy status/data presentation** over novelty or decorative polish.

## 2. Non-negotiable distinction: UX quality is not production readiness

The Honeycomb evaluates the **human experience**; it does **not** establish that accounting, database transactions, authorization, or backend integrations are correct.

**Separate mandatory engineering gates:**

- **Business correctness:** validated order, receipt, dispatch, reconciliation, transfer and inventory workflows; preserved state transitions and revision/idempotency safeguards.
- **Data integrity:** accurate quantities, financial precision, dates/timezones, transactional safety, audit trails and trustworthy backend-derived status.
- **Security:** server-side authentication/authorization and correct role-scoped data access.
- **Integration:** UI actions connect to supported backend endpoints with correct methods, payloads, responses, errors and query invalidation.
- **Reliability:** safe retry behavior, handled failures, appropriate loading states, useful error recovery, tests and deploy checks.
- **UX:** Honeycomb criteria and cross-page consistency verified in rendered workflows.

**Order of priority:** security/data integrity/business correctness → reliable workflow completion → usability/accessibility/findability → visual refinement. A polished screen is not release-ready if the underlying operation is wrong.

**Current integration caveat:** A backend developer's later endpoint changes have been described but were **not yet pushed** at the time of adoption. Treat them as **pending verification**, not implemented behavior. Do not declare a release fully ready while a critical required backend integration remains unverified.

## 3. UX Honeycomb: practical ERJVPOS review criteria

| Dimension | Core review question | ERJVPOS evidence / acceptance examples |
| --- | --- | --- |
| **Useful** | Does this feature support a real business job? | A warehouse user can complete receipt/reconciliation; Dashboard highlights actionable conditions rather than redundant widgets. |
| **Usable** | Can an employee complete the task accurately and efficiently? | Clear form labels, visible next actions, stable dialogs, understandable errors, no misclick-prone workflows. |
| **Desirable** | Is the interface professional and comfortable for daily work? | Consistent typography, restrained colors, layout rhythm, status styles, no distracting flicker or overboxed design. |
| **Findable** | Can users discover the right page, record, and next action? | Create Vehicle is visible when supported; search/tabs/navigation are predictable; sidebar chevrons indicate real submenus. |
| **Accessible** | Can users operate and read it with differing abilities and devices? | Keyboard access, visible focus, semantic controls, legible contrast, unclipped text, responsive forms and dialogs. |
| **Credible** | Are labels, figures, states and confirmations truthful? | No invented departure date, fabricated pagination total, misleading fulfillment status, false success toast, or inaccurate financial wording. |
| **Valuable** | Does the workflow improve business results or reduce costly mistakes? | Fewer order mistakes, safer stock handling, clear cost coverage, less time locating information or recovering from errors. |

### Evaluation rules

- Evaluate **only dimensions relevant to the actual change**. A tiny label fix does not need seven lengthy essays.
- Judge **workflows**, not just screenshots. A screenshot can reveal clipping or ambiguity but cannot prove a mutation, authorization rule, or live integration.
- Prefer **observable evidence**: task completion, user feedback, rendered states, actual request/response behavior, targeted tests, and screenshot comparisons.
- Distinguish **reported**, **reproduced**, **fixed**, **verified**, and **blocked**. Never present a proposal as completed work.
- Optimize for nontechnical employees using the system repeatedly during a real shift.

## 4. Lean UX: Think → Make → Check

### THINK — understand and define

1. Describe the affected **user, task and actual problem**, including the observed screenshot or behavior.
2. Identify which Honeycomb qualities are harmed (usually 1–3).
3. Inspect the **current local working tree**, applicable `AGENTS.md`, affected components/hooks, and backend contract before proposing code changes. Local code may be newer than GitHub.
4. Determine whether it is a **functional bug, data/contract problem, accessibility issue, visual inconsistency, missing authorized feature, or undecided product requirement**.
5. Record critical invariants, affected consumers, failure cases and a small set of measurable acceptance criteria.

### MAKE — smallest coherent correction

1. Reuse existing React/TypeScript components, shadcn/Radix primitives, Tailwind tokens, API clients and query hooks.
2. Fix the **root cause**, not the screenshot symptom; avoid unrelated layout redesign, speculative functionality, new dependencies or backend changes outside authorized scope.
3. Preserve current workflows, permissions, data contracts, uncommitted edits, and state/revision handling.
4. If a backend contract or product decision is missing, **report and isolate the blocker**; do not invent a field, enum, date, endpoint or financial result.

### CHECK — verify in context

1. Rerun affected tests, TypeScript/lint/build checks as appropriate, and inspect `git diff --check`.
2. Check success, error, empty, loading, stale/rapid-interaction, permission, and long-text states relevant to the fix.
3. Use rendered browser QA when available, including representative viewport widths and keyboard interactions. Do not claim browser QA without performing it.
4. Re-test adjacent screens if a shared component was touched.
5. Compare the outcome against explicit acceptance criteria; report what passed, failed, was skipped, or was blocked.
6. Repeat the cycle only for an unresolved defect; do not start a new redesign by default.

**Workflow shorthand:** `Observation → affected task → Honeycomb impact → root cause → minimal fix → evidence → decision`.

## 5. Approved ERJVPOS UX baseline (preserve)

These are **previously user-approved project decisions**, not assumptions about the newest local build:

- **Identity:** primary green `#6A994E`, white-first modern/shadcn-style UI, neutral text, subtle borders and radii, restrained shadows, readable dense-enough work surfaces. Old `#80B918` guidance is superseded; reconcile any conflicting repository guidance deliberately, not as collateral cleanup.
- **Management page hierarchy:** **Title → short description → status/category tabs if needed → external search/actions → one standalone DataTable → compact footer beneath the table**. Suppliers and Sales Orders are the reference patterns.
- **Reusable frontend primitives:** prefer existing `PageHeader`, `PageToolbar`, `StatusTabNav`, `ArchiveTabNav`, `DataTable`, `CursorPageControls` and cursor hooks where relevant. Verify file paths before editing.
- **Pagination:** on intentionally paginated management screens, keep the compact `Rows [50]  Page 1  [‹] [›]` footer visible **even if only one page**; disable unavailable arrows. Do not invent global page counts for cursor-backed APIs. Unpaginated nested/detail tables do not require a footer.
- **Filters:** place ordinary search/actions outside the bordered table. Avoid nested table cards and large expanding “More filters” panels. Column filters should reflect actual supported data behavior; do not filter one loaded cursor page as if it were the whole collection.
- **Delivery navigation:** Incoming → Outgoing → Delivery Runs → History. Preserve distinct pages and an understandable Assign Delivery path (`Use Existing Run` / `Create New Run`). Assignment is not dispatch.
- **Delivery History:** one visible All Deliveries table with All/Incoming/Outgoing tabs **above** external search. Independent incoming/outgoing backend cursors must not be disguised as one authoritative global cursor/total.
- **Dashboard vs Financial Reports:** Dashboard = **monitor and act** on essential KPIs, inventory and exceptions; Financial Reports = **analyze and understand**, with existing period controls, breakdowns, trends and calendar. Do not reintroduce removed Dashboard Quick Actions or duplicate analytics charts for decoration.
- **Plain language:** labels describe actual user actions; avoid backend jargon, repeated metadata, cryptic icon-only primary actions, and unnecessary explanatory paragraphs.

### Accessibility and layout conventions

- Target **WCAG 2.2 AA** as an engineering accessibility goal where feasible; verify, do not declare conformance from code inspection alone.
- Maintain keyboard operation, visible focus, meaningful labels, screen-reader names for icon controls, and understandable field errors.
- Use status **text plus color**, with adequate contrast; do not rely on color alone.
- Handle long names, emails, numbers, dates, placeholders and select values with responsive sizing, safe wrapping/truncation and a way to access important full content.
- Ensure modals remain usable and scrollable at narrow widths and browser zoom; preserve action visibility and avoid accidental horizontal page overflow.
- Test representative desktop, laptop and narrow viewports **when a browser is available**; use recorded evidence rather than screenshots alone for functional conclusions.

## 6. Reusable decision patterns

### Status and workflow language

- Distinguish **lifecycle status** from a separate **fulfillment/receipt outcome**. Do not rename backend enums to make badges look uniform.
- Use one coherent visual mapping across modules where the meanings truly match: **Draft = neutral; preparing/assigned = informative blue; awaiting receipt/in transit = warning/amber; completed = success/green; cancelled = muted/red**. This is a **presentation proposal**, to reconcile with current theme and accessibility, not a backend contract or universal required color map.
- A status shown as “Completed” must not imply something different from the authoritative record. Confirmation and success notifications occur only after server success.

### Dates and financial charts

- Never fabricate a scheduled/actual departure timestamp. If unscheduled transfer dispatch is allowed, distinguish a legitimately missing schedule from actual departure and clearly label what the field means.
- Keep business dates and `createdAt` separate when contracts distinguish them. Preserve Manila reporting timezone and valid timestamp handling.
- A dashed or dotted chart line is acceptable **only if its distinction is meaningful and explained** (for example, estimated vs actual); otherwise favor consistent line styles, readable legends and tooltips.
- Do not change report calculations to repair chart appearance. Estimated Gross Profit is an acquisition-cost estimate, not net profit.

### Navigation and data actions

- Show a submenu chevron only when a navigational group actually expands. Keep role-based navigation and routing intact.
- If an action such as Add Vehicle cannot be found, determine whether it is **implemented but hidden**, **permission-restricted**, or **not supported by the backend** before exposing it.
- Phone validation must be consistent with the applicable field/business rule, while allowing legitimate formats supported by the backend; do not enforce an 11-digit mobile rule on unrelated numbers.

## 7. Current QA examples: apply framework, do not presume resolution

These items were **reported/observed in screenshots or user feedback**, not confirmed fixed or fully root-caused:

| Reported issue | Honeycomb focus | What to verify first |
| --- | --- | --- |
| Transfer says **“Not scheduled”** when In Transit/Completed | Credible, Usable | Is scheduling optional? Does UI use the correct scheduled-vs-actual date field? |
| Notification click briefly refreshes/flickers Dashboard | Usable, Desirable | Component remounts, query/loading resets, layout shifts, duplicate requests. |
| Purchase Order phone length inconsistent | Usable, Credible | Existing field type, canonical validation, frontend/backend agreement. |
| Left side of Purchase Order form cramped | Accessible, Usable | Grid minimum widths, long text, responsive form layout. |
| Incoming/Outgoing/Run status badges inconsistent | Usable, Accessible | Shared badge mapping, actual enum/outcome semantics, contrast. |
| Misleading sidebar chevrons | Findable, Usable | Actual expandable groups versus direct links. |
| Vehicle plate format unclear; Add Vehicle/type hard to find | Findable, Credible | Existing supported formats, endpoint permissions, type source and create workflow. |
| Financial trends show mixed line styles | Usable, Credible | Whether dash styles encode a genuine and explained semantic difference. |
| Input/select/button text spills beyond bounds | Accessible, Usable | Long-content behavior, flex min-width, wrapping, truncation, responsive widths. |

**Priority:** verify and fix business/data/security defects before cosmetic ones. A UX note does not authorize changing transfer or delivery state transitions, financial accounting, or backend schema.

## 8. Scope and severity for UX prompts

- **P0 / Release-blocking:** data loss/corruption, unauthorized access, wrong financial/inventory consequences, essential workflow failure. Escalate to full engineering verification.
- **P1 / High:** required action unreachable, disconnected necessary endpoint, misleading irreversible outcome, major workflow failure.
- **P2 / Medium:** broken input, overflow, inconsistent error handling, confusing navigation/status, unusable dialog, flicker affecting work.
- **P3 / Low:** harmless spacing, polish, decorative inconsistency with no important task impact.

Do not inflate every visual defect into a critical incident. Do not dismiss credible-but-small issues if they could mislead business decisions.

## 9. Standard instructions for an external coding agent

Use the following compact baseline in UX-related Codex prompts; adjust it to the task rather than copying every section above:

```text
Use ERJVPOS_UX_FRAMEWORK.md as the UX evaluation standard:
Peter Morville's UX Honeycomb (assess relevant dimensions) and
Lean UX (Think → Make → Check). Preserve approved ERJVPOS UI patterns.

First inspect AGENTS.md, the current local working tree and affected
components/hooks/contracts. Describe the user task, reproduced issue,
and affected UX dimensions. Implement the smallest correct change;
reuse shared primitives and preserve working behavior, permissions,
backend business rules, cursor semantics and uncommitted work.

Check functional and visual acceptance criteria, including relevant
long-content, error, loading, keyboard and responsive states. Run
focused tests, TypeScript/lint and git diff --check as appropriate.
Do not claim live/browser verification if unavailable. No unrelated
redesign, new dependencies, subagents, commits or pushes by default.
Report root cause, files changed, checks actually run, and blockers.
```

### Prompt sizing

- **Small visual defect:** say what is broken, which component to inspect, the relevant Honeycomb concern, the minimum fix and a targeted verification check.
- **Page UX adjustment:** add a user journey, screenshots/reference baseline, responsive states, keyboard behavior, error/empty states and nearby regression risks.
- **Workflow/feature:** include actual backend contract, authorization, data ownership, state transitions, server confirmation and cross-module effects.
- **Financial/inventory/concurrency:** make business invariants and engineering tests primary; UX guidance is subordinate to domain correctness.

The prompt architect should usually deliver **one standalone, copy-paste-ready prompt** for the coding agent and recommend model/effort proportionate to complexity. The assistant should **not change code by default** unless expressly asked.

## 10. Review template and definition of done

Use this lightweight record when reviewing a UI finding or a coding-agent report:

```text
Area / user task:
Observed issue and source (screenshot, code, test, agent report):
Honeycomb dimensions affected:
Root cause / confidence:
Expected behavior and constraints:
Fix scope / files (verified paths only):
Acceptance checks (happy path, failure, long text, responsive, a11y):
Actual verification (commands, browser/API checks, results):
Status: REPORTED | REPRODUCED | FIXED-UNVERIFIED | VERIFIED | BLOCKED
Remaining risk / next action:
```

**A UX fix is “VERIFIED” only if** the intended user journey works in the relevant tested environment, the observed defect is resolved, relevant accessibility/responsive checks are satisfied, and important regressions have been checked. A passing build alone is insufficient. A screen that has not been rendered should not be labeled visually verified.

**Release readiness requires more:** every critical engineering gate in §2 must have supporting evidence. If the backend developer's required changes remain unavailable, use **BLOCKED / INSUFFICIENT VERIFICATION** for affected integrations.

## 11. Adoption into the ERJVPOS repository

**Suggested repository location:** `docs/ERJVPOS_UX_FRAMEWORK.md` (or another consistent location chosen by the team). **This file was created as a chat artifact; it has not been added to the project repository.**

Once placed in the repository, add a short reference in `AGENTS.md` or the frontend documentation, e.g.:

```md
For ERJVPOS UI/UX tasks, follow `docs/ERJVPOS_UX_FRAMEWORK.md`:
use UX Honeycomb to evaluate the relevant user-experience qualities
and Lean UX (Think–Make–Check) to implement and verify focused fixes.
Do not compromise backend invariants, accessibility or approved UI patterns.
```

If a separate `docs/UI_CONSISTENCY.md` already exists, **keep its detailed component/layout rules** and have it point to this decision framework rather than replacing or duplicating it. Reconcile contradictions against the latest explicitly approved user decisions and verified backend contracts. Never overwrite repository docs blindly.

---

**Operating principle:** **Make business work correct and trustworthy first; then make it easy to find, easy to use, accessible, and visually coherent. Investigate → change only what is necessary → verify with evidence.**
