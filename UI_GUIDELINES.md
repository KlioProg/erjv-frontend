# UI implementation standards

This is the required standard for **every UI component** in `erjv-frontend`. It applies to shared primitives, feature components, page layouts, navigation, forms, cards, dialogs, menus, feedback, tables, native HTML controls, and third-party UI wrappers. Use the same dimensions for the same component role across inventory, orders, purchases, deliveries, settings, and other feature screens.

Every new page, component, inline JSX block, portal, and empty, loading, or error state must follow this guide regardless of its location in the codebase. A component family that is not listed still follows the shared defaults; define its roles before implementing its presentation.

These are implementation requirements for new and edited UI, not a claim that every existing screen already complies. Some shared components and legacy screens still use fractional padding, smaller labels, raw colors, or local overrides. Correct those differences at the shared layer when the affected role is in scope. Preserve existing behavior and avoid unrelated visual changes.

## Source of truth

- [src/index.css](src/index.css) owns the font, semantic colors, theme variables, radius tokens, and elevation scale. Preserve Plus Jakarta Sans, the lime brand, and the shared true-gray light and dark surface palettes.
- [src/components/ui](src/components/ui) owns reusable component presentation and size variants.
- [DataTable](src/components/ui/data-table.tsx) owns table presentation. Keep column definitions, filters, status mappings, and action behavior in their domains.
- This guide owns component roles, sizing decisions, and token usage. [SPACING_GUIDE.md](SPACING_GUIDE.md) points here rather than defining a second scale.

Use existing component APIs. If a required size is not supported, implement it in the shared component before using it across features. Do not pass undocumented props or import components that are not installed.

## Defaults for every component

- Ordinary readable content uses the body role: 14px text with a 20px line height. Explicit heading, label, metadata, table, and compact-action roles use the sizes in the typography scale. Equivalent roles keep the same size wherever they appear.
- Every structural border uses the same 1px width and `border-border` token. Editable control borders use `border-input`. A surface does not need a border merely because other components have one.
- Every gap comes from the shared spacing scale and describes a relationship: 4px between a title and its supporting text, 8px between an icon and label or related controls, 16px between form rows, and 24px between independent sections.
- Every corner follows its role: 8px for surfaces, 6px for controls, and fully rounded for pills. Theme changes alter token values, not individual feature styling.
- Reuse these roles when creating a component that is not named in this guide. Introduce a new size only when an existing role cannot meet a functional or accessibility need, then document it here.
- Put any new reusable color, typography, spacing, border, radius, or elevation tokens in `src/index.css` using the existing Tailwind theme mechanism. Define shared component variants in `src/components/ui`; feature screens consume them. Do not create a second stylesheet or per-feature visual scale.
- Apply the same rules to content rendered in portals and third-party components. Use their shared wrapper or configuration to set presentation rather than adding different overrides at each call site.

## Colors, themes, and component states

All UI consumes the semantic palette in `src/index.css`. Color values are defined there, not copied into features. A palette change should flow through existing roles and shared components across the application.

| UI role                                         | Shared tokens or utilities                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Page surface and ordinary text                  | `bg-background`, `text-foreground`                                                                              |
| Cards and message surfaces                      | `bg-card`, `text-card-foreground`                                                                               |
| Menus, popovers, and floating content           | `bg-popover`, `text-popover-foreground`                                                                         |
| Secondary surfaces and controls                 | `bg-secondary`, `text-secondary-foreground`                                                                     |
| Muted surfaces and supporting text              | `bg-muted`, `text-muted-foreground`                                                                             |
| Neutral hover treatment                         | `bg-accent`, `text-accent-foreground`                                                                           |
| Primary actions and current-location emphasis   | Shared primary variants using `primary`, `primary-contrast`, and their paired foreground and state tokens       |
| Brand-colored readable text                     | `text-primary`, which uses the separate `--primary-text` role                                                   |
| Subtle and selected brand surfaces              | Existing `primary-subtle` and `primary-selected` roles                                                          |
| Destructive actions                             | Shared destructive action variants and their foreground, hover, and active tokens                               |
| Routine statuses, including draft and cancelled | Neutral `StatusBadge` surfaces and text; their semantic tone colors the small dot                               |
| Feedback that needs attention                   | Matching `status-*` background/foreground pairs through shared alerts or `StatusBadge appearance="emphasis"`    |
| Information, warning, and success feedback      | Shared status variants backed by `status-info`, `status-warning`, `status-success`, and their foreground tokens |
| Structural lines, control boundaries, and focus | `border-border`, `border-input`, `ring-ring`                                                                    |

- Keep the lime brand emphasis for primary actions and current-location or selected-state cues. Use neutral surfaces for ordinary layout and semantic status roles for feedback.
- Do not introduce raw hex, RGB, or palette utilities such as `bg-gray-100`, `text-green-600`, or `dark:text-[#...]` for a standard role in feature UI. Add a reusable semantic role in the global theme only if an existing role cannot express the requirement.
- Use the same semantic utilities in light and dark mode. Define theme-dependent values in `:root` and `.dark`; do not independently recolor each component.
- Pair foreground and background roles deliberately. Check their contrast in both themes and in hover, pressed, selected, and validation states. Do not assume that a foreground suitable for lime also works on dark green.
- Lime controls pair `--primary` with the dark `--primary-foreground`. Dark-green controls pair `--primary-contrast` with the white `--primary-contrast-foreground`. Keep these roles separate across buttons, checkboxes, and toast actions, and preserve their contrast in hover and pressed states.
- Ordinary labels, metadata badges, navigation counts, archive notices, and decorative icons are neutral. Generic `Badge` defaults to a neutral surface. User roles identify permissions through their label and icon; verified roles do not get separate decorative palettes.
- Routine statuses use `StatusBadge` with its default `appearance="subtle"`: neutral fill, neutral text, and a small semantic dot. Features own labels and tone mappings; draft and idle states use the neutral tone. The dot is decorative, so the label must communicate the state independently. Use `showDot={false}` only where the text is sufficient and visual density warrants it.
- Use `appearance="emphasis"` for a status requiring action, such as an out-of-stock or critical inventory alert. Emphasized badges and alerts pair each `status-*` background with its matching foreground. Historical cancelled records keep the routine presentation. Destructive action fills and validation control boundaries retain their existing destructive roles.
- `StatusBadge` accepts a text or React-node label so domain components can preserve responsive labels. Equivalent statuses still use the shared typography and geometry; feature classes may control visibility and wrapping rather than rebuilding a pill.
- The shared `Toaster` maps normal and rich-color notifications to the same surface and status pairs. Its wrapper configures Sonner's CSS variables and action styles; scoped global overrides preserve the shared elevation and focus rings where library CSS takes precedence over Tailwind utilities.
- Reuse the existing subtle and selected roles instead of introducing duplicate tint names. Any new theme-dependent color role must have an appropriate dark-theme value.
- New custom properties must be connected to the existing `@theme inline` mapping and consumed by shared components or wrappers. An unused color or shadow variable does not make the UI consistent.
- Layout neutrals are true gray in both themes. Light pages use `#fafafa` behind white cards; brand selection and semantic feedback retain their intentional color. Keep control boundaries stronger than decorative borders, including on muted surfaces. Cards use the shared `--card-shadow` token through `shadow-card`; selected surfaces use `--primary-selected` rather than a separate soft-tint token.
- Define default, hover, pressed, selected, focus, disabled, and error presentation in shared variants where applicable. Preserve the component's geometry across states and communicate status through text or icons as well as color.
- Configure chart colors, native controls, SVG presentation, and third-party UI through shared tokens and wrappers. Brand assets may retain their established artwork; do not use their artwork colors as a separate feature palette.

## Typography

Use the app font and these explicit roles. Pixel equivalents assume the normal 16px root font size; keep rem-based utilities and allow browser text scaling.

| Role                                       | Size / line height | Weight                                  | Tailwind classes                    |
| ------------------------------------------ | ------------------ | --------------------------------------- | ----------------------------------- |
| Page title                                 | 24px / 32px        | Semibold                                | `text-2xl leading-8 font-semibold`  |
| Dialog title                               | 18px / 24px        | Semibold                                | `text-lg leading-6 font-semibold`   |
| Section or card title                      | 16px / 24px        | Semibold                                | `text-base leading-6 font-semibold` |
| Body, descriptions, standard controls      | 14px / 20px        | Regular; medium for actions             | `text-sm leading-5`                 |
| Form labels                                | 12px / 16px        | Medium                                  | `text-xs leading-4 font-medium`     |
| Table headers                              | 12px / 16px        | Semibold                                | `text-xs leading-4 font-semibold`   |
| Table values                               | 12px / 16px        | Regular; medium for primary identifiers | `text-xs leading-4`                 |
| Helper text, validation messages, metadata | 12px / 16px        | Regular                                 | `text-xs leading-4`                 |
| Badges and compact actions                 | 12px / 16px        | Semibold for badges; medium for actions | `text-xs leading-4`                 |

- Table cell content inherits the table size. A product name may use `font-medium`, but must not introduce a larger font than other primary table values.
- Separate primary and secondary cell content with `gap-1`. Use `text-muted-foreground` for secondary content instead of shrinking it to 10px or 11px.
- Keep labels in sentence case. Do not add uppercase or letter spacing to make one table header look different.
- Use `tabular-nums` for quantities, prices, totals, and comparable counts. Keep the app font; do not introduce a separate monospace face.
- Do not add arbitrary font sizes such as `text-[10px]`, `text-[11px]`, or `text-[13px]` in feature UI. Legacy counter styles belong to their shared component until normalized.
- Standard editable input text may use `text-base leading-6 sm:text-sm sm:leading-5` to preserve 16px input text on small screens. Apply this consistently in the shared control, rather than shrinking a crowded form.

## Spacing and layout

Use a 4px spacing grid. The routine scale is **4, 8, 12, 16, 24, and 32px**. Choose the spacing from the relationship between elements, then use the same gap for that relationship everywhere.

| Relationship                           | Size                      | Tailwind classes               |
| -------------------------------------- | ------------------------- | ------------------------------ |
| Primary and secondary text in one item | 4px                       | `gap-1`                        |
| Icon and label; label and control      | 8px                       | `gap-2`                        |
| Related toolbar controls               | 8px                       | `gap-2`                        |
| Compact groups within a panel          | 12px                      | `gap-3`                        |
| Form rows and closely related sections | 16px                      | `gap-4`                        |
| Independent page sections              | 24px                      | `gap-6`                        |
| Compact panel padding                  | 16px                      | `p-4`                          |
| Standard card or dialog padding        | 16px mobile, 24px desktop | `p-4 sm:p-6`                   |
| Dashboard page padding                 | 16px mobile, 32px desktop | Existing layout's `p-4 sm:p-8` |

### Proximity and grouping

Apply the principle from the supplied "UI Spacing Friendship" reference: closer spacing communicates a closer relationship. Internal relationships should be tighter than the gaps that separate their groups. An allowed spacing value still needs the right purpose.

| Relationship strength            | Spacing role | Examples                                                                 |
| -------------------------------- | ------------ | ------------------------------------------------------------------------ |
| Parts of one value or message    | 4px          | Title and its description; primary and secondary table-cell text         |
| Closely connected elements       | 8px          | Icon and label; label and control; related toolbar actions               |
| Compact subgroups                | 12px         | Dense groups inside a panel; existing compact control padding            |
| Sibling items in the same group  | 16px         | Form rows; content blocks within one card                                |
| Separate groups                  | 24px         | Form sections; neighboring cards or independent dashboard sections       |
| Broad separation within a page   | 32px         | Separate page regions when the standard 24px section gap is insufficient |
| Major breaks in spacious layouts | 48px or 64px | Distinct large page blocks, only when the layout needs that separation   |

- Keep this hierarchy visible: **within an item < between sibling items < between separate groups**. Do not give every level the same gap.
- In a form, use 8px between a label and its control, 16px between field rows, and 24px between field groups. A helper message belongs to its field and stays closer to it than the next field does.
- In a card, keep a title and description close, separate related content blocks by 16px, and retain the shared 16px mobile / 24px desktop outer padding. Align header, content, and footer to the same inset.
- In a table cell or list item, keep the name and its metadata together. Separate records using the shared row padding and separators; do not spread the metadata apart to fill a tall row.
- Preserve grouping when a layout wraps or stacks on mobile. Related controls stay together, and separate sections retain a larger gap.
- Use the reference's large 80px or 120px distances only for an intentionally spacious page composition with a documented role. Routine dashboards, forms, and dialogs use the existing compact scale.
- The reference illustrates relationship strength; it does not require changing every component to the same padding or dropping the established 12px compact step.

- Use flex or grid with `gap-*` for sibling spacing. Avoid mixing margins and gaps to space the same group.
- The dashboard layout already supplies page padding and a content width. Feature screens should not add another page-sized inset or choose a different content width without a functional reason.
- Keep card header, content, and footer edges aligned. Preserve shared composition such as `pt-0` between an already padded header and its content; do not double the padding.
- Do not introduce `gap-1.5`, `p-3.5`, `h-7.5`, or arbitrary pixel spacing for ordinary layout. Larger spacing should also follow the grid and have a clear layout purpose.
- The grid applies to layout spacing and control dimensions, not every measurement. Typography, 1px borders, 2px focus rings, token-based radii, and badge vertical padding are explicit exceptions.
- Column widths may be driven by content. Do not force names, currency values, or responsive widths onto the spacing grid at the expense of readability.

## Controls and icons

| Control role                     | Height / size                                    | Presentation                                                          |
| -------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Standard button                  | 40px                                             | `Button size="default"`; 14px text; 16px horizontal padding           |
| Standard input or select trigger | 40px                                             | Shared `Input` or `SelectTrigger`; 14px text; 12px horizontal padding |
| Compact button                   | 32px                                             | `Button size="sm"`; 12px text; 12px horizontal padding                |
| Standalone icon button           | 36px square                                      | `Button size="icon"`                                                  |
| Table row icon action            | 32px square                                      | Shared `DataTableActions` presentation                                |
| Large button                     | 44px                                             | `Button size="lg"`; 16px text; 24px horizontal padding                |
| Touch action                     | At least 44px tall; 44px square for icon actions | Shared coarse-pointer adaptation, such as `pointer-coarse:size-11`    |
| Textarea                         | At least 96px                                    | Shared `Textarea`; 14px text; 12px padding; allow content growth      |

- Controls in one toolbar or form row use the same height. Standard search fields, filters, and their adjacent buttons use 40px; do not mix 28px, 32px, 36px, and 40px controls in that row.
- Reserve compact controls for table actions and secondary dense controls. Inputs used to edit order or delivery quantities remain 40px high.
- For quantity controls, align decrement, input, and increment controls on the same center line. Define the group presentation once when it is reused; keep validation and stock limits in the domain.
- Use 16px (`size-4`) action and navigation icons, and 20px (`size-5`) icons beside section titles. Components such as `Button` already size their child icons; let them do so.
- Do not resize icons individually inside shared controls. Define a variant at the shared layer if an icon role needs a different size.
- Use `size-*` for equal dimensions. Icon-only controls need an accessible name, and decorative icons should be hidden from assistive technology.
- Loading, disabled, and error states must preserve a control's dimensions. Reserve room for loading indicators so labels and adjacent controls do not jump.

## Coverage by component family

This table assigns existing roles to common UI families. It extends the same scale to the whole interface; it does not introduce separate sizes for each family.

| Component family                                   | Text roles                                                                             | Layout and sizing                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Sidebar, tabs, navigation, breadcrumbs             | Body-size labels; medium for interactive labels; helper-size counters                  | 16px icons; 8px icon-to-label gaps; navigation targets at least 40px high and 44px on coarse pointers                                      |
| Forms, search bars, filter bars                    | Form labels, standard-control text, helper-size hints and errors                       | 40px standard controls; 8px label-to-control and toolbar gaps; 16px between form rows                                                      |
| Cards, summary panels, grouped sections            | Section title, body description, helper metadata                                       | 16px mobile / 24px desktop padding; 4px title-to-description gap; 16px between related content groups                                      |
| Dialogs and confirmation modals                    | Dialog title, body description, form and control roles                                 | Shared surface border and radius; 16px mobile / 24px desktop padding; 16px between content groups; 8px between footer actions              |
| Dropdown menus, select options, searchable results | Body-size option labels; helper-size group labels and descriptions                     | Items at least 40px high; 12px horizontal / 8px vertical padding; 8px icon-to-label gap; 44px minimum touch targets                        |
| Tooltips and overflow popups                       | Helper text                                                                            | 12px horizontal / 8px vertical padding; shared popover tokens and surface radius; wrap long content                                        |
| Badges, status pills, counters                     | Badge or metadata role                                                                 | Shared pill padding and radius; 4px internal icon-to-label gap; no per-feature font or border sizing                                       |
| Alerts, banners, toasts, inline feedback           | Body-size message and title; medium or semibold title; helper-size supporting metadata | 16px padding for message surfaces; 8px icon-to-content gap; 4px title-to-message gap; shared status variants                               |
| Empty states and loading panels                    | Section title when present, body explanation, helper metadata                          | At least 24px panel padding; 4px title-to-description gap; 16px before a separate action group; preserve the loaded layout where possible  |
| Lists and notification rows                        | Body-size primary content; helper metadata                                             | 56px minimum standard row height; 12px vertical / 16px horizontal padding; 8px between related controls; grow for multiline content        |
| Charts and metric summaries                        | Section title; page-title role for prominent values; helper captions and axes          | Shared card padding and spacing; use chart configuration for text styles; keep plot dimensions driven by the data and layout               |
| Avatars, checkboxes, decorative symbols            | Adjacent labels follow body or form-label roles                                        | Reuse existing primitives; 32px compact / 40px standard avatars; 16px checkbox glyphs; enlarge touch targets without enlarging every glyph |
| Tables, editable item grids, pagination            | Table text, helper metadata, compact actions                                           | Follow the DataTable sizing and responsibility rules below                                                                                 |

Use shared components where available, including `UnifiedNavbar`, `Tabs`, `Card`, `Dialog`, `DropdownMenu`, `Select`, `SearchableDropdown`, `Alert`, and the `Toaster` wrapper. Do not recreate their sizing in domain markup. For a component family with no shared implementation, compose existing primitives and apply the roles above; extract a reusable component when the pattern recurs.

Status, hover, selection, validation, and disabled variants may change semantic colors or weight. They must preserve the component's text scale, gap, border width, and geometry unless a documented accessibility adaptation requires otherwise.

## Tables

DataTable is the canonical implementation for normal tabular feature screens, including editable order, purchase, and delivery items. Compose it with domain-specific columns; do not recreate its header, body, rows, or pagination in a feature component.

### Table sizing

| Element                          | Required sizing                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------- |
| Header row                       | 40px minimum height; `px-4 py-2`; 12px / 16px semibold text                      |
| Standard body row                | 56px minimum height; cells use `px-4 py-3`; 12px / 16px text                     |
| Row with a 40px editable control | 64px minimum height; cells use `px-4 py-3`                                       |
| Stacked cell content             | `gap-1`; row grows naturally when content needs more room                        |
| Standard row actions             | 32px controls on desktop; at least 44px on coarse pointers                       |
| Pagination footer                | `px-4 py-3`, `gap-3`; 12px / 16px text; 32px navigation controls on desktop      |
| Empty or loading state           | Shared presentation with 24px minimum padding; inherit body or helper text roles |

Row heights are minimums, not clipping limits. Text wrapping, multiple metadata lines, validation messages, and touch controls may make a row taller. Use the same padding and alignment across the table rather than forcing rich content into a fixed height.

### Table responsibilities

- Implement sizing in `data-table.tsx` and its `table.tsx` primitives. Keep standard sizes consistent in both existing `appearance="default"` and `appearance="subtle"` variants; appearance changes visual treatment, not the feature's independent size scale.
- Use `ColumnDef.align` to synchronize header and cell alignment: text left, quantities and currency right, status or icon-only columns centered where appropriate. Actions align right.
- Column `className` and `headerClassName` may define width, responsive visibility, wrapping, or domain state. Do not use them to change ordinary cell padding, base font size, row borders, or density.
- Do not use `rowClassName` to invent per-feature row heights. Row state styling, such as archived presentation, remains allowed.
- Keep header and body edges aligned, including first and last columns. Avoid descendant overrides such as `[&_td]:px-2` in feature screens.
- Use `OverflowValue` for clipped values that need access to their full text. Preserve wrapping when the full value must remain visible.
- Keep `DataTableActions` for shared edit, view, archive, and restore presentation. Permissions, confirmations, and mutations remain in the feature.
- Use `StatusBadge` for status presentation and keep labels and status mappings in the domain. Do not recreate pill sizing in each column.
- Preserve sorting, pagination, empty states, row expansion, responsive visibility, editing, and row actions when changing presentation. Embedded editable tables may disable pagination using the existing prop.
- If a requirement needs a different density, add and document a reusable DataTable variant. DataTable currently has no density prop; do not assume one exists.

## Borders, corners, and surfaces

| Role                           | Standard                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| Card, dialog, table container  | 1px `border border-border`; 8px `rounded-lg`                    |
| Input, select, outline button  | 1px `border border-input`; 6px `rounded-md`                     |
| Table row or section separator | 1px `border-border`; use existing shared separator presentation |
| Badge or status pill           | `rounded-full`; 1px border; `px-2 py-0.5`; 12px / 16px text     |
| Focus indicator                | Existing 2px `ring-2 ring-ring` treatment                       |

- Radius values come from `src/index.css`. The base surface radius is 8px; `rounded-md` resolves to 6px and `rounded-sm` to 4px. Use role tokens rather than arbitrary radii.
- Use one container border and one row separator. Avoid double borders from wrapping a bordered DataTable in another bordered card.
- Structural borders use `border-border`; editable controls use `border-input`. Do not substitute raw gray colors, varying opacity, or 2px borders independently across screens.
- Existing subtle table separators, badge tones, validation borders, and navigation indicators belong to shared variants. Keep these exceptions centralized.
- Use semantic colors such as `bg-card`, `bg-background`, `text-foreground`, and `text-muted-foreground`. Do not add feature-specific light and dark color overrides for a standard role.
- Let shared components own shadows and hover treatment. Do not add a different shadow to each feature's equivalent card, button, or table.
- Keep the focus indicator distinct from the structural border. Do not remove it to make sizing or borders appear uniform.

### Elevation

The four elevation values in `src/index.css` have light and dark definitions. Consume them through shared components; do not copy shadow values into feature CSS.

| Role                               | Shared utility              |
| ---------------------------------- | --------------------------- |
| Cards and resting controls         | `shadow-card` / `shadow-xs` |
| Raised primary actions             | `shadow-sm`                 |
| Menus, tooltips, and notifications | `shadow-md`                 |
| Dialogs and modal surfaces         | `shadow-lg`                 |

- Use `shadow-none` for flat surfaces. A surface does not need elevation merely because it has a border.
- Cards alias the smallest elevation through `--card-shadow`. Buttons own their hover elevation through shared variants; features must not independently amplify it.
- Legacy `shadow-2xs` aliases `shadow-xs`; `shadow-xl` and `shadow-2xl` alias `shadow-lg`. These names preserve existing call sites without creating extra elevation levels. New UI uses the four standard roles.

## Responsive behavior

- Use the existing Tailwind breakpoints and dashboard shell. Change layout and column visibility before reducing text or control sizes.
- Toolbar controls may wrap or stack with the same `gap-2`. Maintain matching heights after wrapping.
- Table headers and their cells must hide at the same breakpoint. Keep essential values and actions available through visible columns or the existing expanded-row presentation.
- Allow table-local horizontal scrolling when needed. Do not let a table stretch the whole page or make essential text unreadably small.
- Expand compact action targets to at least 44px on coarse pointers. Allow rows and action columns to grow to accommodate them.
- Dialogs stay inside the viewport with usable content scrolling and reachable actions. Use shared padding and existing width patterns rather than inventing a new inset for every modal.

## Checklist for every UI edit

1. Read this guide and the relevant shared components before changing any UI. Identify its role in the component-family table and compare the same role in another domain.
2. Match the color and typography roles, spacing, control height, row minimum, border, radius, and shared state presentation above. Verify that internal gaps are smaller than gaps between separate groups. Do not treat legacy differences as defaults.
3. Resolve recurring differences through shared components or documented variants. Check their other callers before changing defaults.
4. Preserve existing content, values, editing behavior, sorting, pagination, and action permissions.
5. For rendered UI changes, inspect a narrow mobile viewport (375px), tablet (768px), and desktop (1280px), including affected light and dark states.
6. Check long text, multiline content, empty and loading states, validation errors, keyboard focus, and touch actions when relevant to the change. Confirm consistent sizes across adjacent controls, navigation, cards, overlays, feedback, and tables affected by the change.
7. Review changed JSX, CSS, and component configuration for raw colors, arbitrary font sizes, inconsistent gaps, independent border or radius overrides, and duplicated state styles. Replace them with the documented roles or record a necessary exception.
8. Run the checks appropriate to the change. For documentation-only edits, check formatting and links; for UI code, run the applicable build or lint checks and visual verification. Report any verification that could not be completed.

When an exception is required for readability, accessibility, or a functional constraint, explain the component role, reason, and exact size here. Keep recurring exceptions reusable and preserve the default for other callers.
