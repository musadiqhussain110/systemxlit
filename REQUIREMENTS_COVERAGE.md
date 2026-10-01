# Requirements Coverage

This checklist maps the hackathon brief to the delivered implementation.

| Requirement | Implementation |
|---|---|
| Centralized lab + equipment booking | One booking can reserve a lab and multiple equipment items with quantities |
| Student / faculty booking | Resource discovery, smart recommendation, booking form, status tracking, cancellation, history |
| Lab staff workflow | Department-scoped resource management, approval/rejection, issue, return, damage/missing condition recording |
| Department coordinator | Department-scoped request review, lab management, booking rules, priorities, conflict checking, and usage analytics |
| Administrator | Users, role assignment, departments, equipment categories, labs, system-wide analytics, and read-only booking/activity monitoring |
| Availability checking | Server-side time conflict and inventory quantity calculation |
| Conflict prevention | Overlapping active lab reservations rejected; equipment overlapping quantity is summed |
| Lab schedules | Weekly lab availability windows enforced server-side |
| Approval workflow | Pending → approved/rejected → reserved → in use → completed/late/damaged |
| Booking statuses | Pending approval, approved, reserved, in use, completed, rejected, cancelled, overdue, returned late, damaged |
| Booking rules | Duration, quantity, advance limit, lead time, approval requirement, faculty priority, late-return restriction |
| Smart resource recommendation | Availability + equipment quantity + capacity + department + purpose matching score |
| Alternative slot recommendation | Later conflict-free slots returned when creation fails |
| Equipment issue | Issue record with issuer and due time |
| Equipment return | Actual return time, return condition, damage/missing state, receiver, remarks |
| Late return | Automatic overdue notifications/status and late-return account counter/restriction |
| Maintenance | Lab status, equipment maintenance status and notes, resource blocking |
| Search/filtering | Resource search + department/category/status filters; booking status filtering |
| Notifications | Approval, rejection, cancellation, booking reminder, issue, return reminder, overdue, watched-resource availability |
| Resource becomes available | Users can watch unavailable resources; staff status update triggers notification |
| Dashboard | Booking totals, active/pending counts, upcoming activity, resource insight |
| Analytics | Totals, issued/overdue/damaged, most-booked labs, most-used equipment, department usage, monthly trend |
| Authentication | JWT login and password hashing |
| Role-based access | Student, faculty, lab staff, coordinator and administrator permissions |
| Input/security controls | Zod booking/auth validation, Helmet, CORS, rate limiting, server-side permission checks |
| Approval/resource history | Activity log records booking/resource actions |
| Project explanation document | `PROJECT_EXPLANATION.md` and `output/pdf/Project_Explanation.pdf` |
| Web application | Responsive React + Vite frontend and Express/SQLite API |

## Review and fixes (1 October 2026)

- Public home page, original logo, shared typography, mobile workspace, and accessible dialogs.
- Resource cards prefill booking details. Outcome filters include rejected, overdue, returned late, and damaged.
- Expected participants are checked against lab capacity; duplicate equipment requests are rejected.
- Resources must belong to the selected department so that its approval scope and rules apply.
- Concurrent booking/approval mutations are serialized within one API process.
- Outstanding overdue issues cannot be cancelled. Physical inventory is checked at issue time.
- Damaged/missing equipment is held for maintenance inspection; failed return operations surface errors.
- Alternative-slot search skips closed schedule windows instead of losing all suggestions.
- README corrected to match the actual SQLite implementation.

## Submission work remaining

The brief separately asks for a demonstration video, a GitHub OR deployed application link, and a PDF/Word explanation (provided in `output/pdf`). This local source update does not publish the app or record a submission video. Optional features (QR checkout, email, live occupancy, and heatmaps) are not mandatory and are not claimed as implemented. Draft is an example status in the brief, not a persisted draft workflow in this app.

## Exact role audit

The supplied role table is implemented without role inheritance. Operational issue/return actions belong only to Lab Staff; department rules, priorities and conflict checks belong only to Coordinators. Administrators monitor bookings and do not approve, cancel, issue, return, edit equipment, or define booking rules. The shared policy and full role checklist are in `shared/rolePermissions.json` and `ROLE_ACCESS_MATRIX.md`.
