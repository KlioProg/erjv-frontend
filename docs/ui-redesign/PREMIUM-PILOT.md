# Premium SaaS redesign — Customers review checkpoint

16 October 2026. The audit, design foundation, shared-component refinement, and Customers pilot are ready for visual review (phases 1–4). **The complete application redesign is not finished.** The brief explicitly requires pilot approval before management-page rollout. Phases 5–7 remain pending that approval.

This report supersedes the visual direction in [the earlier Customers checkpoint](CUSTOMERS-PILOT.md). That document's screen inventory remains useful; its earlier palette, font, screenshots, and test counts are historical.

## Audit and implementation

The existing React/Tailwind/shadcn New York/Radix foundation and canonical DataTable were retained. Domain columns, filtering, sorting, pagination, permissions, query hooks, API contracts, and operational calculations retain their existing responsibilities.

The audit found inconsistent typography, global selectors overriding table metadata and utility sizes, repeated bordered wrappers, duplicated Customers tokens, and mixed control proportions. Actual browser inspection also exposed two shared defects: `text-ui` was incorrectly treated as a text color by `tailwind-merge`, deleting button foreground classes; and OS dark-mode utilities could put pale text on white surfaces while the application tokens stayed light. Both were fixed at their shared sources.

### Tokens and typography

| Purpose                             | Current token/value |
| ----------------------------------- | ------------------- |
| Canvas, cards, popovers, table rows | `#FFFFFF`           |
| Graphite text                       | `#1C211D`           |
| Supporting text                     | `#566057`           |
| Secondary surface                   | `#F3F5F2`           |
| Muted surface                       | `#ECEFEB`           |
| Structural border                   | `#D2D9D1`           |
| Input boundary                      | `#858E85`           |
| Brand accent                        | `#6A994E`           |
| Filled action, links, focus         | `#4D7337`           |
| Selected navigation/tab background  | `#EEF4EA`           |

Semantic warning, success, information, error, and destructive colors remain distinct. Ordinary cards and tables have neutral/white surfaces. Dark utilities now follow the existing `.dark` token selector; the application remains white under either OS preference. No dark-mode product feature was added.

Inter Variable is self-hosted from the official repository, pinned to revision `353b61b9f4430d5f420d56605a6e7993e0941470`, with its SIL Open Font License and source/hash record in [public/fonts/inter](../../public/fonts/inter/SOURCE.md). `@font-face` supplies normal weights 100–900 with `font-display: swap`; the document preloads the local WOFF2. The fallback is the requested system sans-serif stack. No font service or npm dependency was added. Browser platform-font inspection confirmed the downloaded Inter font actually rendered, rather than relying on the CSS family declaration alone.

The Customers hierarchy is 22px/600 page titles, 20px/600 dialog titles, 16px/600 section titles, 14px primary table values and fields, 12px metadata/headers, and 13px labels. Header height is 56px; DataTable headers are 44px. Customer rows accommodate their content, including roughly 64px two-line rows. Desktop compact actions retain their existing 32px height; coarse-pointer controls retain 44px targets.

### Shared components and pilot

- Button, Input, Textarea, SelectTrigger: consistent text sizes, restrained transitions, existing accessible focus and disabled states. The compact action height remains compatible with the existing delivery-action contract.
- Card: neutral surfaces, quieter 20px spacing, explicit 16px headings, no default decorative shadow. Meaningful cards remain available.
- Dialog: consistent title hierarchy, radius, spacing, and restrained 150ms animation; Radix focus trapping, keyboard dismissal, and semantics remain in place. Existing global reduced-motion handling is retained.
- Tabs/StatusTabNav: neutral tracks with restrained selected backgrounds and preserved counts/navigation.
- DataTable: readable 14px body/12px header hierarchy, domain-compatible spacing, neutral loading skeleton, an announced loading message, and no stale records during loading. Management and dense composer appearances keep their different spacing needs. Existing domain columns and actions remain canonical.
- Shell: consistent Inter, 56px header, and tidier navigation spacing. Navigation destinations, permissions, account controls, and notifications were preserved.
- Shared class merging: `text-ui` is registered as a font size, preserving foreground colors and allowing explicit size overrides. Two regression tests cover the actual conflict.
- Customers: a single table boundary, cleaner toolbar and active/archive filter treatment, grouped create/edit forms, readable secondary information, existing validation, recoverable errors, and empty/no-results/loading states. The duplicate pilot palette and broad per-page type overrides were removed so this screen uses the shared foundation.

The extra bordered directory wrapper and nested empty-state Card/CardContent were removed. No metrics, decorative cards, additional workflow steps, alternative table implementation, or production fixtures were added. Earlier brand work on Badge, Checkbox, menus, feedback, and DataTableActions remains in use; those components were inspected rather than replaced with a second framework.

## Rendered evidence

Screenshots show synthetic data in the actual production components, rendered in headless Microsoft Edge. An isolated Vite harness under ignored `node_modules/.cache/customers-pilot` intercepts HTTP and rejects writes. It is not part of the production entry point, authentication, or build. The normal application still requires its existing backend and authentication.

| Review                          | Evidence                                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Before                          | [Customers](premium-pilot/before-desktop.png), [dialog](premium-pilot/before-dialog.png)                                                                                                                                                               |
| Customers, all requested widths | [1920](premium-pilot/customers-1920.png), [1440](premium-pilot/customers-1440.png), [1280](premium-pilot/customers-1280.png), [1024](premium-pilot/customers-1024.png), [768](premium-pilot/customers-768.png)                                         |
| Forms                           | [Create](premium-pilot/customer-create.png), [edit](premium-pilot/customer-edit.png), [validation](premium-pilot/customer-validation.png), [1024 dialog](premium-pilot/customer-create-1024.png), [768 dialog](premium-pilot/customer-create-768.png)  |
| Directory states                | [Archived](premium-pilot/customers-archived.png), [no results](premium-pilot/customers-no-results.png), [loading](premium-pilot/customers-loading.png), [empty](premium-pilot/customers-empty.png), [request error](premium-pilot/customers-error.png) |
| Confirmation and menus          | [Archive](premium-pilot/customer-confirmation.png), [recoverable failure](premium-pilot/customer-archive-error.png), [account menu](premium-pilot/account-menu.png)                                                                                    |
| Shared controls                 | [Default](premium-pilot/components-default.png), [focus](premium-pilot/components-focus.png), [selected option](premium-pilot/selected-option.png)                                                                                                     |
| Sales Orders                    | [Desktop](premium-pilot/orders-1440.png), [landscape tablet](premium-pilot/orders-1024.png)                                                                                                                                                            |
| Purchase Orders                 | [Desktop](premium-pilot/purchases-1440.png), [landscape tablet](premium-pilot/purchases-1024.png)                                                                                                                                                      |
| Inventory                       | [Desktop](premium-pilot/inventory-1440.png), [landscape tablet](premium-pilot/inventory-1024.png)                                                                                                                                                      |
| Incoming deliveries             | [Desktop](premium-pilot/incoming-deliveries-1440.png), [landscape tablet](premium-pilot/incoming-deliveries-1024.png)                                                                                                                                  |
| Outgoing deliveries             | [Desktop](premium-pilot/outgoing-deliveries-1440.png), [landscape tablet](premium-pilot/outgoing-deliveries-1024.png)                                                                                                                                  |
| Complex surfaces                | [Sales composer](premium-pilot/sales-composer.png), [order detail drawer](premium-pilot/order-detail.png)                                                                                                                                              |

The non-Customers screens are **shared-foundation smoke checks**, not completed domain redesigns. Delivery fixtures cover empty directional lists, not populated delivery lifecycle views. The detail drawer is mounted independently in the review harness. Each management module and complex overlay still needs its own approved layout pass.

Browser checks covered 18 layouts and 11 actual Inter font probes, with no document-level horizontal overflow or unhandled browser exceptions. Touch was emulated at 1024 and 768px. The checks exercised name sorting, next/previous pagination, active/archive filtering, search/clear, create/edit, phone validation, Escape/focus return, account-menu opening, and recoverable archive failure without live writes. Dialogs scroll within the viewport. Evidence: [geometry, fonts, interactions, OS preferences](premium-pilot/checks.json).

## Verification and accessibility

| Check                           | Before this checkpoint | Final result                               |
| ------------------------------- | ---------------------- | ------------------------------------------ |
| ESLint                          | Pass                   | Pass                                       |
| Unit tests                      | 47 pass                | 47 pass                                    |
| Component tests                 | 105 pass / 9 files     | 108 pass / 10 files                        |
| TypeScript and production build | Pass                   | Pass (`npm run build`, including `tsc -b`) |

The full component suite used `npx vitest run --no-file-parallelism`. The three additional cases cover loading/stale-record semantics and the two class-merging regressions. The latter were reproduced as failing tests before the fix. A temporary 36px compact-button change broke two existing delivery action assertions; restoring the established 32px size resolved them without rewriting their expectations.

Build verification used the existing required `VITE_API_BASE_URL=https://example.test` environment guard. This does not validate any live backend. The existing JavaScript chunk warning above 500kB remains; bundle splitting is outside this visual checkpoint.

Twenty sampled computed foreground/background pairs passed their applicable thresholds: body text 16.35:1, supporting text 6.55:1, white text on filled actions 5.49:1, selected navigation icon 4.91:1, input border 3.38:1, and focus indicators 5.49:1. The large brand logo is 3.34:1; small text uses the darker green. Full pairs and tested hover/pressed/selection states: [contrast evidence](premium-pilot/contrast-checks.json). Disabled controls are displayed but exempt from these minimum-contrast assertions. Structural separators are not presented as input boundaries.

The shared class-merging and mixed OS-dark/light defects were fixed and verified in actual rendering. This is sampled accessibility verification, not a claim of complete WCAG conformance. Existing legacy status colors, small text, and complex-domain overlays still need a complete audit during phases 5–7.

A fresh independent review inspected the scoped source, font provenance, error/focus tests, and eight representative screenshots. It found no material pilot-blocking defects and recommended presenting the pilot for visual approval. Its separate targeted run passed 11 tests across three files; this does not establish application-wide visual conformance.

## Skills and conventions used

Read and applied the repository's `frontend-design`, `shadcn`, `impeccable`, and `frontend-only-workflow` skills, applicable engineering/frontend/spacing rules, Ponytail, and the relevant Superpowers planning, debugging, verification, and independent-review workflows. The daisyUI guidance was read; the explicit brief's existing-shadcn/no-second-framework requirement takes precedence, so daisyUI was not installed or introduced. Impeccable's detector produced the expected Inter overuse advisory; the user's explicit Inter requirement takes precedence over that aesthetic heuristic.

## Remaining work and limits

- Await explicit Customers visual approval before phase 5. The [repository screen inventory](CUSTOMERS-PILOT.md#repository-screen-checklist) lists the management modules, auth surfaces, shared overlays, and dormant screens to inspect.
- Phase 5: domain-specific hierarchy, tables, controls, and redundant wrappers across Sales, Purchases, Logistics, Staffing, and Administration.
- Phase 6: order composers, delivery forms, and detail drawers still contain legacy small text, status treatments, and nested panels. The shared improvements are visible, but these layouts are not signed off.
- Phase 7: populated domain states, full responsive/accessibility consistency review, and regression verification after rollout.

No backend, API, dependency, business calculation, authentication, or workflow changes were made for this checkpoint. No commit, push, or deployment was performed. Pre-existing unrelated working-tree changes were preserved.

Not checked: real backend mutations/authentication, physical devices, full screen-reader operation, every management-domain state, or production hosting/CSP behavior. The local font introduces a 352KB static asset; deployment must serve it with the other public assets. Application-wide completion remains dependent on the requested pilot approval and subsequent phases.
