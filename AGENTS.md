# Table implementation

DataTable is the canonical table implementation for this application. All normal tabular feature screens must use DataTable with domain-specific configuration. Do not manually recreate tables or introduce competing table components unless DataTable fundamentally cannot support the requirement.

Keep feature columns, filters, and actions in their respective domains. Preserve existing behavior when migrating a table, and remove obsolete table markup only after verifying its replacement.
