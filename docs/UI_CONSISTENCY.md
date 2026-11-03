# ERJVPOS — Frontend UI Consistency Standard

**Status:** Adopted frontend standard  
**Applies to:** All frontend management screens, reports, dashboards, and future UI changes  
**Visual baseline:** Current Suppliers and Sales Orders pages  
**Updated:** November 3, 2026

> This file is a design standard, not an automated guarantee. Shared components, code review, tests, and visual checks must enforce it. It must not override backend business rules or the repository's higher-priority instructions.

## 1. Purpose

ERJVPOS is an inventory, financial monitoring, purchasing, sales, and delivery management system. Keep the interface consistent, readable, and predictable for business owners, office staff, warehouse employees, and users who are less comfortable with technology.

**Rules:** Familiar patterns before novel layouts; one clear primary action; show secondary controls only when useful; minimize duplicate text and containers; preserve data integrity and accessibility. Consistency means shared visual language, **not** identical functionality in every module.

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
| Titles and subtitles | `PageHeader` |
| Search and page actions | `PageToolbar` |
| Status/category tabs | `StatusTabNav` / `ArchiveTabNav` |
| Records | Existing `DataTable` |
| Paginated lists | `CursorPageControls` with existing `use-cursor-page` logic |
| Inputs/dialogs/buttons | Existing shadcn/ui and app conventions |
| Financial details | Existing Financial Reports components and API-derived calculations |

Do not introduce a second tab styling system, duplicate cursor state management, or a new DataTable framework without a demonstrated need. Avoid rewriting unrelated pages to achieve simple visual consistency.

## 4. Spacing, size, and text

- Match approved management pages for outer padding, title-to-description gap, title-to-tabs gap, tabs-to-search gap, toolbar-to-table gap, table row height, and footer placement.
- Use consistent form-control heights and typography; prefer shared tokens (`text-ui`, existing `h-9`/`h-10` conventions) over page-by-page arbitrary values.
- Use white-first surfaces, graphite/neutral text, subtle borders, restrained rounding, and existing semantic brand tokens. The reference green is `#6A994E`; preserve established project tokens and accessible contrast rather than adding page-specific color overrides. Any palette change belongs in the shared theme.
- Avoid double borders, nested cards around ordinary tables, expansive empty panels, giant icons, multiple paragraph explanations, and technical labels where plain English suffices.
- Show concise action labels: **Receive Goods**, **Assign to Run**, **View Details**. Icon-only secondary actions must have accessible labels.
- Preserve meaningful whitespace without creating empty bands between related controls.

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

- Management lists use `DataTable appearance="management"`: neutral headers, matching 16px horizontal cell padding, 12px vertical body padding, centered content, and shared row hover/focus states. Rows expand with their content; avoid extra padding inside cell renderers. Compact dialog and expanded-detail tables may retain their existing density.
- Use moderately emphasized primary values and `text-xs text-muted-foreground` for supporting values beneath them. Keep business identifiers readable or use the existing accessible `OverflowValue` disclosure.
- Use shared badges and `DataTableActions`; preserve semantic status colors and labels, align action columns right, and keep primary next actions labeled. Feature code owns permissions and workflow decisions.
- The DataTable border encloses the table; its pager appears **directly beneath** it or as its footer, never floating above Inventory/Warehouses tables.
- Use compact visible controls: **Rows [50]  Page 1  [‹] [›]**. Keep accessible descriptions such as “Rows per page”, “Previous page”, “Next page”.
- **For normal paginated management lists, retain the compact footer even on a single page.** Disable unavailable arrows instead of hiding the entire footer because the list is short.
- Do not show fabricated total row counts or “Page 1 of N” for cursor APIs without authoritative totals.
- Preserve page-size defaults/options, cursor navigation, errors, search, and permission handling.
- A composite view combining genuinely independent backend sources may need a different **single** footer (see History). Do not invent a global cursor to force the standard pager onto it.
- Display loading skeleton rows within the normal table geometry; distinguish loading, refreshing, empty, partial, error, and confirmed zero states.

## 7. Delivery Management

**Sidebar order:** Incoming → Outgoing → Delivery Runs → History.

All four screens follow the management-page hierarchy: consistent title/subtitle; search/actions **outside** the table; standalone table; appropriate footer.

- **Incoming:** Receive supplier goods; preserve scheduling, actual receipts, partial quantities, and permissions.
- **Outgoing:** Prepare customer shipments; preserve READY, run assignment, dispatch, and reconciliation distinction.
- **Delivery Runs:** Group outgoing deliveries and manage trip dispatch; preserve eligible driver/vehicle, warehouse, capacity, revisions, and membership protections.
- **History:** Review terminal incoming/outgoing delivery records; one combined visual table.

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

## 11. Business and data integrity

Frontend layout changes must **never** alter backend endpoints, authorization, expected revisions, cursor semantics, financial reporting calculations, inventory quantity meanings, receiving, dispatch, or reconciliation timing. Treat data completeness and snapshot freshness honestly.

## 12. UI review checklist

- [ ] Page title/subtitle match shared typography and alignment.
- [ ] Tabs, when present, use the common style and meaningful labels.
- [ ] Search and primary action are outside the bordered table.
- [ ] No redundant nested table/toolbars or full-width More filters expansion.
- [ ] Table rows/actions are clear, readable, keyboard-accessible.
- [ ] Header filters only exist for supported, useful fields.
- [ ] One appropriate footer beneath each list; no hidden pager for ordinary paginated lists.
- [ ] Delivery History All shows **one truly combined visual table**, not two sections or separate footers.
- [ ] Financial Reports use matching header/toolbar design, with intact period navigation and analytical functionality.
- [ ] Loading, errors, empty results, and incomplete data remain truthful.
- [ ] Domain semantics, permissions, and concurrency protections remain unchanged.
- [ ] Responsive/browser checks and focused tests are performed or accurately reported as unverified.

## 13. Team adoption

1. This document at **`docs/UI_CONSISTENCY.md`** is the canonical frontend UI standard.
2. **`AGENTS.md`** directs new and touched UI here while preserving existing repository instructions.
3. For new frontend features and touched pages, reuse existing shared components and follow this standard.
4. A justified deviation is allowed for a distinct workflow; document why instead of mechanically forcing everything into the same layout.
5. Apply visual QA and targeted regression tests. This document alone cannot guarantee consistency.
6. Do not perform a massive unrelated style rewrite or auto-commit/push to adopt this standard.
