# Frontend Only Development Rule

- **Do Not Modify Backend**: Never edit, add, or delete files in `erjv-backend`. All backend API structures and endpoints must be treated as immutable.
- **Frontend-Only Scope**: All user requests, bug fixes, UI improvements, and validations must be implemented entirely within `erjv-frontend`.
- **Client-Side Graceful Error & Constraint Handling**: Handle database unique constraints, validation errors, and entity state changes in the frontend using client-side pre-validation and `getErrorMessage` in `@/lib/api-client.ts`.
