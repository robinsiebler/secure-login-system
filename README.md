# Login Security Lab

A small, security-focused login system built with Node.js, Express, Oracle Database, bcrypt, and JWT.

## Stack

- **Express** — HTTP API
- **Oracle Database** (via `oracledb`) — user storage, accessed through a connection pool
- **bcrypt** — password hashing (cost factor 12)
- **jsonwebtoken** — stateless session tokens
- **helmet**, **cors**, **express-rate-limit** — transport/security hardening
- Plain HTML/CSS/JS frontend for exercising the API

## Setup

1. Copy `.env.example` to a new file named `.env` and fill in real values.
   Generate a `JWT_SECRET` with:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. Create the schema in your Oracle instance:
   ```
   sqlplus your_user/your_password@localhost/XE @sql_queries/create_tables.sql
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Run the server:
   ```
   npm run dev
   ```
   for local development (auto-restarts via nodemon), or:
   ```
   npm start
   ```
   to run it plainly.
5. Open `http://localhost:3000` (or whatever `PORT` you set) for the login/register UI.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Port the Express server listens on |
| `DB_USER` / `DB_PASSWORD` / `DB_CONNECTION_STRING` | Oracle connection details |
| `JWT_SECRET` | Symmetric key used to sign and verify JWTs. Must be long, random, and kept out of source control. |

`.env` is gitignored — only `.env.example` (with placeholder values) is committed.

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/register` | none | Create a user. Validates username/email/password format and rejects duplicates. |
| POST | `/api/login` | none | Verify credentials, return a JWT valid for 1 hour. |
| POST | `/api/forgot-password` | none | Accepts an email; if it belongs to a registered user, generates a one-time reset token. Always returns the same generic message. |
| POST | `/api/reset-password` | none | Accepts a reset token and new password; validates and hashes the password, updates the user, and invalidates the token. |
| POST | `/api/change-password` | Bearer token | Verifies the current password, validates and hashes the new one, and updates the logged-in user. |
| GET | `/api/profile` | Bearer token | Returns the logged-in user's profile, including their role. |
| GET | `/api/dashboard` | Bearer token | Returns a welcome summary (username, role, last login) for any logged-in user. Admins and Managers additionally get `stats`: total user count and a per-role breakdown. |
| GET | `/api/health` | none | Liveness check. |
| GET | `/api/admin/users` | Bearer token, Admin role | Lists all users (id, username, email, role, timestamps — no password hashes). |
| DELETE | `/api/admin/users/:id` | Bearer token, Admin role | Deletes a user. An admin cannot delete their own account. |
| PUT | `/api/admin/users/:id/role` | Bearer token, Admin role | Sets a user's role to `ADMIN`, `MANAGER`, or `EMPLOYEE`. An admin cannot change their own role. |
| GET | `/api/manager/employees` | Bearer token, Manager role | Lists all users with role `EMPLOYEE` (no password hashes). |
| DELETE | `/api/manager/employees/:id` | Bearer token, Manager role | Removes an employee. Rejected with 403 if the target isn't an `EMPLOYEE` — Managers can't delete other Managers or Admins, and can't change anyone's role. |

## Security measures

- **Password storage**: bcrypt with a cost factor of 12; the client never receives or stores raw passwords.
- **SQL injection**: all queries use Oracle bind variables — user input is never concatenated into SQL. Enforced by a static regression test (`tests/sqlInjection.test.js`) that scans every `conn.execute()` call in the codebase and fails the build if any query's SQL text isn't a plain template literal, or contains a `${...}` interpolation.
- **Account lockout**: after 5 consecutive failed logins, an account is locked for 15 minutes.
- **Username enumeration resistance**: unknown-username and wrong-password responses are identical (`"Invalid username or password"`), and a dummy bcrypt comparison runs on unknown usernames so response timing doesn't leak which case occurred.
- **Rate limiting**: `/register`, `/login`, `/forgot-password`, `/reset-password`, and `/change-password` are all throttled per-IP via `express-rate-limit`.
- **Password reset tokens**: a random 256-bit token is generated per request; only its SHA-256 hash is stored (see `PASSWORD_RESET_TOKENS` in `sql_queries/create_tables.sql`), so a database leak alone can't be used to reset accounts. Tokens expire after 30 minutes and are single-use (`USED_AT` is set once redeemed). `/forgot-password` returns an identical response whether or not the email is registered, to resist enumeration.
- **Change password**: requires a valid JWT and the correct current password (verified via `bcrypt.compare`) before a new one is accepted, validated, and hashed. On success the frontend clears the stored token and forces a fresh login.
- **Password history**: every time a password is set (registration, change, or reset), its hash is appended to `PASSWORD_HISTORY` (see `sql_queries/create_tables.sql`). Change/reset requests are checked against the 5 most recent hashes for that user via `bcrypt.compare`, and rejected if the new password matches any of them — so a user can't "change" their password back to one they just used.
- **JWTs**: signed with a secret from the environment, 1-hour expiry, verified on every protected request.
- **Input validation**: username, email, and password format are validated server-side before touching the database (see `utils/validators.js`). Every endpoint that takes a body checks both presence and type (`typeof === "string"`) before using a field, so a malformed request (e.g. an object or array where a string is expected) gets a clean `400` with a specific message instead of crashing into a generic `500`. Malformed JSON bodies are also caught by a dedicated error handler (`app.js`) that returns `{"error": "Invalid JSON in request body"}` instead of leaking a stack trace.
- **Password strength meter**: a live-updating Weak/Good/Strong indicator on the Register, Reset Password, and Change Password forms (`frontend/script.js`'s `calculatePasswordStrength`), scored from character variety and length. Frontend-only UX guidance — the actual password policy is still enforced server-side by `utils/validators.js`, unaffected by whatever the meter shows.
- **HTTP hardening**: `helmet` sets standard security headers; `cors` is explicit middleware rather than ad-hoc header handling.
- **Env var validation**: the app refuses to start if `PORT`, `DB_*`, or `JWT_SECRET` are missing.
- **Role-based access control**: every user has a `ROLE` (`ADMIN`, `MANAGER`, or `EMPLOYEE`; new registrations default to `EMPLOYEE`, the lowest privilege). `middleware/authorize.js`'s `authorizeRoles(...)` re-fetches the user's current role from the database on every request rather than trusting the JWT payload, so a role change (promotion or demotion) takes effect on the user's very next request instead of waiting for their token to expire. Admin-only routes also block an admin from deleting or changing the role of their own account, to avoid accidental lockout.
- **Dashboard access**: `GET /api/dashboard` is open to any authenticated user, but the role-aware `stats` block (total users, counts by role) is only computed and included for Admins/Managers — the role is re-read from the database on each request, the same pattern used by `authorizeRoles`. The full user list (`GET /api/admin/users`) remains Admin-only.
- **Manager scope, enforced server-side**: `middleware/authorize.js`'s `authorizeRoles(ROLES.MANAGER)` gates `/api/manager/*` to Managers only. The list endpoint only ever returns `EMPLOYEE`-role users, and `deleteEmployee` independently re-checks the target's role from the database before deleting — even a crafted request against another Manager's or an Admin's ID is rejected with 403. Managers have no role-change capability at all; that stays exclusively on the Admin-only `PUT /api/admin/users/:id/role` route.

## Logging

`utils/logger.js` writes structured, single-line JSON entries to both the console and `logs/app.log` (directory auto-created on startup; gitignored). Generic HTTP access logging (method/path/status/response-time for every request) still comes from `morgan("dev")` in `app.js` — the logger below is for semantic, security-relevant events on top of that:

| Event | Level | When | Fields |
| --- | --- | --- | --- |
| `REGISTRATION` | info | A new account is created | `username`, `email`, `ip` |
| `LOGIN_SUCCESS` | info | A login succeeds | `username`, `ip` |
| `LOGIN_FAILURE` | warn | A login is rejected | `username`, `ip`, `reason` (`unknown_user`, `account_locked`, or `invalid_password`) |
| `ERROR` | error | An unexpected exception reaches the centralized error handler (see below) | `route`, `method`, `ip`, `message`, `stack` |

Passwords and password hashes are never logged. `LOGIN_FAILURE`'s `reason` field is intentionally more specific than the API's response (which always says `"Invalid username or password"` to resist enumeration) — it's only written to the server-side log, not returned to the client, so it doesn't reopen that side channel; it's there so brute-force patterns are visible to whoever reads the log.

## Error handling

Every route ultimately funnels errors through one centralized Express error-handling middleware (`middleware/errorHandler.js`, registered last in `app.js`). Controllers don't catch their own errors or format responses on failure — they either respond on success or `throw`, and Express 5 automatically forwards a thrown/rejected error from an async handler to this middleware. It branches on error type:

| Error type | How it's recognized | Response |
| --- | --- | --- |
| Malformed JSON body | `body-parser`'s `SyntaxError` (`entity.parse.failed`) | `400`, `"Invalid JSON in request body"` |
| Expired JWT | `err.name === "TokenExpiredError"` | `401`, `"Your session has expired. Please log in again."` |
| Invalid/malformed JWT | `err.name === "JsonWebTokenError"` or `"NotBeforeError"` | `403`, `"Invalid authentication token."` |
| Validation / auth / not-found / conflict | instance of `AppError` (see `utils/errors.js`: `ValidationError`, `AuthError`, `NotFoundError`, `ConflictError`) | whatever `statusCode`/message the thrown error carries — these are the "expected" 4xx outcomes every controller already had, just thrown instead of directly formatted |
| Database error | `oracledb` sets a numeric `err.errorNum` on any `ORA-*` error | unique-constraint violations (`ORA-00001`) → `409`, `"That value is already in use."`; anything else → `500`, `"A database error occurred. Please try again."` |
| Anything else | (fallback) | `500`, `"Server error"` |

Only the last two categories (database errors and truly unexpected exceptions) are logged as `ERROR` events — routine 4xx outcomes (bad input, wrong password, expired token, etc.) are expected traffic, not bugs, so they aren't logged as errors. Full details (`message`, `stack`) are always logged server-side; the client only ever sees the friendly message.

## Roles & bootstrapping the first Admin

Every user has a `ROLE` column (`ADMIN`, `MANAGER`, or `EMPLOYEE`), defaulting to `EMPLOYEE` on registration — the app never lets someone self-register as an Admin. To get your first Admin, register normally through the app, then promote that account directly in the database:

```sql
UPDATE USERS SET ROLE = 'ADMIN' WHERE USERNAME = 'your_username';
COMMIT;
```

From there, that Admin can promote/demote other users via the "Manage users" panel (or `PUT /api/admin/users/:id/role`) — no more manual SQL needed.

## Tests & CI

```
npm run lint
npm test
```

GitHub Actions (`.github/workflows/node-ci.yml`) runs lint and the Jest unit test suite on every push/PR to `main`. The test suite covers validation logic and JWT middleware only — it does not require a live Oracle connection, since Oracle isn't readily available as a CI service.

## Postman Collection

`postman/login-security-lab.postman_collection.json` covers every endpoint in the table above, organized into Health / Auth / Admin / Manager folders. Import it into Postman (or run it headlessly with [Newman](https://www.npmjs.com/package/newman), Postman's CLI runner: `npx newman run postman/login-security-lab.postman_collection.json`) against a locally running instance of the app.

- `baseUrl` defaults to `http://localhost:4000` — update the collection variable if your `PORT` differs.
- The Auth folder is self-contained: "Register" generates a fresh unique username/email each run and "Login" auto-saves the returned JWT into the `token` variable, so Profile/Dashboard/Change Password work immediately after. "Reset Password" needs a real token pasted into `resetToken` from the server's console log (see Notes below) since there's no email provider to read it from automatically.
- The Admin and Manager folders need real credentials for an already-privileged account in `adminUsername`/`adminPassword` and `managerUsername`/`managerPassword` — this API has no self-promotion endpoint (see "Roles & bootstrapping the first Admin" above), so the collection can't create one for you. Set `targetUserId` to a real user ID (e.g. from a "List Users"/"List Employees" response) before running Update Role / Delete.
- Every request has a basic status-code assertion so a full run (or `newman run`) doubles as a quick smoke test — this is a local-testing aid, though, not something wired into CI.

## Notes

- **No real email provider is configured.** `/forgot-password` does not send an actual email — it logs the reset link (including the token) to the server's console/terminal output instead. To test the reset flow: call `/forgot-password`, then check the terminal running `npm run dev`/`npm start` for a line like `Password reset requested for ... Reset link: /?token=...`. Opening that link (or pasting the token into the "Reset token" field on the frontend) lets you complete the reset.
- The frontend stores the JWT in `sessionStorage` for simplicity. For a production system, prefer an httpOnly cookie to reduce XSS exposure, with CSRF protection added accordingly.
