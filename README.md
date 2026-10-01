# University Lab & Equipment Booking System

A full-stack resource-management application for universities. It supports laboratory reservations, equipment quantity reservations, approval workflows, conflict prevention, issue/return tracking, booking rules, resource availability watches, notifications, intelligent resource recommendations, and analytics.

## Stack

- **Frontend:** React + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** SQLite via Node.js `node:sqlite`
- **Authentication:** JWT + bcrypt
- **Validation/Security:** Zod, Helmet, CORS, rate limiting
- **Background jobs:** node-cron for booking/return reminders and overdue updates

## Project structure

```text
.
├── client/                  React web application
│   └── src/
│       ├── api/             HTTP client
│       ├── components/      Reusable UI components
│       ├── context/         Authentication state
│       ├── hooks/           Reusable hooks
│       ├── layouts/         Authenticated app shell
│       ├── pages/           Feature pages
│       ├── styles/          Global design system
│       └── utils/           Formatting helpers
├── server/                  Express API
│   ├── scripts/seed.js      Demo data + accounts
│   └── src/
│       ├── config/          Environment/database configuration
│       ├── controllers/     HTTP controllers
│       ├── jobs/            Reminder/overdue scheduler
│       ├── middleware/      Auth, validation, error handling
│       ├── models/          SQLite repositories
│       ├── routes/          API route definitions
│       ├── services/        Business logic
│       ├── utils/           Shared helpers
│       └── validators/      Zod validation schemas
├── docker-compose.yml       Optional local MongoDB
└── PROJECT_EXPLANATION.md   Submission-ready technical overview
```

## Quick start

### 1. Install Node.js 22.5 or newer

SQLite is built into Node.js. No separate database server is needed. The database is created automatically in `server/data`.

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Change `JWT_SECRET` before production use.

### 3. Install dependencies

From the project root:

```bash
npm install
```

### 4. Seed demo data

```bash
npm run seed
```

### 5. Start frontend + backend

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000/api`
- Health endpoint: `http://localhost:5000/api/health`

## Accounts

Use the one-time `/setup` page to create the first administrator, then create department accounts. Students and faculty can register. Seeding creates resources and rules, not demo login accounts, and resets existing data; only seed a disposable demo database.

## Main workflows

1. Student/faculty searches labs and equipment.
2. User chooses date/time, lab and/or equipment quantities.
3. Server validates booking rules and checks overlapping lab/equipment reservations.
4. If unavailable, the API can return alternative time suggestions.
5. Request enters approval workflow.
6. Staff approves/rejects it.
7. Approved resources are issued and status moves to **In Use**.
8. Staff records return time and condition; late/damaged/missing outcomes are preserved.
9. Notifications and analytics update from the same source of truth.

## Important implementation details

### Conflict prevention

Availability is calculated on the server. For labs, overlapping active bookings are rejected. For equipment, the system sums quantities reserved by all overlapping active bookings and prevents the requested amount from exceeding total inventory.

### Smart recommendations

`POST /api/bookings/recommendations` ranks compatible labs using current availability, requested capacity, and department match. If a selected booking cannot be created, the booking service also searches later time windows and returns alternative slots.

### Rules

Department coordinators define rules for their assigned department. The seeded university default is a fallback. Configurable rules cover:

- Maximum booking duration
- Equipment quantity per item
- Advance booking limit
- Minimum lead time
- Approval requirement
- Faculty priority
- Late-return restriction threshold and restriction length

### Notifications

The system generates in-app notifications for approval/rejection, cancellation, resource issue/return, upcoming bookings, approaching return times, overdue equipment, and watched resources becoming available again.

## Production notes

For deployment, use a persistent SQLite volume, a strong JWT secret, HTTPS, a production process manager/container, and a reverse proxy. Build the frontend with:

```bash
npm run build
```

Run a single API process: inventory mutations are serialized in that process. Multiple workers require database-level transactional locking before deployment. Back up the SQLite database regularly.

Then serve `client/dist` from your web server/CDN and point `VITE_API_URL` to the deployed API.

## Verification

Run `npm test` (or `node server/tests/runIsolated.cjs workflow.cjs roleMatrix.cjs system.cjs`) for booking lifecycle, role, API, and browser checks. The runner creates a disposable MySQL database and removes it after checking; the configured application database is not used. The database account needs permission to create/drop a test database. Browser checks use Playwright and Microsoft Edge.

The public home page is `/`; signed-in users are directed to `/dashboard`. Resource cards prefill `/book`. The original `client/src/assets/hackathon.png` is displayed through a CSS viewport that removes only its transparent padding.

## Exact role permissions

Permissions follow the supplied role table without administrator inheritance of operational duties:

- Student/faculty: browse and search resources, check availability, create requests with a purpose, track status, cancel their own eligible bookings, and view their history.
- Lab staff / lab incharge: manage their department's lab availability and equipment, approve/reject requests, issue equipment, confirm returns, record damage/missing items, block resources, and update maintenance.
- Department coordinator: review department requests, manage department labs, define department rules, assign priorities, monitor department usage, and check/resolve booking conflicts.
- Administrator: manage users, departments, labs, categories, system-wide analytics, role assignments, and booking activity monitoring. Booking monitoring is read-only.

`shared/rolePermissions.json` defines the fixed policy used by the frontend and backend. `ROLE_ACCESS_MATRIX.md` maps the duties and restrictions. Run `node server/tests/runIsolated.cjs workflow.cjs roleMatrix.cjs` to verify lifecycle, permission, and department boundaries in isolated MySQL databases. Direct execution of these suites is blocked to protect application data.
