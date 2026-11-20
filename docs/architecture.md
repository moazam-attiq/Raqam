# Architecture

Raqam is a layered modular monolith (spec §5): one ASP.NET Core API, one
PostgreSQL database, no microservices. This file tracks what each project is
responsible for and what actually exists so far; `.ai/PROJECT.md` has the full
rationale and the business rules this architecture exists to serve.

## Projects

```text
Raqam.Api ───────────────► Raqam.Application
    │                            ▲
    └────► Raqam.Infrastructure ─┘

Raqam.Application ───────► Raqam.Domain
Raqam.Infrastructure ────► Raqam.Application
Raqam.Infrastructure ────► Raqam.Domain
```

- **Raqam.Domain** — entities, enums, domain rules. No dependency on EF Core,
  HTTP, or UI. `Account`, `Category` and `Transaction` enforce their own rules
  in factory and update methods (`Create`, `Update`, `Archive`), so a bad row
  cannot be built whatever calls them. `Common/MoneyRules` holds the amount
  rule, and a broken rule throws `DomainException`.
- **Raqam.Application** — use cases, request/response contracts, validators,
  and persistence abstractions. Services are plain scoped classes
  (`AccountService`, `CategoryService`, `TransactionService`, `LedgerService`),
  no mediator library (D035). They depend on repository interfaces, `IUnitOfWork`,
  `ICurrentUser` and `TimeProvider`, never on EF Core.
- **Raqam.Infrastructure** — EF Core (`RaqamDbContext`), PostgreSQL via
  Npgsql, entity configurations, migrations, repositories, `UnitOfWork`, and
  Identity. Registered through `AddInfrastructure` in `DependencyInjection.cs`.
- **Raqam.Api** — composition root, controllers, middleware. Controllers are
  thin: they call a service and shape the HTTP response. Also registers
  exception handling, request validation, health checks, rate limiting, CSRF
  and OpenAPI.

Tests live beside `src/`: `Raqam.Domain.Tests` (no database) and
`Raqam.Api.Tests` (HTTP against the real local PostgreSQL).

## Cross-cutting pieces (M1)

- **Database access:** `RaqamDbContext` (Infrastructure), connection string
  from `ConnectionStrings:Default`, supplied locally via .NET user-secrets
  (D011) and in hosted environments via the `ConnectionStrings__Default`
  environment variable.
- **Error handling:** `GlobalExceptionHandler` (Api) converts any unhandled
  exception to a `ProblemDetails` response; the exception detail is included
  only in Development.
- **Validation:** FluentValidation, applied through a custom `ValidationFilter`
  action filter rather than an automatic-integration package (D013). It
  validates every action argument by its runtime type, including `[FromQuery]`
  records. Validators sit next to their contracts in Application.
- **Logging:** built-in console providers, single-line in Development, JSON
  lines once hosted (D014). No third-party logging package.
- **API documentation:** the built-in `Microsoft.AspNetCore.OpenApi` package
  (D012), Development only, served at `/openapi/v1.json`.
- **Health check:** `GET /health` (Api), including `DatabaseHealthCheck`,
  which calls `CanConnectAsync` against the real database.

## Cross-cutting pieces (M3)

- **Ledger-first balances (D006):** no balance is stored. A balance is the
  opening balance plus income, minus expense, plus transfers in, minus transfers
  out, from one aggregate SQL query with four conditional sums and an optional
  inclusive `asOf` date. `Transaction.SignedEffectOn` is the single definition
  of direction; the tests check the SQL against it.
- **Transaction shapes (D023):** one table, three shapes (income, expense,
  transfer). A transfer is a single row, so it can never be half-applied, and
  it is excluded from income/expense totals by construction.
- **Ownership (D026):** every record carries a `UserId`. Every repository query
  filters by `ICurrentUser.UserId`, and a request never carries a user id, so
  another user's record is simply "not found" (404, no existence leak). The
  database backs this with composite keys `(UserId, Id)` and composite foreign
  keys (D033), so a row cannot reference another user's account or category
  even if the application were wrong.
- **Optimistic concurrency (D027):** each entity maps PostgreSQL's `xmin` to a
  `uint Version`. An update must send the version it last saw; a stale one is
  rejected with 409, either by an explicit check or when `UnitOfWork` turns a
  `DbUpdateConcurrencyException` into `ConflictException`.
- **Error mapping:** `GlobalExceptionHandler` turns `DomainException` into 400,
  `NotFoundException` into 404 and `ConflictException` into 409, all as
  `ProblemDetails`; anything else is a 500.
- **Database constraints (D033):** check constraints for a positive amount,
  a valid type, and the shape of each transaction type; all foreign keys are
  `Restrict` (history is never cascaded away, D029); unique account names per
  user and unique category names per user, parent and type (`NULLS NOT DISTINCT`).
- **Listing (D036):** transaction filters, sort and paging are built in the
  repository and run in the database; search escapes `%` and `_` and uses a
  case-insensitive match. List responses are `{items, page, pageSize,
  totalCount, totalPages}`.
- **No negative balances (D049):** `BalanceGuard` (Application) refuses a create, edit or delete
  that would take an account below zero, and touches the account row so two simultaneous spends
  conflict instead of both passing. Only the current balance is checked, not each past day.
- **No future dates (D051):** `Transaction.Apply` refuses a date after UTC today plus one day.
- **Single transaction per request:** a transfer is one row; the only
  multi-record change is archiving a parent category together with its
  children, which is one `SaveChangesAsync` and so one database transaction.

## Frontend (M4)

`frontend/raqam-web` is a single-page app: React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI
primitives (D038). It only talks to the API; it holds no money rules of its own beyond guidance
(the server is the authority, D049/D051).

```text
src/
  components/ui/       Button, Input, FormField, Dialog, ConfirmDialog, DateField, Table, ...
  components/layout/   AppShell (sidebar, navbar), PageHeader, NotFound
  components/theme/    light / dark / system, persisted, applied before first paint
  features/<area>/     accounts, categories, transactions, dashboard, auth, security:
                       each has its pages, dialogs, <area>-api.ts (TanStack Query hooks) and tests
  lib/                 api client, money, dates, query client
  test/                fetch mock and render helper used by every feature test
```

- **API access:** one client (`lib/api/client.ts`) adds the CSRF header, retries once on a stale
  token, and turns every failure into an `ApiError` with a kind (`validation`, `rule`, `conflict`,
  `unauthorized`, ...) whose message is safe to show. In development Vite proxies `/api` to the
  HTTPS API (D037).
- **Server state:** TanStack Query, 30 s stale time. After a change, the lists and balances it
  affects are invalidated (D046). Nothing is copied into component state.
- **URL is state:** transaction filters, sort and page live in the address, so a view can be
  reloaded or shared. The default view is this month so far (D050).
- **Forms:** react-hook-form with zod. Amounts are parsed from text, never rounded, at most 2
  decimals (`lib/money.ts`, D030). A 409 offers "load the latest" and saves against the new
  version; a duplicate name keeps what was typed (D045).
- **Guidance, not authority:** the transaction form shows "Available: Rs X" and blocks an amount
  above it, and the date picker stops at today; the server refuses the same things (D049, D051).
- **Sign-in and 2FA:** cookie session; the sign-in page handles the code and recovery-code steps,
  and `/security` turns two-step verification on and off (D043, D052).
- **Quality:** each page has loading, empty and error states; checked with axe-core in light and
  dark and at 390, 768, 1024 and 1440 px (D048); dialogs return focus to what opened them.
- **Tests:** Vitest and Testing Library with `fetch` replaced per test (D039). Run `npm test`.

## Why this split

The dependency direction keeps business rules (Domain, Application) free of
persistence and web-framework details, so the financial rules in spec §4 can
be unit-tested without a database and without HTTP. Infrastructure and Api
are the only projects allowed to know about EF Core or ASP.NET Core.

See `.ai/DECISIONS.md` for the reasoning behind each specific choice (D001
onward) and `.ai/ROADMAP.md` for what each milestone adds here.
