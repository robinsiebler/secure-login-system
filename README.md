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
| GET | `/api/profile` | Bearer token | Returns the logged-in user's profile. |
| GET | `/api/health` | none | Liveness check. |

## Security measures

- **Password storage**: bcrypt with a cost factor of 12; the client never receives or stores raw passwords.
- **SQL injection**: all queries use Oracle bind variables — user input is never concatenated into SQL.
- **Account lockout**: after 5 consecutive failed logins, an account is locked for 15 minutes.
- **Username enumeration resistance**: unknown-username and wrong-password responses are identical (`"Invalid username or password"`), and a dummy bcrypt comparison runs on unknown usernames so response timing doesn't leak which case occurred.
- **Rate limiting**: `/register`, `/login`, `/forgot-password`, and `/reset-password` are all throttled per-IP via `express-rate-limit`.
- **Password reset tokens**: a random 256-bit token is generated per request; only its SHA-256 hash is stored (see `PASSWORD_RESET_TOKENS` in `sql_queries/create_tables.sql`), so a database leak alone can't be used to reset accounts. Tokens expire after 30 minutes and are single-use (`USED_AT` is set once redeemed). `/forgot-password` returns an identical response whether or not the email is registered, to resist enumeration.
- **JWTs**: signed with a secret from the environment, 1-hour expiry, verified on every protected request.
- **Input validation**: username, email, and password format are validated server-side before touching the database (see `utils/validators.js`).
- **HTTP hardening**: `helmet` sets standard security headers; `cors` is explicit middleware rather than ad-hoc header handling.
- **Env var validation**: the app refuses to start if `PORT`, `DB_*`, or `JWT_SECRET` are missing.

## Tests & CI

```
npm run lint
npm test
```

GitHub Actions (`.github/workflows/node-ci.yaml`) runs lint and the Jest unit test suite on every push/PR to `main`. The test suite covers validation logic and JWT middleware only — it does not require a live Oracle connection, since Oracle isn't readily available as a CI service.

## Notes

- **No real email provider is configured.** `/forgot-password` does not send an actual email — it logs the reset link (including the token) to the server's console/terminal output instead. To test the reset flow: call `/forgot-password`, then check the terminal running `npm run dev`/`npm start` for a line like `Password reset requested for ... Reset link: /?token=...`. Opening that link (or pasting the token into the "Reset token" field on the frontend) lets you complete the reset.
- The frontend stores the JWT in `sessionStorage` for simplicity. For a production system, prefer an httpOnly cookie to reduce XSS exposure, with CSRF protection added accordingly.
