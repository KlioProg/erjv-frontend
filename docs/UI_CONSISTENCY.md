# ERJVPOS — Frontend UI Consistency Standard

**Status:** Canonical development standard; measured implementation values pending visual approval

**Applies to:** All frontend management screens, reports, dashboards, and future UI changes

**Implementation reference:** Current Suppliers and Sales Orders pages and their shared components

**Updated:** November 11, 2026 — Phase A foundations and Phase B shared patterns

> This file is a design standard, not an automated guarantee. Shared components, code review, tests, and visual checks must enforce it. It must not override backend business rules or the repository's higher-priority instructions.

## 1. Purpose

ERJVPOS is an inventory, financial monitoring, purchasing, sales, and delivery management system. Keep the interface consistent, readable, and predictable for business owners, office staff, warehouse employees, and users who are less comfortable with technology.

**Rules:** Familiar patterns before novel layouts; one clear primary action; show secondary controls only when useful; minimize duplicate text and containers; preserve data integrity and accessibility. Consistency means shared visual language, **not** identical functionality in every module.

### 1.1 Authority and scope

This is the single normative UI development document for shared primitives, pages, forms, tables, navigation, dialogs, menus, feedback, native controls, third-party wrappers, portals, and loading/empty/error states. [UI_GUIDELINES.md](../UI_GUIDELINES.md) and [SPACING_GUIDE.md](../SPACING_GUIDE.md) are reference entry points, not competing standards.

- [AGENTS.md](../AGENTS.md), explicit user requirements, and higher-priority repository instructions retain precedence. The approved direction in `AGENTS.md` is white-first shadcn/ui New York, Inter where available, graphite text, restrained neutral surfaces, 4px-based spacing, compact desktop operations, and usable landscape-tablet controls.
- [src/index.css](../src/index.css) contains the implemented font and semantic theme definitions through Tailwind's `@theme inline`, `:root`, and `.dark`. [Shared UI components](../src/components/ui) own reusable presentation and supported APIs. Domain components own labels, permissions, validation, status mappings, and business actions.
- **Implementation baseline** means a source-observed value, not owner approval of every existing style or proof of browser accessibility. Reuse current shared components while a decision is pending. Do not silently normalize them to an older document, invent a new page structure, or replace working components solely for visual preference.
- Phase A consolidated documentation. Phase B refines shared presentation and interaction rules; page-specific migrations from F02–F10 require separately scoped implementation and validation. Standards do not authorize those migrations automatically.

### 1.2 Evaluation and delivery process

Use **UX Honeycomb** as the primary evaluation framework: useful (supports the real task), usable (clear controls and recovery), desirable (coherent presentation), findable (predictable navigation and search), accessible (keyboard, labels, contrast, and responsive access), credible (truthful status and data completeness), and valuable (less effort without losing business capability).

Use **BASIC — Beauty, Accessibility, Simplicity, Intuitiveness, Consistency** to review visual and interaction choices. These are evaluation lenses, not permission to introduce another library or override the approved application direction.

Apply **Lean UX: Think → Make → Check** proportionally: inspect existing patterns and evidence; implement the smallest authorized change using them; validate the affected behavior, accessibility, and rendered states. Apply this to each scoped checkpoint; recording a baseline does not approve all its values. Do not invent interviews, broad redesigns, or extra approval gates for routine work whose requirements are already clear.

### 1.3 Information hierarchy, repetition, and feedback

Every visible element must serve a distinct operational purpose. Record details normally show: **identity and current status → compact lifecycle when meaningful → one concise operational explanation → relevant details/quantities → contextual actions**. Preserve verification, audit, inventory, and financial information even when a short summary appears elsewhere.

- Do not place several prominent components beside one another just to repeat the same status, record number, date, quantity, or instruction. A status badge, milestone, and banner saying the same thing need one clear presentation, not three. Retain distinct warnings, error recovery, audit events, and useful explanations.
- Use one clear primary action per interaction context. Do not duplicate it in a body banner and the same dialog's footer. A list shortcut, record-detail action, and informed confirmation can be separate useful contexts; frequent operational quick actions are legitimate exceptions.
- Keep wording short, natural, and specific. Explain a consequence or exception once where it helps the employee decide what to do. Avoid repeated “what happened / current state / next step” panels for the same event.

| Message role | Purpose and placement |
| --- | --- |
| Current status | Persistent authoritative state beside record identity, normally `StatusBadge`; not a success announcement on every render |
| Temporary success | A toast or concise saved-operation confirmation; brief repetition of the changed state is useful feedback that a deliberate action succeeded |
| Persistent warning | A distinct unresolved risk or constraint; retain near the affected information/action until resolved |
| Validation error | Explain the invalid field or rejected operation and recovery; associate it with the control/operation rather than disguising it as status |
| Operational instruction | One concise explanation of the current situation or useful next action; avoid a decorative banner merely restating the badge |
| Historical activity | Actual recorded events, timestamps, quantities, and outcomes for verification; do not replace history with inferred progress |

Do not automatically deduplicate messages by matching strings or labels: only the domain can establish whether two messages mean the same thing. “Notebook-inspired” means restrained structure, compact reading order, and deliberate space; it does not authorize a new font, color, paper texture, decorative ruling, or branding decision.

## 2. Canonical management-page hierarchy

Follow the **Suppliers / Sales Orders** hierarchy wherever the screen is a record-management list:

1. **PageHeader:** Title then one concise description.
2. **Optional category/status tabs:** e.g., Active / Archived, or All / Incoming / Outgoing. Use existing `StatusTabNav` / `ArchiveTabNav` styling.
3. **PageToolbar outside the table:** Search on the left, primary action on the right when applicable. Search should not fill the entire desktop width by default.
4. **One standalone DataTable:** Only data belongs inside its bordered table wrapper; do not nest search, page filters, or create actions inside it.
5. **One compact pagination footer:** Beneath the corresponding table, aligned consistently.

```text
Page title
One-line description
[Category tab] [Category tab] [Category tab]  (if needed)
[Search records...                 ]                 [Primary action]
┌─────────────────────────────────────────────────────────────┐
│ Record          Name             Status              Action │
│ ...             ...              ...                 ...    │
└─────────────────────────────────────────────────────────────┘
                                       Rows [50] Page 1 [‹] [›]
```

The Dashboard and Financial Reports are specialized overview/analysis screens, but must share page-header sizing, typography, padding, borders, buttons, tabs, and spacing rhythm.

## 3. Reuse existing components

| Use case | Preferred component/pattern |
| --- | --- |
| Page composition and summaries | [ManagementPage, PageHeader, PageToolbar, PageOverview](../src/components/ui/ManagementPage.tsx); pages retain domain composition |
| Status/category tabs | [StatusTabNav](../src/components/ui/StatusTabNav.tsx) / [ArchiveTabNav](../src/components/ui/ArchiveTabNav.tsx); meaningful labels and consistent selected states |
| Records | [DataTable](../src/components/ui/data-table.tsx); domain columns and behavior, shared geometry |
| Paginated management lists | [DataTableFrame and DataTableFooter](../src/components/ui/DataTableFooter.tsx) with existing cursor hooks; preserve source cursors rather than duplicating pagination state |
| Row actions | [DataTableActions](../src/components/ui/DataTableActions.tsx); feature permissions and confirmations |
| Routine status | [StatusBadge](../src/components/ui/StatusBadge.tsx); domain labels and tone mapping |
| Record details | [MovementDetailHeader and MovementDetailFields](../src/components/deliveries/shared/MovementDetailLayout.tsx) where the record anatomy fits; preserve specialized order/report details |
| Compact lifecycle in details | [LifecycleProgress](../src/components/ui/LifecycleProgress.tsx); explicit typed milestone states, no domain inference; see section 3.2 |
| Forms and inputs | Existing `Input`, `Label`, `Textarea`, `Select`, `SearchableDropdown`, and domain field wrappers; use their actual installed APIs |
| Date/time | [DateTimeField](../src/components/common/DateTimeField.tsx) and [Manila schedule utilities](../src/lib/manila-schedule.ts); preserve timestamp precision when an existing schedule is unchanged |
| Dialogs and action footers | [Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter](../src/components/ui/dialog.tsx); existing [DeliveryFormDialog](../src/components/deliveries/shared/DeliveryFormDialog.tsx) for compatible delivery forms |
| Destructive confirmation | [ConfirmDeleteModal](../src/components/ui/ConfirmDeleteModal.tsx) or existing domain confirmation for business-specific consequences |
| Empty/loading/error feedback | Existing DataTable states, `Skeleton`, `Alert`, and `Toaster`; specific messages and recoverable errors |
| Other families | Existing `Card`, `Tabs`, `DropdownMenu`, `Tooltip`, `OverflowValue`, avatars, and notification wrappers; inspect before adding alternatives |
| Financial details | Existing Financial Reports components and API-derived calculations |

Do not introduce a second tab styling system, duplicate cursor state management, or a new DataTable framework without a demonstrated need. Avoid rewriting unrelated pages to achieve simple visual consistency.

### 3.1 Forms, dialogs, and action footers

- Reuse shared field controls with visible labels, explicit units and required indicators, and associated helper/error text. Preserve all domain validation. For quantity/price inputs, prefer compact widths around 100–140px where the value fits; allow growth for long values and small-screen readability. Do not stretch every numeric field across its container.
- Use existing unit options and formatting. Do not invent a unit-dropdown component or conversion rule when the domain already defines one. Align quantity decrement/input/increment controls on one center line and share recurring presentation without moving stock limits out of the domain.
- Schedule editing uses 24-hour **HH:mm** and explicit **Asia/Manila** wall-time conversion. `DateTimeField` accepts complete four-digit time entry and preserves partial edits. Date-only fields remain date-only. Transfer filters currently use native `datetime-local`; this is an implementation difference for later review, not authorization to change filter semantics here.
- Keep dialog title, description, record status, body sections, and footer clearly ordered. Reuse `MovementDetailLayout` where appropriate rather than creating another generic record-detail system. Width follows the task: a confirmation, record detail, and item composer may legitimately differ.
- Keep content within the viewport. For long forms/details, use the established fixed-header/footer and scrolling-body composition where suitable; keep actions reachable, avoid nested competing scroll areas, and align header/body/footer insets. Do not duplicate these rules in every call site when an existing wrapper fits.
- Put one clear primary action in `DialogFooter`; secondary actions remain subordinate. Base `DialogFooter` reverses its stack on narrow screens and aligns actions right on desktop; domain wrappers may adapt the composition. Preserve logical reading/focus order, form submission behavior, and dialog close/focus restoration.
- Use explicit consequence labels such as **Save Draft**, **Send Trip**, **Receive Goods**, and **Record Results**. Distinguish dismissing an editor from cancelling a saved operation. Destructive confirmation names the record and consequence; pending writes prevent duplicate submission and unsafe dismissal using existing busy/close behavior.
- Keep dimensions stable through hover, selected, disabled, error, and loading states; reserve room for loading indicators. Preserve unsaved input through recoverable errors and refreshes where existing workflows support it.
- Match adjacent search/filter/action control heights within a row using the existing shared role. Reserve compact variants for secondary dense controls; preserve explicit domain adaptations rather than forcing every control to one size.

### 3.2 Compact lifecycle pattern

`LifecycleProgress` is a small presentational primitive for record details: a horizontal ordered list, thin neutral connecting lines, 16px milestone markers, short labels, and explicit **complete / current / upcoming / cancelled** states. It has no numbered blocks, enclosing background panel, per-stage descriptions, decorative animation, percent-complete bar, or action controls. Long sequences scroll locally; labels wrap within their milestone. The list is keyboard-focusable for native horizontal scrolling and has visible focus; milestones do not become navigation buttons. It renders nothing for an empty sequence.

The caller supplies stable IDs, a meaningful list label, and each milestone state, with at most one current milestone. The primitive does not advance earlier milestones from an index, infer completion from a later stage, or interpret backend statuses. An ordered list exposes sequence, `aria-current="step"` identifies an explicitly current stage, hidden state text and check/cancel symbols convey more than color. It avoids repeating a state already used as the milestone label and does not invent an interactive step-navigation contract.

Domain adapters must preserve these distinctions: READY is not In Transit; dispatched is not Delivered; partial fulfillment is not complete; scheduled arrival is not receipt; unrecorded results are not failure; cancellation is not successful completion. Multiple outgoing deliveries may prevent a truthful single linear lifecycle. Keep authoritative per-delivery quantities and outcomes available; omit or qualify the lifecycle when it cannot express them accurately.

Phase B establishes and tests the shared pattern only. Existing `OrderDetailDrawer` and domain-specific `DeliveryTimeline`, `SalesOrderProgress`, and `PurchaseReceivingProgress` retain their current implementations. Replacing the Sales Order stepper and introducing a Purchase Order lifecycle where truthful belong to Phase C. Both consume the same presentational primitive through **separate domain adapters**; never reuse the Sales Order state interpretation for purchases. The direction is authorized by the Phase B brief; rendered appearance is still unverified until browser review.

Purchase Orders currently expose `DRAFT`, `CONFIRMED`, `PARTIALLY_RECEIVED`, `RECEIVED`, and `CANCELLED`. These describe purchasing and receipt fulfillment, not customer dispatch/delivery. Keep partial receipt visibly partial and cancellation distinct from successful receipt. Scheduled incoming deliveries are separate saved shipment records, not a new Purchase Order state or proof of goods arriving. One completed incoming delivery does not establish that the whole order is received. Use backend-authoritative order state and recorded receipts across all linked deliveries; unknown/incomplete receipt data must not appear as confirmed zero. Preserve accepted-quantity fulfillment calculations and show damaged/quarantined quantities separately without counting them as accepted goods or changing accounting.

## 4. Foundations and implementation baseline

The values below record the current shared source, with pixel equivalents at a 16px root size. They are **pending visual approval**, not a mandate to copy arbitrary legacy overrides. Explicit utilities and domain variants can override inherited defaults; inspect the component, CSS cascade, and rendered result before claiming its effective size.

### 4.1 Brand conflict and semantic color roles

| Evidence | Meaning and decision status |
| --- | --- |
| `AGENTS.md` names brand green `#80B918`; current `--primary` is `#80b918` | Existing repository-approved direction and implemented token. Phase A records this evidence; it does not issue a new brand decision. |
| Earlier `docs/UI_CONSISTENCY.md` named reference green `#6A994E` | Conflicting historical guidance. It is not the current `--primary`, `--primary-text`, or filled-action token. **Owner confirmation is still required to retire or assign a role to this reference.** Do not apply it to features or replace theme values based on this document. |
| Light `--primary-foreground: #1c211d`; `--primary-contrast: #4d7337` paired with white | Existing distinct brand-fill and readable filled-action roles. Default `Button` uses the darker contrast role; lime is not a universal button fill. |
| Light `--background` / `--card`: white; `--foreground: #1c211d`; dark background `#141210`, card `#1c1a18` | Actual surfaces. Older claims of `#fafafa` pages and a uniform true-gray palette do not describe the current theme. Any palette harmonization needs a separate decision. |

Preserve current theme values until an authorized palette change. Consume roles rather than copied values:

| Purpose | Existing semantic roles |
| --- | --- |
| Page, card, floating content | `background/foreground`, `card/card-foreground`, `popover/popover-foreground` |
| Supporting surfaces and text | `secondary/secondary-foreground`, `muted/muted-foreground`, `accent/accent-foreground` |
| Brand text and actions | `primary`, `primary-text`, paired primary foregrounds, `primary-contrast`, and shared hover/active/disabled variants; `text-primary` uses the separate text role |
| Selected and subtle brand cues | `primary-selected`, `primary-subtle`; do not introduce duplicate tint names |
| Feedback | `status-info`, `status-warning`, `status-success` and each matching foreground; destructive text/action roles for errors and destructive actions |
| Lines and focus | `border-border` for structure, `border-input` for editable controls, `ring-ring` for focus |

- Define theme-dependent values centrally in `:root` / `.dark` and expose reusable roles through `@theme inline`. Do not add unused custom properties, another feature palette, raw colors, or independent `dark:*` recoloring for a standard role. Brand artwork may retain its established colors without becoming a feature palette.
- Put new reusable visual tokens in `src/index.css` and reusable variants in shared components. Do not create a second stylesheet or per-feature visual scale to bypass them.
- Pair foreground/background roles deliberately; check light/dark, hover, pressed, selected, disabled, and validation states. Dark text on lime and white on the darker action role are different pairings. Status labels and icons must convey meaning without color alone.
- Routine statuses use `StatusBadge appearance="subtle"`: neutral fill/text and a decorative semantic dot. Features own labels and tone mappings; use neutral for draft/idle. `showDot={false}` is appropriate when text is sufficient and density warrants it. Use `appearance="emphasis"` for attention states such as critical stock alerts. Historical cancellation is not itself a destructive button.
- `StatusBadge` accepts text or React-node labels for responsive domain wording. Callers may control visibility/wrapping while retaining shared geometry; they must not rebuild the badge to do so.
- Do not duplicate status pill markup or invent decorative permission-role palettes. Generic `Badge` currently defaults to the primary-contrast fill, **not neutral**; use an appropriate existing explicit variant for metadata. This distinction corrects an inaccurate older implementation claim without changing the component.
- Configure charts, SVGs, native controls, and third-party UI through shared tokens/wrappers when that role is in scope. The current `Toaster` wrapper applies semantic classes; older claims of a fully configured Sonner CSS-variable/elevation system are not evidence that such a system exists.

### 4.2 Typography and component sizes

| Role | Current shared implementation | Reference |
| --- | --- | --- |
| Font | Self-hosted variable **Inter**, system sans fallbacks; `--font-mono` aliases `--font-sans` | `src/index.css`; older Plus Jakarta Sans guidance is superseded by current code and `AGENTS.md` |
| Base UI role | `--text-ui: 0.8125rem` (13px); `.ui-typography` / `.ui-text` set inherited base size; explicit `text-sm` content is 14px | `src/index.css` |
| Page title / description | **22px / 32px**, semibold; 8px title-to-description gap; description `text-ui` / 20px | `PageHeader`; preserve pending visual approval |
| Dialog title | 20px, semibold, line-height 1.4 through `.ui-dialog-title` | `dialog.tsx`, CSS; inspect the cascade before relying on call-site line-height utilities |
| Section/card title | 16px / 24px, semibold | `CardTitle` |
| Labels and helper text | Shared `Label` uses UI size / 20px, medium; helpers/metadata commonly use 12px / 16px | `label.tsx`, domain wrappers; not every legacy label is normalized |
| Standard controls | `Button`: 40px, horizontal padding 16px; `Input` / `SelectTrigger`: 40px, horizontal padding 12px | Existing variants; explicit text utilities may differ from inherited UI size |
| Compact, icon, large buttons | `sm`: 32px with 13px UI text; `icon`: 36px square; `lg`: 44px with 14px text and 24px horizontal padding | `button.tsx`; table actions use 32px controls |
| Toolbar | `PageToolbar`: 12px gap, wrapping/stacking; search first child capped at 24rem; inputs/buttons at least 40px with UI text | `ManagementPage.tsx`, `.management-toolbar` |
| Navigation and select options | Sidebar links / `StatusTabNav` / select options commonly 36px minimum; coarse-pointer adaptation 44px | Existing navigation and select components |
| Textarea | 80px minimum, `px-3 py-2`; preserve usable resizing/content access | `textarea.tsx` |
| Coarse-pointer controls | Shared button/input/select controls at least 44px tall; shared row icon actions 44px square | Existing pointer adaptations; verify actual hit areas in the affected UI |

Use semantic typography roles consistently. Keep labels in sentence case, avoid decorative uppercase/tracking in table headings, and use `tabular-nums` for quantities, prices, totals, and comparable counts. Keep the app font rather than adding a monospace face. Supporting text uses muted color rather than shrinking to 10px or 11px. Do not invent feature font sizes; normalize a recurring role through its shared owner in an authorized implementation task. A consistent 16px mobile input-text variant may be justified for readability/browser behavior, but is not a global size change made by Phase A.

### 4.3 Spacing, proximity, borders, and elevation

The approved direction is a **4px-based layout grid**. Use routine steps **4, 8, 12, 16, 24, 32px**, choosing space by relationship. Parts of one value stay closer than sibling items, and sibling items closer than separate groups. Preserve this grouping when wrapping on mobile.

| Relationship | Guidance |
| --- | --- |
| Primary and secondary cell text / parts of one message | Usually 4px; keep metadata attached to its value |
| Icon/label and label/control | Usually 8px; shared components may retain existing compact exceptions |
| Compact subgroups / related controls | 8–12px, using the existing wrapper; `PageToolbar` currently uses 12px |
| Form rows / related content blocks | Usually 16px; helper/error text remains closer to its own field |
| Independent sections | Usually 24px; 32px for broader page separation when needed |
| Shell padding | Existing `DashboardLayout`: 16px mobile / 32px from `sm`, maximum content width 1600px; do not add a second page-sized inset |
| Cards and dialogs | Current Card sections use 20px padding with composed `pt-0`; base Dialog uses 24px padding and 20px gap. Record-detail wrappers intentionally own their insets. Align header/body/footer edges. |

Use flex/grid gaps for siblings; avoid simultaneous margin and gap for the same relationship. Do not spread metadata apart to fill tall records. A useful spacing value does not justify empty bands, decorative nested cards, or expansive empty panels. Distances of 48/64px, and especially 80/120px, require an intentionally spacious composition and a documented reason outside routine operational layouts.

The grid governs ordinary layout, not every measurement: type, 1px borders, 2px focus rings, token radii, badge vertical padding, content-driven column widths, and existing compact shared details are explicit exceptions. Existing `gap-1.5` / `p-3.5` do not authorize new feature-specific scales, and Phase A does not rewrite them.

- Structural borders use the shared 1px border role; editable controls use `border-input`. Use one container boundary and shared row/section separators, avoiding doubled borders around DataTables. Shared state/selection variants may use their existing semantic treatments.
- Current radius tokens: surface `--radius` / `rounded-lg` 8px, `rounded-md` 6px, `rounded-sm` 4px; larger named radius tokens currently alias 8px. Base Dialog is an existing explicit **10px** exception. Generic badges use `rounded-md`, not a universal full pill.
- Keep elevation restrained and owned by shared components. Current Cards have no default shadow; Dialog uses `shadow-xl`, menus use their existing utilities. The older `shadow-card`, `--card-shadow`, four-level theme elevation scale, and shadow-alias claims are **not implemented in current `index.css`**. Do not reference them as installed tokens or introduce them without a scoped decision.
- Use 16px action/navigation icons and 20px section icons where existing roles fit; let shared controls size their children. Do not resize icons individually in equivalent controls. Preserve visible focus independently of borders and shadows.

### 4.4 Superseded measurements and pending decisions

The older guides proposed a 24px page title, 18px dialog title, universal 14px body/control and 12px label/table roles, 56px body rows / 64px editable rows, 16px-mobile / 24px-desktop card/dialog padding, 96px textareas, fully rounded badges, 40px navigation/menu targets, and 56px notification rows. These are **historical proposals, not the measured baseline or silently adopted requirements**. The current values above and in section 6 take precedence for preserving existing presentation while owner visual approval and any later shared-component changes are pending.

Owner review must resolve the historical `#6A994E` reference against the existing approved `#80B918` direction, confirm the 22px title and compact table baseline, and decide whether any historical size/surface/elevation proposals warrant implementation. Record a decision and its affected roles here before changing shared defaults. Recording historical proposals does not authorize runtime normalization.

### 4.5 Other component families

The same semantic and proximity rules apply beyond tables and forms. Reuse the installed wrapper rather than defining another scale for an unlisted family.

| Family | Presentation and behavior to preserve |
| --- | --- |
| Sidebar, tabs, breadcrumbs | Meaningful current-location/selected cues, consistent icon alignment, wrapping or intentional scrolling, and permission-aware destinations; use the dashboard shell |
| Cards and summary panels | Shared section-title/body/helper roles; purposeful grouping, aligned header/content/footer edges, and no redundant decorative nesting |
| Dropdowns, select results, search lookups | Shared item geometry, visible focus/selection, viewport-safe popovers, long-value access, and usable touch targets; do not add a new select solely for visual preference |
| Tooltips and overflow popups | Helper-size readable text, semantic popover colors, wrapped long content; full values available on keyboard focus as well as hover |
| Badges and counters | Shared label/metadata geometry, no per-feature font/radius overrides; color is not the only meaning |
| Alerts, banners, toasts | Clear message and optional title, tight title/message and icon/content grouping, semantic feedback pairs, and recovery action where needed; configure library presentation in its wrapper |
| Empty and loading panels | Specific first-use or no-results explanation; preserve surrounding layout and action access, avoid giant placeholder panels, and never present a failed query as an empty result |
| Lists and notifications | Readable primary text and helper metadata, related controls grouped closely, rows allowed to grow for multiline content and touch targets |
| Charts and metric summaries | Shared title/metadata roles and purposeful card grouping; dimensions follow data/layout, legends identify series beyond color, and exact values remain accessible |
| Avatars, checkboxes, decorative symbols | Existing primitive sizing and adjacent text roles; enlarge the hit target without enlarging every glyph, and hide purely decorative symbols from assistive technology |

Portal and third-party content follows these rules too. Define a recurring new role at its shared owner only when existing roles cannot meet a functional or accessibility need; document the reason and avoid unsupported props or imports.

## 5. Search, filtering, and sorting

- Main search appears **outside and above** the DataTable, under optional tabs.
- Search placeholders must describe fields supported by the actual API.
- Use tabs for primary categories that users frequently switch between.
- For optional field filters, use a compact labeled popover or small filter icon next to **relevant** column headings, not every heading.
- Never add an expanding full-width **More filters** area that pushes the table down.
- Do not duplicate the same filter as both a main category tab and a column-header filter.
- A filter/sort must operate on the authoritative full query scope. If only loaded-page filtering is possible, avoid misleading controls or explicitly label the limited scope.
- Changing query scope resets relevant cursor pagination without clearing unrelated inputs. Indicate active filters and offer a clear reset when helpful.

## 6. Table and pagination standard

### 6.1 Record-management versus operational tables

Ordinary management lists prioritize **actionable record identifier → associated entity → important quantity/amount → current status/progress**. Make record access explicit and keyboard-accessible, using an existing `OverflowValue` with `onActivate` for an in-app detail dialog, or a native/router link (with `OverflowValue asChild` when overflow disclosure is needed) for navigation. Row clicking is an additional convenience, not the only record-opening control. Nested buttons, links, inputs, and other interactive controls must retain their own action without also triggering the row shortcut.

Do not automatically add an Action column, repeat filled primary buttons on every row, pair a large unrelated CTA with a three-dot menu, or put decorative lifecycle bars into cells. Record details expose contextual actions. A permission-aware secondary menu or compact quick action is acceptable where frequency, discoverability, or safety justifies it.

Operational product pickers, trip-delivery selection, quantity editors, and receiving/result-entry tables retain their useful direct actions. Do not force these task tables into the record-management pattern. Preserve business-specific columns, sorting, filtering, pagination, and permissions.

Phase B establishes this reusable rule for **both Sales Orders and Purchase Orders**; it does **not** remove either action column or migrate either page layout. Phase C has these matching preferred columns:

| Management list | Preferred columns | Details that remain available after opening the record |
| --- | --- | --- |
| Sales Orders | **Order / Customer / Total / Progress** | Customer/destination, ordered items and totals, actual fulfillment across linked deliveries, and valid contextual operations |
| Purchase Orders | **Order / Supplier / Total / Progress** | Supplier, ordered items and quantities, expected date when recorded, actual receiving, partial receipts, damaged/quarantined quantities where applicable, current progress, and valid contextual operations such as Schedule Arrival |

The identifier is an explicit keyboard-accessible record-opening control; clicking non-interactive row content opens the same existing detail view. Retain existing search, filters, tabs, sorting, cursor pagination, page-size behavior, and role-based permissions even when a filter's former display column moves into details. Keep important item information in details rather than relying on table previews or hover alone.

Remove the repeated **Plan Delivery** / **Schedule Arrival** row CTAs and separate three-dot menus in Phase C **only after verifying that every existing authorized operation is reachable through the relevant details**. The target has no unnecessary Action column. Do not retain redundant row controls as a substitute for implementing missing detail operations, and do not remove a secondary action on the assumption that it exists elsewhere. Inventory each list/menu action by record state and permission, wire equivalent detail access using the same callbacks/transitions, and prove parity with tests before removing its row entry. Contextual actions may differ between sales and purchases; sharing visual structure does not merge their workflows.

Neither details view should add an oversized progress panel, repeated confirmation banner, or duplicate primary action. Preserve distinct success feedback, warnings, validation, and audit information under section 1.3. Scheduling an incoming delivery remains a natural **Work → Wait → Resume** stopping point with a saved-record return path; it must not automatically open receiving.

### 6.2 Shared presentation and states

- Management lists use `DataTable appearance="management"`. **Current compact implementation baseline, pending visual approval:** header height 44px with 12px medium text; ordinary body row CSS height 48px; cells use 16px horizontal / 8px vertical padding. Normal DataTable body cells explicitly use 14px text; supporting metadata commonly uses 12px. CSS row height is not a clipping limit: wrapping, controls, errors, and touch targets can make rows taller. Keep desktop values on one line where practical without hiding essential information.
- Current `default` / `subtle` DataTables are not identical in density: ordinary horizontal padding is 8px with 12px edge insets, base `TableCell` padding is 14px, and subtle body cells add 16px vertical padding. Expanded previews have their own shared rules (32px headers, 44px body rows, 12px horizontal / 8px vertical cell padding). Preserve these legitimate contexts until a scoped shared-density decision; do not assume a `density` prop exists.
- The current shared footer uses 12px horizontal / 8px vertical padding, 14px text, 32px navigation controls, and coarse-pointer enlargement to 44px. Older 16px/12px footer padding and 12px text are not the implementation baseline.
- Keep reusable table sizing in `data-table.tsx`, `table.tsx`, and their existing CSS rules. Domain columns may set widths, responsive visibility, wrapping, and state, but must not invent ordinary padding, typography, borders, or per-feature row heights. Inspect direct consumers before changing shared defaults.
- Use `ColumnDef.align` consistently for headers and values: text left, numbers/currency right, status/icon columns centered when appropriate, actions right. Vertically align content; do not interpret “centered” as centering every column. Compact dialog, editable-item, and expanded-detail tables may retain their task-specific composition.
- Use moderately emphasized primary values and `text-xs text-muted-foreground` for supporting values beneath them. Keep business identifiers readable or use the existing accessible `OverflowValue` disclosure.
- Use shared badges and `DataTableActions`; preserve semantic status colors and labels, align action columns right, and keep primary next actions labeled. Feature code owns permissions and workflow decisions.
- The DataTable border encloses the table; its pager appears **directly beneath** it or as its footer, never floating above Inventory/Warehouses tables.
- Use compact visible controls: **Rows [50]  Page 1  [‹] [›]**. Keep accessible descriptions such as “Rows per page”, “Previous page”, “Next page”.
- **For normal paginated management lists, retain the compact footer even on a single page.** Disable unavailable arrows instead of hiding the entire footer because the list is short.
- Do not show fabricated total row counts or “Page 1 of N” for cursor APIs without authoritative totals.
- Preserve page-size defaults/options, cursor navigation, errors, search, and permission handling.
- A composite view combining genuinely independent backend sources may need a different **single** footer (see History). Do not invent a global cursor to force the standard pager onto it.
- Display loading skeleton rows within the normal table geometry; distinguish loading, refreshing, empty, partial, error, and confirmed zero states.
- Reuse `DataTable` for ordinary tabular screens and editable order/purchase/delivery items. Do not recreate header/body/pagination markup or create a competing table unless the existing component fundamentally cannot meet the requirement. Preserve sorting, expansion, pagination, responsive visibility, editing, and row actions before removing old markup. Embedded item tables may use the existing `pagination={false}` API.
- Use `OverflowValue` for clipped values that need full-text access; retain wrapping when essential. Keep first/last header and cell edges aligned. Prefer recognizable compact secondary actions with meaningful labels, focus, and hover/focus disclosure; consequential primary actions remain text-labeled. A clickable row is an optional shortcut, not the only keyboard path to the record.
- Shared default empty content is one concise “No records found.” message, preserving the existing footer and custom domain empty content. Do not add a second generic explanation saying the same thing. DataTable owns table layout; badge geometry belongs to `Badge` / `StatusBadge`, including inside table cells.
- The existing DataTable badge descendant overrides remain a compatibility constraint for legacy page badges. Phase B retains them to avoid exposing inconsistent local sizes before those consumers migrate; remove the shim only after affected page badges use the shared contract and rendered regression checks confirm equivalence. Routine shared status labels allow long text to wrap without pushing the badge beyond its container.

## 7. Delivery Management

**Sidebar:** Deliveries contains Incoming → Outgoing → History. Delivery Trips is a separate top-level destination beside Deliveries and Warehouse Transfers; its existing `/deliveries/runs` route is unchanged.

All four screens follow the management-page hierarchy: consistent title/subtitle; search/actions **outside** the table; standalone table; appropriate footer.

- **Incoming:** Receive supplier goods; preserve scheduling, actual receipts, partial quantities, and permissions.
- **Outgoing:** Prepare customer shipments; preserve READY, run assignment, dispatch, and reconciliation distinction.
- **Delivery Trips:** Group outgoing deliveries and warehouse transfers and manage departure; preserve eligible driver/vehicle, warehouse, capacity, revisions, and membership protections. Backend/API names may still use “runs.”
- **History:** Review terminal incoming/outgoing delivery records; one combined visual table.

### 7.0 Work → Wait → Resume

- Prepare and save efficiently. After confirmed departure or incoming scheduling, show concise confirmation and a way to reopen the saved record, allowing employees to stop naturally. Do not automatically open the receiving/results dialog or pressure staff to enter outcomes early.
- Resume from authoritative saved records, including actual departure, assignments, receipts/results already recorded, and outstanding work. Preserve shared resumption by authorized employees and refresh/revision safeguards. Do not fabricate persisted progress or rely on a previous employee's local state.
- Keep pending/preparing, dispatched/in transit, received, and completed meanings distinct. “Results not recorded” does not mean delivery failed. Record individual delivery results within a trip; show the selected delivery beside the existing single footer action. The backend determines final operation completion.
- Use compact status, summary, messaging, and action placement. Do not add large timelines, redundant progress displays, automatic next-step dialogs, date gates, or new business workflows for visual consistency.

### 7.1 History: All / Incoming / Outgoing

Use the Suppliers-style hierarchy:

```text
Delivery History
Review completed and cancelled deliveries.
[All Deliveries] [Incoming] [Outgoing]
[Search delivery history...]
┌────────────────────────────────────────────────────────────────┐
│ Delivery #  Related Order  Customer/Supplier Direction Outcome │
│ ID-...      PO-...         Supplier A        Incoming  Received│
│ OD-...      SO-...         Customer B        Outgoing  Completed│
└────────────────────────────────────────────────────────────────┘
[One appropriate footer / load-more experience for the displayed view]
```

**Mandatory All-tab behavior:**

1. **ONE unified DataTable**, not two tables, stacked sections, source headings, or nested Incoming/Outgoing components.
2. **One set of column headings**, one search field, one visible result collection, one bottom paging/loading area.
3. **Direction is a visible tab**, not another column-header filter icon. Keep the Direction column as data.
4. A row is uniquely identified by **direction + delivery ID**, to avoid incoming/outgoing ID collisions.
5. Order each newly admitted batch by authoritative event timestamps where available, then preserve visited page boundaries as more batches arrive. Do not claim global event chronology unless both source APIs guarantee an ordering that enables a true merge.
6. The backend currently exposes independent incoming and outgoing cursor states. **Never fake a unified backend cursor or count.**
7. **All tab pagination:** Use one compact Rows / Page / Previous / Next footer over cached, scoped history batches. Keep separate source cursors, fetch at most one further batch per eligible source per uncached Next action, and preserve visited page boundaries. Label these as loaded history pages; do not imply global event chronology or an authoritative total. Reset local navigation on search/filter/direction changes, preserve cached pages for Previous, and make source failures retryable. Never fetch the entire history to construct a page.
8. **Incoming-only/Outgoing-only tabs:** Use the respective source's normal cursor pagination beneath the one table; keep predictable tab/search/reset behavior.
9. Preserve real recorded completion/reconciliation/cancellation dates, source-specific errors and partial states, record detail actions, and permissions.
10. A source failure must not silently look like “no records.” Make any partial combined view clear and recoverable.

## 8. Financial Reports: consistent UI, specialized analysis

Financial Reports must match the **visual hierarchy and controls** of Suppliers/Sales Orders but keep its reporting functionality. It is **not** a generic management records list.

**Approved Financial Reports presentation:**

- Retain the established report filter panel, period navigation, visible date/timezone context, scope summary, and inline Item/Warehouse filter disclosure.
- Use the existing shared `StatusTabNav` appearance for **Annual / Semi-Annual / Quarterly / Monthly / Weekly**. The selected period uses a subtle background, without a separate outlined-button style.
- This analytical-screen exception is intentional. Do not move the report controls into a new toolbar/dialog or hide existing date context merely to match a management list.
- Keep the shared page-header typography, control heights, focus states, responsive wrapping, and semantic theme tokens.
- Preserve the three authoritative KPI cards and **Trends / Details / Calendar**, accounting definitions, snapshots, cost coverage, and material missing-cost warnings.
- Do not alter year/month/week validation, period navigation, timezone boundaries, filtering, or reporting methodology. Estimated gross profit is neither net profit nor Sales minus Purchases.

## 9. Dashboard versus Financial Reports

- **Dashboard:** financial summary, inventory health, actionable issues, and verified recent business activity.
- **Financial Reports:** detailed trends, time periods, item/customer/supplier analyses, breakdowns, calendars, and calculation transparency.
- Shared branding and typography; different information density and interaction needs.

## 10. Accessibility, responsiveness, and stability

Check at **1440×900**, **1366×768**, **768px**, **390px**:

- No page-level horizontal overflow; toolbars and tabs wrap/scroll intentionally.
- Controls retain comfortable touch sizes, visible focus, accessible labels, and keyboard functionality.
- Filter popovers remain in viewport; dialog selection and focus remain stable.
- No silent state resets after search/refresh/pagination; no duplicate mutations; no inaccessible hover-only primary actions.
- Do not force identical column sets or remove necessary functionality just to mimic the Suppliers screen.
- Every action must be reachable and operable by keyboard, with visible focus and logical order. Use native buttons/links and existing Radix semantics; do not turn a row containing controls into nested interactive markup. Keep dialog focus contained while open and restore it on close. Do not remove focus styling to match borders.
- Give each input a meaningful visible label, associate helper/validation messages and invalid state, and identify required fields without relying only on color. Placeholders do not replace labels. Icon-only actions need an accessible name; decorative icons are hidden from assistive technology. Loading and important result/error updates need appropriate announcements.
- Check foreground/background contrast in affected themes and interaction states, plus distinguishable control boundaries. Use text/icons as well as semantic colors. Source tokens or Radix usage alone do not establish accessibility compliance.
- Adapt layout and column visibility before shrinking text or controls. Hide a header and its cells at the same breakpoint; preserve essential values/actions in visible columns or existing expanded content. Permit table-local scrolling without page-level overflow. Coarse-pointer actions need at least 44px usable targets and room for the row to grow.
- Respect reduced motion, browser text scaling, long text, multiline errors, and viewport-safe popovers/dialogs. Validate loading, disabled, selected, error, and focus states without unexpected geometry changes. The implementation's existing reduced-motion rule is not a substitute for checking usable feedback.
- Select representative checks proportionally from the listed viewports; add 375px and 1280px coverage from the older guidelines when those widths expose a relevant wrapping/overflow risk. Verify affected light/dark states. Report unavailable browser checks as unverified, never as passes.

## 11. Business and data integrity

Frontend layout changes must **never** alter backend endpoints, authorization, expected revisions, cursor semantics, financial reporting calculations, inventory quantity meanings, receiving, dispatch, or reconciliation timing. Treat data completeness and snapshot freshness honestly.

## 12. UI review checklist

- [ ] Read this document, inspect the relevant shared component and a comparable domain consumer, and identify the component role before introducing markup or an alternative.
- [ ] Reuse installed APIs and semantic tokens; inspect direct consumers before changing shared defaults. Keep pending baseline decisions distinct from approved changes.
- [ ] Page title/subtitle match shared typography and alignment.
- [ ] Tabs, when present, use the common style and meaningful labels.
- [ ] Search and primary action are outside the bordered table.
- [ ] No redundant nested table/toolbars or full-width More filters expansion.
- [ ] Table rows/actions are clear, readable, keyboard-accessible.
- [ ] Routine status presentation uses `StatusBadge`; domain labels, tones, and business-specific functionality are preserved.
- [ ] Forms have visible labels, units, linked validation, and the existing date/time semantics; dialog headers, scroll regions, footers, close behavior, and focus remain usable.
- [ ] Header filters only exist for supported, useful fields.
- [ ] One appropriate footer beneath each list; no hidden pager for ordinary paginated lists.
- [ ] Delivery History All shows **one truly combined visual table**, not two sections or separate footers.
- [ ] Financial Reports use matching header/toolbar design, with intact period navigation and analytical functionality.
- [ ] Loading, errors, empty results, and incomplete data remain truthful.
- [ ] Domain semantics, permissions, and concurrency protections remain unchanged.
- [ ] Work → Wait → Resume retains natural stopping points, truthful saved summaries, and authorized resumption without automatic next-step dialogs.
- [ ] Review touched JSX/CSS/wrappers for raw colors, arbitrary font/spacing/radius changes, copied status styles, and competing page/table structures; reuse the shared owner or document a justified exception.
- [ ] Responsive/browser checks and focused tests are performed or accurately reported as unverified.

## 13. Team adoption

1. This document at **`docs/UI_CONSISTENCY.md`** is the canonical frontend UI standard.
2. **`AGENTS.md`** directs new and touched UI here while preserving existing repository instructions.
3. For new frontend features and touched pages, reuse existing shared components and follow this standard. Do not replace a working component for visual preference or build a parallel page/table/status system when an existing one fits.
4. Exceptions are acceptable for a distinct workflow, data density, readability, accessibility, or a functional constraint that the existing pattern cannot meet. Record the component/role, concrete reason, changed dimensions/behavior, affected consumers, and validation here when the exception becomes reusable; a local exception must be explained in its scoped change. Preserve defaults for other callers. Visual taste alone is insufficient. Use existing task authorization; an exception does not automatically create an extra permission gate.
5. Apply visual QA and targeted regression tests proportional to scope. Shared changes require direct-consumer review; critical logistics changes retain workflow/permission/revision coverage. Documentation-only changes require contradiction/reference review and `git diff --check`, not unrelated test-suite reruns. Report checks not run and why. This document alone cannot guarantee consistency.
6. Do not perform a massive unrelated style rewrite or auto-commit/push to adopt this standard.
7. Keep this document's foundations, component patterns, page templates, interaction rules, accessibility requirements, and review checklist together. Update source observations after approved implementation changes; update the decision status when owner approval is actually obtained. Do not create parallel governance documents with independent values.

## 14. Phase C findings and both-order implementation scope

The following are source-confirmed page findings, deferred rather than changed by Phase B. Line references describe the Phase B source baseline and may move after future edits.

| Finding | Exact source | Intended change in a separately authorized page checkpoint |
| --- | --- | --- |
| Confirmed status/instruction repeats in milestone and banner | `src/components/orders/OrderDetailDrawer.tsx:241` and `:364` | Keep identity/status and one operational explanation; remove the redundant confirmation banner/panel while retaining required contextual actions |
| Large numbered stepper and ambiguous state mapping | `src/components/orders/OrderDetailDrawer.tsx:109`, `:175`, and `:209` | Replace with `LifecycleProgress` only after a domain adapter accounts for all linked deliveries; remove READY → In Transit inference and the partial-fulfillment header's In Transit wording; preserve partial/cancelled/unknown states |
| Draft and dispatched panels repeat status and three-question instructions | `src/components/orders/OrderDetailDrawer.tsx:287` and `:405` | Condense each to one useful explanation and one action location; preserve consequences, quantities, role gates, confirmations, and natural stopping points |
| Sales row CTA beside secondary menu; identifier not the main opening control | `src/components/orders/OrdersView.tsx:363` and `:477` | Use Order / Customer / Total / Progress, open existing details by identifier and row, and remove Plan Delivery/overflow controls only after all authorized detail actions are verified |
| Purchase row CTA beside secondary menu; extra list previews crowd record access | `src/components/purchases/PurchasesView.tsx:410`, `:475`, and `:504` | Use Order / Supplier / Total / Progress; retain item/expected-date information in details; remove Schedule Arrival/overflow controls only after detail action parity is verified |
| Purchase draft Edit and Cancel exist in the menu but not the detail component API | `src/components/purchases/PurchasesView.tsx:533` and `:552`; `src/components/purchases/PurchaseOrderDetailModal.tsx:26` | Wire draft editing and order cancellation into existing details with their current permission/state gates, confirmation, revision checks, pending behavior, and error recovery before removing menu access |
| Sales details focus on one active delivery while the table menu also offers the order's delivery collection | `src/components/orders/OrderDetailDrawer.tsx:99` and `:492`; `src/components/orders/OrdersView.tsx:520` | Preserve both specific-delivery access and the order-scoped View Deliveries operation in details; review all linked deliveries for partial fulfillment rather than interpreting one active delivery as the whole order |
| Purchase details expose ordered/accepted progress but do not provide a compact lifecycle or explicit per-receipt damaged-quantity summary | `src/components/purchases/PurchaseOrderDetailModal.tsx:177` and `:207`; `src/components/purchases/PurchaseReceivingProgress.tsx:27` | Use an independent purchase lifecycle adapter where states support it; retain accepted/remaining quantities and expose actual receipt/damage context through existing records; propagate loading/incomplete/error state so missing data is not shown as zero |
| Local filled status presentations | `src/components/orders/OrderDetailDrawer.tsx:154`, `src/components/orders/OrdersView.tsx:432`, `src/components/purchases/PurchasesView.tsx:89` and `:348` | Consume `StatusBadge` with domain-owned labels/tones; do not manufacture one universal backend lifecycle |
| Large page-specific empty cards repeat shared table responsibility | `src/components/orders/OrdersView.tsx:635` and `src/components/purchases/PurchasesView.tsx:730` | Use the compact shared empty-state contract with domain-specific first-use/filter wording and unchanged paging/error behavior |

### 14.1 Action-preservation gate

This is the current source inventory, not a claim that the detail views already have complete parity. Check every operation against its existing state and permission rules during Phase C.

| Module | Existing list/menu operations to retain | Current details coverage and required gap closure |
| --- | --- | --- |
| Sales Orders | View Order, Edit Draft, Confirm, Cancel Order, Plan/Continue Delivery, View Delivery, View Deliveries, and the current arrival/result-recording handoff where eligible | `OrderDetailDrawer` exposes edit/confirm/cancel, arrange or remaining delivery, active-delivery access, and result entry where eligible. Preserve the order-scoped delivery collection and test multiple-delivery, read-only, partial, terminal, and cancellation cases; do not assume the active-delivery control covers all linked records. |
| Purchase Orders | View Order, Edit Draft, Confirm, Cancel Order, Schedule Arrival, View Deliveries, Print / Download Purchase Order | `PurchaseOrderDetailModal` already has confirmation, export, Schedule Arrival, and delivery navigation through `PurchaseReceivingProgress`. Draft edit/cancel callbacks are absent and must be wired before removing menu actions. Keep the existing `canManage` and `canConfirmPurchaseOrder` gates and callback-specific eligibility rather than replacing them with one new generic permission rule. |

Existing operations must remain accessible through details after row CTAs/menus are removed. Preserve backend validation, revisions, transition timing, duplicate-write prevention, financial totals, and inventory accounting. Presentation adapters describe saved state; they do not perform transitions or invent persisted data.

### 14.2 Phase C implementation boundary and acceptance

Phase C targets **both order modules**, replacing the earlier Sales-Orders-only recommendation:

- **Sales:** `src/components/orders/OrdersView.tsx`, `src/components/orders/OrderDetailDrawer.tsx`, a pure Sales Order lifecycle adapter in `src/features/crm/sales-orders.presentation.ts`, focused `src/components/orders/order-details.component.test.tsx`, and `src/features/crm/sales-orders.presentation.test.mjs`.
- **Purchases:** the orders section of `src/components/purchases/PurchasesView.tsx`, `src/components/purchases/PurchaseOrderDetailModal.tsx`, `src/components/purchases/PurchaseReceivingProgress.tsx`, an independent purchase lifecycle adapter in `src/features/logistics/purchase-orders.presentation.ts`, focused `src/components/purchases/purchase-order-details.component.test.tsx`, and `src/features/logistics/purchase-orders.presentation.test.mjs`. Preserve the Suppliers section and its independent management operations.
- Reuse `DataTable`, `OverflowValue`, `StatusBadge`, `LifecycleProgress`, and existing dialog/form/action patterns. Keep operational item/selection/result-entry tables efficient. Do not redesign these shared primitives again merely to make the two pages identical.
- Existing order-entry, order/delivery, incoming scheduling/receiving, permissions, and pagination/filter regressions remain required alongside focused adapter, keyboard record-opening, row-click, and detail-action parity tests. Verify long text, partial/unknown data, cancelled records, multiple shipments, and affected responsive layouts. Compare existing suite failures with the recorded baseline rather than assuming new failures are unrelated.

Phase C acceptance requires: (1) matching record-first layouts; (2) no unnecessary repeated primary row CTAs or overflow menus; (3) all authorized operations accessible through details; (4) concise current-state communication without redundant banners; (5) each lifecycle faithful to its own backend states; (6) truthful partial deliveries and partial receipts, with damaged goods distinguished from accepted goods; and (7) existing tests and relevant integration workflows remaining functional. Incoming scheduling must remain a stopping point, with no automatic receiving dialog.

These are Phase C implementation requirements documented during Phase B; they do not start the page migrations. Preserve the Phase A brand conflict and measured-size approval status. Do not change API contracts, business transitions, inventory accounting, or financial calculations to simplify either lifecycle.
