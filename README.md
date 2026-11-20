# Raqam

Raqam (رقم, "amount") is a personal finance and expense tracker: a single-user,
PKR-first web application for tracking accounts, income, expenses, transfers,
budgets, and more.

Status: M3 (core financial domain and database) complete; M4 (core frontend) in
progress. The API manages accounts, categories, and income / expense / transfer
transactions with ledger-based balances, behind cookie authentication and
optional 2FA. The frontend has its foundation (app shell, theme, UI kit, API
client) and placeholder pages; the feature screens are being built — see
`.ai/ROADMAP.md`.

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
  tests/
    Raqam.Domain.Tests/    unit tests for the entities and money rules (no database)
    Raqam.Api.Tests/       integration tests over HTTP against the real local PostgreSQL
scripts/
  m3-smoke.sh              curl walkthrough of the M3 API (see below)
frontend/
  raqam-web/               React + TypeScript + Vite + Tailwind CSS
docs/                      specification and architecture notes
.ai/                       AI project memory
```

## Requirements

- .NET SDK 10
- Node.js 22.12 or newer, with npm
- PostgreSQL 17

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

The API listens on http://localhost:5196. To use HTTPS (needed for the cookie
walkthroughs below, because the auth cookies are `Secure`), run it with the
`https` launch profile, which listens on https://localhost:7271:

```bash
dotnet run --project src/Raqam.Api --launch-profile https
```

Check it with:

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

There are two test projects:

- `Raqam.Domain.Tests` — fast unit tests of the entities and money rules; no
  database.
- `Raqam.Api.Tests` — integration tests that boot the API in-process and use
  the real local database configured above (there is no in-memory substitute).
  Each test creates its own throwaway user and deletes everything it created,
  so the tests can run against `raqam_dev` without touching your own data.
  They use a test host that raises the login rate limit; the rate-limit test
  itself runs against the real limit.

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
`/two-factor/recovery-code` (a recovery code), using the same
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

In the app, the same steps are on the **Security** page (QR code, 6-digit check, recovery codes
shown once, turn off with a confirmation); no curl needed.

Save the 10 recovery codes somewhere safe — each is single-use and lets you
sign in if you lose access to the authenticator app. `POST
/api/v1/auth/two-factor/disable` turns 2FA back off, and `GET
/api/v1/auth/two-factor/status` reports whether it's currently enabled.

Login attempts and 2FA verification share a rate limit: 5 attempts per
minute per IP address (D019), returning `429 Too Many Requests` beyond that.
The limit can be changed with the `RateLimiting:LoginPermitLimit` setting
(default 5; only the tests raise it).

## Accounts, categories and transactions

All endpoints are under `/api/v1`, need a signed-in session, and (for
`POST`/`PUT`/`DELETE`) the `X-CSRF-TOKEN` header described above.

| Endpoint | What it does |
|---|---|
| `GET/POST /accounts` | list / create accounts |
| `GET/PUT /accounts/{id}` | read / edit one account |
| `POST /accounts/{id}/archive` | archive (accounts with history are never deleted) |
| `GET /accounts/{id}/transactions` | that account's history (transfers appear on both sides) |
| `GET /accounts/{id}/balance?asOf=YYYY-MM-DD` | balance, with its components; `asOf` is optional |
| `GET/POST /categories`, `GET/PUT /categories/{id}`, `POST /categories/{id}/archive` | categories and one level of subcategories; archiving a parent archives its children |
| `GET/POST /transactions` | list (filterable) / create |
| `GET/PUT/DELETE /transactions/{id}` | read / edit / delete one transaction |

Rules worth knowing:

- Money is a decimal, always positive, at most 2 decimal places; the
  transaction type gives the direction. Currency is PKR.
- A transaction is one of three shapes: `Income` (one account and an income
  category), `Expense` (one account and an expense category), `Transfer`
  (a source and a different destination account, no category). A transfer is
  a single row and is never counted as income or expense.
- A balance is never stored: it is the opening balance plus income, minus
  expenses, plus transfers in, minus transfers out, computed in one database
  query.
- `PUT` needs the `version` from the last response; a stale one returns
  `409`. Another user's record is `404`, never `403`. A broken rule is `400`.
- `GET /transactions` filters: `from`, `to` (inclusive dates), `type`,
  `accountId` (either side of a transfer), `categoryId` (includes its
  subcategories), `search` (description or merchant), `sort`
  (`DateDesc` default, `DateAsc`, `AmountDesc`, `AmountAsc`), `page`,
  `pageSize` (default 20, max 100). The response is
  `{items, page, pageSize, totalCount, totalPages}`.

A short walkthrough (HTTPS, with the API running on the `https` profile):

```bash
BASE=https://localhost:7271
# Sign in, then fetch a CSRF token (it is tied to the signed-in user)
curl -sk -c jar.txt -X POST $BASE/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"A_Compliant_Password1!"}'
CSRF=$(curl -sk -b jar.txt -c jar.txt $BASE/api/v1/auth/csrf-token | jq -r .token)

# Two accounts and a category (the responses contain each id)
curl -sk -b jar.txt -X POST $BASE/api/v1/accounts -H "Content-Type: application/json" -H "X-CSRF-TOKEN: $CSRF" \
  -d '{"name":"Cash","accountType":"Cash","openingBalance":1000,"institutionName":null}'
curl -sk -b jar.txt -X POST $BASE/api/v1/accounts -H "Content-Type: application/json" -H "X-CSRF-TOKEN: $CSRF" \
  -d '{"name":"Bank","accountType":"BankAccount","openingBalance":0,"institutionName":"My Bank"}'
curl -sk -b jar.txt -X POST $BASE/api/v1/categories -H "Content-Type: application/json" -H "X-CSRF-TOKEN: $CSRF" \
  -d '{"name":"Food","type":"Expense","parentCategoryId":null,"colour":null,"icon":null}'

# An expense, then a transfer (use the ids returned above)
curl -sk -b jar.txt -X POST $BASE/api/v1/transactions -H "Content-Type: application/json" -H "X-CSRF-TOKEN: $CSRF" \
  -d '{"type":"Expense","amount":250.50,"transactionDate":"2026-11-11","sourceAccountId":"<cash-id>","categoryId":"<food-id>","description":"Lunch"}'
curl -sk -b jar.txt -X POST $BASE/api/v1/transactions -H "Content-Type: application/json" -H "X-CSRF-TOKEN: $CSRF" \
  -d '{"type":"Transfer","amount":300,"transactionDate":"2026-11-11","sourceAccountId":"<cash-id>","destinationAccountId":"<bank-id>"}'

# Balances: Cash = 1000 - 250.50 - 300 = 449.50, Bank = 300
curl -sk -b jar.txt $BASE/api/v1/accounts/<cash-id>/balance
curl -sk -b jar.txt $BASE/api/v1/accounts/<bank-id>/balance
```

`scripts/m3-smoke.sh` runs a much longer version of this against a running
API (login, every endpoint, the conflict and not-found cases, balances, filters,
paging) and prints a pass/fail count. It asks for the password, reads the email
from `RAQAM_EMAIL`, and leaves a few archived test accounts and categories in
the dev database.

## Run the frontend

The dev server proxies `/api` to the API over HTTPS (D037), so start the API
with the `https` launch profile first:

```bash
# terminal 1
cd backend/src/Raqam.Api
dotnet run --launch-profile https      # https://localhost:7271

# terminal 2
cd frontend/raqam-web
cp .env.example .env.local             # VITE_API_BASE_URL=/api/v1
npm install
npm run dev
```

Open http://localhost:5173. Requests go to `/api/v1/...` on the same origin and
Vite forwards them to the API (self-signed dev certificate accepted), so the
auth cookie and CSRF header behave as in production. The sign-in cookie is
`Secure`; Chrome and Firefox accept it on `http://localhost`, Safari may not.

Pages: Dashboard, Accounts (and each account's history), Categories, Transactions, Security.
An account never goes below zero and a transaction cannot be dated in the future; the forms
show what is available and stop at today, and the API refuses the same things. The transactions
list opens on this month so far; choose an earlier From date to look back.

Scripts: `npm run build` (typecheck and production build), `npm run lint`,
`npm test` (Vitest + Testing Library; the API is mocked at `fetch`),
`npm run test:watch`.

## Configuration

Copy `.env.example` to `.env` (and `frontend/raqam-web/.env.example` to
`.env.local`) and fill in local values. Real `.env` files are ignored by Git;
never commit secrets or real financial data.
