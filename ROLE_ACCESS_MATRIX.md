# Exact role access audit

The supplied user-role table is the authority for business permissions. Student and Faculty remain separate account labels with identical permission sets. Lab Incharge is the same account role as Lab Staff. There are no additional role types and no implicit administrator inheritance.

| Role | Assigned duties | Scope |
|---|---|---|
| Student / Faculty | Browse labs and equipment; search by category; view available dates/time slots; submit requests; add purpose; track approval; cancel bookings; view history | Read their own bookings and cancel only their own eligible requests. Resource availability is searchable across departments, subject to department booking rules. |
| Lab Staff / Lab Incharge | Manage lab availability; manage equipment; approve/reject requests; issue equipment; confirm returns; record damage/missing items; block resources temporarily; update maintenance | Assigned department only. Lab identity/capacity cannot be edited. No lab creation/deletion, booking creation/cancellation, priority editing, rules, usage analytics, users, departments, categories, or system activity access. |
| Department Coordinator | Review important requests; manage department labs; define rules; set priorities; monitor usage; handle conflicts | Assigned department only. Conflict checks report availability and alternative time slots. No equipment editing, issue/return, booking creation/cancellation, users, departments, categories, system-wide analytics, or system activity access. |
| Administrator | Manage users; manage departments; manage labs; manage equipment categories; view system-wide analytics; control permissions; monitor booking activity | University-wide. Booking/activity access is read-only. No booking creation/cancellation/approval, equipment editing, issue/return, priority editing, or rule editing. |

## Enforcement

- `shared/rolePermissions.json` is the common policy for menus, frontend guards, API authorization, and displayed role duties.
- Direct service calls also enforce booking review, creation, cancellation, issue/return, and analytics permissions.
- Staff/coordinator queries and writes enforce the current account's department. Request-body fields, URL identifiers, user filters, and JWT role claims cannot expand access.
- Public registration accepts only Student or Faculty. Only administrators assign other roles through user management; unsupported role values are rejected.
- Disabled accounts cannot authenticate API requests. Department roles without a department assignment fail closed.
- Lab Staff payloads can change only lab availability/status/maintenance fields. Equipment cannot be moved to another department's lab.
- Referenced departments/labs/equipment are retained to protect account assignment and booking history.
- Shared authentication, notifications, and role-specific dashboard summaries support the listed workflows and do not confer extra operational permissions.

## Existing accounts

Read-only checks found zero unsupported account roles and zero non-administrator accounts with missing/nonexistent department assignments. Existing accounts and stored booking data were not modified during testing.

## Verification

- Lifecycle suite: 18 in-memory integration checks.
- Exact role matrix: 98 checks covering allowed/denied API actions for all five account labels, identity/department isolation, direct-service checks, role assignment, disabled accounts, and JWT claims.
- Browser checks: exact menus, all 11 direct routes, booking review/cancellation controls, priority/conflict controls, resource-management tabs, read-only lab identity fields, and absence of unauthorized analytics/equipment requests for every role.
