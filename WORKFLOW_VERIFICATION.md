# Workflow verification — 1 October 2026

## Booking validation fix

The form allowed a booking purpose shorter than the API's five-character minimum, while the API returned only "Validation failed". The form now enforces and explains the 5–800 character limit, including trimmed input. It checks reversed time windows and equipment quantities. API validation responses identify the field and reason, including invalid dates, times, identifiers and participant counts. Calendar dates are validated strictly rather than silently rolling into another month.

MySQL duplicate, missing-value and invalid-value errors now return useful conflict or validation responses instead of a generic server error.

## Checks completed

- 18 lifecycle integration checks passed on MySQL: pending requests, approval, concurrent reservation/approval conflict prevention, availability/recommendations, capacities, department rules, issue/return, damage handling, cancellation, analytics and notifications.
- 98 role and department-boundary checks passed: allowed and forbidden actions, account role assignments, cross-department access, own-booking visibility/cancellation, disabled accounts and forged JWT role claims.
- 8 additional API workflow checks passed: first-administrator setup, registration/login, invalid-field reporting, browser-shaped booking payloads, review/issue/good return, cancellation/rejection/equipment-only booking, notification ownership/read state, and deduplicated reminders/overdue/missing-item returns.
- Browser verification passed in Microsoft Edge: a short purpose produced the expected error; a valid request was submitted and displayed in booking history.
- All 26 permitted screen/role combinations rendered without runtime errors, unexpected API errors or error alerts. Administrator, lab staff and coordinator navigation omitted New Booking; direct access to /book redirected to the dashboard.
- All 54 backend source files passed JavaScript syntax checks.
- Vite production build passed and client/dist was rebuilt with the fix.
- Read-only account audit found 5 accounts, zero unsupported roles, and zero non-administrator accounts without a valid department.

## Isolation and repeatability

Tests use newly created, randomly named MySQL databases, which the runner removes afterwards. Application data is not used for test fixtures. The obsolete SQLite DATABASE_PATH test setting has been replaced by a guard that refuses direct suite execution against the application database.

Run from the project root:

```text
node server/tests/runIsolated.cjs workflow.cjs roleMatrix.cjs system.cjs
```

The database account needs permission to create/drop disposable test databases. Browser checks require Playwright and Microsoft Edge on Windows. The test uses an installed Playwright package, PLAYWRIGHT_MODULE_PATH, or the bundled Codex runtime. The same-origin Vite proxy used in browser tests connects to the isolated API.

These results verify the local source against MySQL. They do not certify a separately deployed instance; restart the API and reload the frontend to load local changes, or redeploy the frontend and API if using hosted versions.
