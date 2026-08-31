---
name: frontend-only-workflow
description: Strictly restricts all code modifications, UI features, API integrations, and refactoring to the frontend repository (erjv-frontend). Enforces that backend files (erjv-backend) must never be modified or edited.
---

# Frontend Only Workflow Rule & Skill

This skill enforces strict boundaries between frontend and backend workspaces in the ERJV project.

## Mandatory Operating Directives

1. **ZERO Backend Modifications**:
   - Never create, edit, modify, or delete any files inside `erjv-backend` (`c:\Users\magno\Documents\erjv-backend\**`).
   - The backend repository MUST strictly match `origin/main` without local code deviations.

2. **Frontend Scope Only**:
   - All feature requests, error handling, validation, duplicate key checking, and UI behavior adjustments MUST be implemented exclusively within `erjv-frontend` (`c:\Users\magno\Documents\erjv-frontend\**`).

3. **Client-Side Validation & Friendly Error Handling**:
   - Implement pre-validation in frontend form modals (e.g. duplicate name checks, existing stock allocation checks) before submitting requests to the backend.
   - Use `getErrorMessage` in `src/lib/api-client.ts` to transform server error responses, constraint failures, and status codes into concise, user-friendly UI error notifications.

4. **Soft-Deletion & Archive UX on Frontend**:
   - Handle backend soft-deletion (`isActive: false`) gracefully on the UI.
   - When items are deactivated, provide immediate visual feedback (e.g. toast notifications) and maintain clear empty/filtered states so pages and lists remain stable and informative.
