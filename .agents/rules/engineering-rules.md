# ERJV POS Engineering Rules

## Reuse First

Before creating a component, hook, utility, service, or helper, search the repository for an existing implementation.

Prefer extending an existing abstraction over creating a competing one.

Do not duplicate functionality.

---

## Tables

`DataTable` is the canonical table implementation for the application.

All normal tabular interfaces should use `DataTable` with domain-specific column definitions.

Do not create independent table implementations unless `DataTable` fundamentally cannot support the requirement.

Keep domain columns separate from the generic DataTable.

Example:

- `customerColumns`
- `supplierColumns`
- `vehicleColumns`
- `deliveryColumns`

---

## Components

Extract reusable UI when the same behavior appears in multiple places.

Examples:

- table row actions
- status badges
- confirmation dialogs
- search controls
- filters
- empty states

Do not create abstractions for one-off markup without a clear benefit.

---

## Business Logic

Do not duplicate business rules inside React components.

Shared rules should live in domain utilities/services.

Examples:

- stock status
- vehicle availability
- delivery status
- archive eligibility

JSX should primarily render state, not define complicated business rules.

---

## Constants

Avoid duplicated magic strings, magic numbers, statuses, and business identifiers.

Centralize shared domain constants where doing so improves correctness.

Do not turn ordinary one-off UI text into constants unnecessarily.

---

## Data

Do not hard-code production domain records inside UI components.

Use the appropriate API/service/state layer.

Mock data belongs only in explicit seed/mock/test files.

---

## Feature Boundaries

Keep business domains separated:

- Sales
- Purchases
- Logistics
- Staff

Shared generic UI belongs in shared components.

Domain-specific behavior stays within its feature.

---

## File Responsibilities

Prefer focused files.

Separate large features by responsibility when useful:

- page
- columns
- form/dialog
- hook
- service
- utility
- types

Do not split files based only on line count.

---

## Avoid God Components

Do not build universal components with dozens of props that contain unrelated business behavior.

Reuse shared primitives while keeping domain logic explicit.

---

## Refactoring

Preserve existing behavior during architecture refactors.

Do not silently change:

- APIs
- database behavior
- business rules
- permissions
- inventory calculations
- statuses

Report suspected business-rule bugs separately.

---

## UI Consistency

Reuse the existing design system.

Prefer shared variants/tokens over repeated Tailwind class strings when a pattern is genuinely shared.

The visual style should remain restrained and structured, with moderately rounded corners rather than excessively rounded containers.

---

## Quality

After meaningful changes:

1. Run type checking.
2. Run linting if configured.
3. Run tests if configured.
4. Run the production build.
5. Fix errors caused by the change.

Remove obsolete duplicate code after its replacement is verified.

---

## Guiding Principle

One responsibility should have one clear source of truth.

Reuse behavior.
Configure differences.
Do not copy implementations.
Do not over-engineer.