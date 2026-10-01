# Verification - 1 October 2026

## Current role audit

The supplied role table is enforced in the UI and API through `shared/rolePermissions.json`. Full mapping: `ROLE_ACCESS_MATRIX.md`.

- Student/faculty: discovery, availability, requests, purpose, status, own cancellation and history.
- Lab staff/incharge: department lab availability, equipment, approvals, issue/return, damage/missing records, blocking, maintenance.
- Coordinator: department request review, labs, rules, priority, usage, conflict handling.
- Administrator: users, departments, labs, equipment categories, system analytics, defined role assignments, read-only booking/activity monitoring.

Management roles have no booking-creation/cancellation access. Administrators have no operational approval, equipment editing, issue/return, priority, or rule-editing access. Coordinators have no equipment-management or issue/return access. Lab staff have no lab-identity editing, lab creation/deletion, rules, priorities, usage analytics, or system administration access.

## Validation completed

- 18 lifecycle integration checks passed against an in-memory SQLite database.
- 98 role/scope checks passed, including allowed and forbidden actions, cross-department identifiers, own-booking cancellation, assignment validation, disabled accounts, forged JWT role claims, direct-service enforcement, and coordinator alternative slots.
- Browser checks passed for every role's exact sidebar and all 11 direct routes. Booking controls, department-only management tabs, lab identity restrictions, priority/conflict controls, and administrator assigned-duty previews were verified.
- No browser runtime errors in the role checks. Unauthorized analytics and equipment-management data requests are absent from role dashboards.
- Production build passed.
- Read-only inspection found zero unsupported stored account roles and zero non-admin accounts with missing/nonexistent departments.
- Existing saved accounts and application data were not changed by testing.

## Design and workflow

The app retains the original `client/src/assets/hackathon.png`, a 2.5-second launch splash, the public home page, shared typography/colors, responsive layouts, resource-card prefilling, and accessible dialogs. Capacity, duplicate equipment, reservation concurrency, overdue cancellation, physical stock at issue, damage quarantine, and return-error handling remain protected.

## Deployment and submission

Run one API process; multiple workers need database-level locking. The project explanation PDF remains in `output/pdf`. The separate submission demonstration video and GitHub/deployed link still need preparation; no external publishing was performed.
