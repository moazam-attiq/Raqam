# Raqam

Raqam (رقم, "amount") is a personal finance and expense tracker: a single-user,
PKR-first web application for tracking accounts, income, expenses, transfers,
budgets, and more.

Status: M2 (authentication and security) nearly complete. No financial
features are implemented yet — see `.ai/ROADMAP.md`.

- Specification: [docs/raqam-project-specification.md](docs/raqam-project-specification.md)
- Project memory and current state: [.ai/CONTEXT.md](.ai/CONTEXT.md)

## Structure

```text
backend/
  Raqam.sln
  src/
    Raqam.Domain/          entities and domain rules; depends on nothing
    Raqam.Application/     use cases and contracts; depends on Domain
    Raqam.Infrastructure/  persistence and integrations; depends on Application, Domain
    Raqam.Api/             ASP.NET Core entry point; depends on Application, Infrastructure
frontend/
  raqam-web/               React + TypeScript + Vite + Tailwind CSS
docs/                      specification and architecture notes
.ai/                       AI project memory
```

## Requirements

- .NET SDK 10
- Node.js 22.12 or newer, with npm
- PostgreSQL 17 (from Phase 1)

## Database setup (local)

Raqam connects to a local PostgreSQL database. Using the PostgreSQL already
installed on your machine (see Requirements):

```bash
psql -U postgres -d postgres
```

```sql
CREATE ROLE raqam_dev LOGIN;
\password raqam_dev
CREATE DATABASE raqam_dev OWNER raqam_dev;
\q
```

The API never reads a password from a committed file. Store the connection
string with .NET user-secrets, scoped to `Raqam.Api`:

```bash
cd backend
dotnet user-secrets init --project src/Raqam.Api
dotnet user-secrets set "ConnectionStrings:Default" \
  "Host=localhost;Port=5432;Database=raqam_dev;Username=raqam_dev;Password=YOUR_PASSWORD" \
  --project src/Raqam.Api
```

Apply migrations (installs the pinned `dotnet-ef` tool for this repo the
first time):

```bash
dotnet tool restore
dotnet ef database update --project src/Raqam.Infrastructure --startup-project src/Raqam.Api
```

## Run the API

```bash
cd backend
dotnet build Raqam.sln
dotnet run --project src/Raqam.Api
```

The API listens on http://localhost:5196. Check it with:

```bash
curl http://localhost:5196/health
```

A healthy response confirms the API can also reach the database. The OpenAPI
document is served in Development at http://localhost:5196/openapi/v1.json.

## Run the backend tests

```bash
cd backend
dotnet test Raqam.sln
```

The integration test boots the API in-process and checks `/health` against
the real local database configured above — there is no in-memory substitute.

## Authentication

Raqam is single-user. There is no registration endpoint (D017) — the one
user is created by `DatabaseSeeder` on startup from `SeedUser:Email` /
`SeedUser:Password` in user-secrets:

```bash
dotnet user-secrets set "SeedUser:Email" "you@example.com" --project src/Raqam.Api
dotnet user-secrets set "SeedUser:Password" "A_Compliant_Password1!" --project src/Raqam.Api
```

The password must meet Identity's default policy (12+ characters, upper and
lower case, a digit, a symbol). The seeder only runs when no user exists yet,
so changing these values later has no effect until the database is reset.

Authentication is a secure, HttpOnly cookie (D016), not a bearer token.
Every unsafe-verb request (`POST`/`PUT`/`PATCH`/`DELETE`) needs a matching
CSRF token — fetch one first and echo it back in the `X-CSRF-TOKEN` header
(D018):

```bash
# 1. Get a CSRF token (also sets the XSRF-TOKEN cookie)
curl -c cookies.txt http://localhost:5196/api/v1/auth/csrf-token
# => {"token":"<csrf-token>"}

# 2. Log in (no CSRF token required here — no session exists yet to check it against)
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5196/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"A_Compliant_Password1!"}'

# 3. Confirm the session
curl -b cookies.txt http://localhost:5196/api/v1/auth/me
```

If 2FA is enabled on the account, step 2 instead returns that a second
factor is required; complete the sign-in with `POST
/api/v1/auth/two-factor/verify` (authenticator code) or
`/two-factor/redeem-recovery-code` (a recovery code), using the same
cookie jar.

### Enabling 2FA (TOTP)

Once logged in (steps 1–3 above), using the same `cookies.txt` jar and a
fresh CSRF token for the mutating calls:

```bash
# Get a fresh CSRF token for the mutating calls below
CSRF=$(curl -b cookies.txt -c cookies.txt -s http://localhost:5196/api/v1/auth/csrf-token | jq -r .token)

# Start enrollment: returns the shared key and an otpauth:// URI
curl -b cookies.txt http://localhost:5196/api/v1/auth/two-factor/setup
# => {"sharedKey":"...","authenticatorUri":"otpauth://totp/..."}

# Render the otpauth:// URI as a QR code (or enter the shared key manually)
# in an authenticator app (Google Authenticator, Authy, 1Password, etc.),
# then confirm the 6-digit code it shows:
curl -b cookies.txt -X POST http://localhost:5196/api/v1/auth/two-factor/enable \
  -H "Content-Type: application/json" -H "X-CSRF-TOKEN: $CSRF" \
  -d '{"code":"123456"}'
# => {"recoveryCodes":["...", ... 10 codes total]}
```

Save the 10 recovery codes somewhere safe — each is single-use and lets you
sign in if you lose access to the authenticator app. `POST
/api/v1/auth/two-factor/disable` turns 2FA back off, and `GET
/api/v1/auth/two-factor/status` reports whether it's currently enabled.

Login attempts and 2FA verification share a rate limit: 5 attempts per
minute per IP address (D019), returning `429 Too Many Requests` beyond that.

## Run the frontend

```bash
cd frontend/raqam-web
npm install
npm run dev
```

The dev server listens on http://localhost:5173.

Other scripts: `npm run build` (typecheck and production build), `npm run lint`.

## Configuration

Copy `.env.example` to `.env` (and `frontend/raqam-web/.env.example` to
`.env.local`) and fill in local values. Real `.env` files are ignored by Git;
never commit secrets or real financial data.
