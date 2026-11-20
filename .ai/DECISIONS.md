# DECISIONS.md — Architectural decision record

Append-only. Never delete or rewrite a decision. To change one, append a new
entry that references and supersedes it, and mark the old one
`Status: Superseded by Dnnn`.

D001–D008 were made by the user in the baseline specification
(`docs/raqam-project-specification.md`, v1.0) and are recorded here on the date
of that document. Decisions still open are listed in `PROJECT.md` under "Open
technical decisions"; record them here when made.

---

## 2026-11-10 — D001: Layered modular monolith

**Status:** Active. Source: spec §5.1, §2.

**Decision:** One deployable ASP.NET Core API, one PostgreSQL database, with
four internal projects (Domain, Application, Infrastructure, Api) and the
dependency direction in spec §5.4.

**Why:** Separation of concerns without the operational overhead of
microservices; no scaling or team-ownership need justifies distribution.

**Alternatives considered:** Microservices — rejected for the MVP (distributed
transactions, service discovery, brokers, extra deployments).

**Consequence:** Domain must stay free of EF Core, HTTP, and UI dependencies.
Extra infrastructure is introduced only when justified.

## 2026-11-10 — D002: Technology stack

**Status:** Active. Source: spec §2, §5.2.

**Decision:** Backend ASP.NET Core Web API on .NET 10 with C#, EF Core, Npgsql.
Frontend React + TypeScript + Vite + Tailwind CSS, with React Router, TanStack
Query, React Hook Form, Zod, Recharts. Database PostgreSQL.

**Why:** Chosen by the user as the confirmed product decisions.

**Alternatives considered:** None recorded in the specification.

**Consequence:** Dependencies are added per phase, not all up front. CsvHelper,
ClosedXML, and QuestPDF are candidates to evaluate and pin when needed, not
commitments.

## 2026-11-10 — D003: Hosting on Vercel, Render, and Neon

**Status:** Active. Source: spec §2, §9.

**Decision:** Frontend on Vercel; API on Render from a Dockerfile; PostgreSQL on
Neon; GitHub as source control and deployment source.

**Why:** Affordable hosting without a personally managed VPS.

**Alternatives considered:** Self-managed VPS — excluded by the product goals.

**Consequence:** Frontend and API will likely be on different domains, which
drives the open cookie-vs-JWT, CORS, SameSite, and CSRF decisions. Free tiers
may sleep or suspend; treat them as development/demo, and recheck limits and
pricing before launch. Scheduled work cannot rely on a sleeping web service.

## 2026-11-10 — D004: Single-user and PKR-only, but every record is owner-scoped

**Status:** Active. Source: spec §1, §4, §6.1.

**Decision:** The first release serves one user in PKR only. Even so, every
financial record carries a `UserId` (UUID) and every query is owner-scoped,
with the owner derived from the authenticated principal.

**Why:** Prevents accidental cross-account access and keeps the model
extensible.

**Alternatives considered:** Omitting ownership for a single-user app —
rejected by the specification.

**Consequence:** Ownership tests are required (spec §10.2 item 13). Multi-user
and multi-currency features themselves remain out of scope.

## 2026-11-10 — D005: Money representation

**Status:** Active. Source: spec §3.2, §4, §6.

**Decision:** Monetary values are `decimal` / `numeric(18,2)`, stored as
positive amounts; transaction type determines direction. Floating-point types
are never used for money.

**Why:** Financial correctness.

**Alternatives considered:** Signed amounts; integer minor units — not adopted
by the specification.

**Consequence:** Positive-amount check constraints in the database; CSV import
must interpret debit/credit or signed columns into type + positive amount.

## 2026-11-10 — D006: Ledger-first account balances

**Status:** Active. Source: spec §6.4, §16 item 3.

**Decision:** Account balance is calculated from opening balance plus ledger
movements. The transaction ledger is the source of truth. A cached balance is
added only if measured performance requires it, and then it must be updated
transactionally with reconciliation tests.

**Why:** One canonical approach that is easy to prove correct.

**Alternatives considered:** Maintained/cached balance column from the start —
deferred.

**Consequence:** No `CurrentBalance` column initially. Debt and savings records
do not change a balance unless linked to a real account movement.

## 2026-11-10 — D007: ASP.NET Core Identity with TOTP 2FA

**Status:** Active. Source: spec §2, §6.1, §8.1.

**Decision:** Authentication uses ASP.NET Core Identity with UUID user IDs,
authenticator-app TOTP, and recovery codes managed through Identity's supported
mechanisms.

**Why:** Avoids a custom password table and custom crypto.

**Alternatives considered:** Custom auth tables — rejected.

**Consequence:** Transport (HttpOnly cookie vs JWT) and public registration are
still open and must be decided in M2. Long-lived access tokens must not be
stored in localStorage.

## 2026-11-10 — D008: CSV-only import through staging with idempotent confirmation

**Status:** Active. Source: spec §2, §3.6, §7.7.

**Decision:** The initial import format is CSV only. Upload/preview and
confirmation are separate operations backed by staging records
(ImportBatches / ImportRows). Confirmation is idempotent. Duplicate detection
uses a normalized fingerprint, not date and amount alone, and is a
likely-duplicate signal the user can review.

**Why:** Importing without creating duplicate or unreviewed transactions.

**Alternatives considered:** PDF and Excel statement import — deferred.

**Consequence:** File size and row-count limits, content validation, and
formula-injection protection on exports are required.

## 2026-11-10 — D009: Project memory in `.ai/`, specification kept in `docs/`

**Status:** Active. Source: session 1.

**Decision:** Persistent AI project memory lives in `.ai/` (seven files). The
user's specification is stored unmodified at
`docs/raqam-project-specification.md` and is the authoritative scope; `.ai/`
summarizes it and tracks state.

**Why:** The specification was supplied outside the repository; a future
session could not read it otherwise.

**Alternatives considered:** Copying the specification into `.ai/` — rejected
to keep `.ai/` to its seven files. Relying on `PROJECT.md` alone — rejected
because it is a summary.

**Consequence:** If the user revises the specification, replace the copy in
`docs/` and reconcile `.ai/`. The user may move or rename the copy; update the
references in `PROJECT.md` and `CONTEXT.md` if so.

## 2026-11-10 — D010: API endpoints use controllers

**Status:** Active. Source: session 2; resolves the controllers-vs-minimal-APIs
choice left open in spec §5.3.

**Decision:** Raqam.Api uses MVC controllers (`AddControllers` /
`MapControllers`, `[ApiController]`, routes under `api/v1/...`). Minimal API
endpoints are not mixed in.

**Why:** The specification asks for one consistent approach and says the
initial project can use controllers. Chosen by the AI while scaffolding; the
user has not explicitly reviewed it.

**Alternatives considered:** Minimal APIs — permitted by the specification,
not chosen.

**Consequence:** New endpoints are controller classes in
`Raqam.Api/Controllers`. Cheap to reverse now (one placeholder controller);
reverse only through a new decision.

## 2026-11-10 — D011: Local development uses the Mac's installed PostgreSQL and .NET user-secrets

**Status:** Active. Source: session 3; user chose the installed PostgreSQL.

**Decision:** Local development connects to the PostgreSQL 17 installed on the
developer's Mac, database `raqam_dev`, role `raqam_dev` (not the `postgres`
admin). The API reads `ConnectionStrings:Default`; locally the value is stored
with .NET user-secrets on `Raqam.Api`, and hosted environments supply it as the
environment variable `ConnectionStrings__Default`.

**Why:** Simplest repeatable setup (spec §9.5); user-secrets keeps the password
outside the repository without extra packages.

**Alternatives considered:** Podman PostgreSQL container — available, not
needed yet. A `.env` file loaded by the API — would need an extra package.

**Consequence:** No `docker-compose.yml` yet. The API fails fast at startup if
the connection string is missing. The database health check lives in
`Raqam.Api` because Infrastructure has no health-check package.

## 2026-11-10 — D012: Built-in Microsoft.AspNetCore.OpenApi for API documentation

**Status:** Active. Source: session 3 (M1 Part 2).

**Decision:** Use the built-in `Microsoft.AspNetCore.OpenApi` package
(`AddOpenApi()` / `MapOpenApi()`) rather than Swashbuckle.AspNetCore. The
document is served at `/openapi/v1.json` in Development only.

**Why:** It is the current Microsoft-recommended, in-box approach for .NET 9+
and needs no third-party dependency. The specification names "Swagger/OpenAPI"
generically (spec §5.2, §7) without mandating Swashbuckle specifically.

**Alternatives considered:** Swashbuckle.AspNetCore — gives a browsable
Swagger UI page out of the box; the built-in package does not by itself. If a
UI is wanted later, add Swashbuckle (or a lightweight viewer such as Scalar)
pointed at the generated document; this does not need a new architectural
decision, just a package add.

**Consequence:** Nothing is exposed outside Development. No Swagger UI exists
yet — only the raw JSON document — until/unless a UI package is added.

## 2026-11-11 — D013: FluentValidation with a custom action filter, not an automatic-integration package

**Status:** Active. Source: session 4 (M1 Part 2).

**Decision:** Use `FluentValidation` with `FluentValidation.DependencyInjectionExtensions`
for validators, and a small hand-written `ValidationFilter` (`IAsyncActionFilter`
in `Raqam.Api/Validation`) that resolves `IValidator<T>` for each action
argument and turns failures into the standard `ValidationProblemDetails`
shape. Registered globally via `AddControllers(options =>
options.Filters.Add<ValidationFilter>())` and `AddValidatorsFromAssemblyContaining<Program>()`.

**Why:** FluentValidation's own automatic ASP.NET Core MVC integration package
was deprecated upstream; a ~25-line filter is simpler than adopting a
third-party replacement, and keeps the error shape consistent with
`[ApiController]`'s existing model-binding validation.

**Alternatives considered:** `FluentValidation.AspNetCore` — deprecated, not
used. Data annotations alone — rejected as less expressive for the
cross-field rules the spec requires (e.g. transfer source ≠ destination).
A third-party automatic-validation package — an extra dependency for
something this small.

**Consequence:** No validators exist yet (no request DTOs exist before Phase
3). When DTOs move to `Raqam.Application`, change
`AddValidatorsFromAssemblyContaining<Program>()` to also scan that assembly's
marker type.

## 2026-11-11 — D014: Built-in console logging, no logging package

**Status:** Active. Source: session 4 (M1 Part 2).

**Decision:** Use the ASP.NET Core SDK's built-in console logging providers —
`AddSimpleConsole` (single-line, timestamped) in Development, `AddJsonConsole`
otherwise. No Serilog or other third-party logging package.

**Why:** Meets spec §11 Phase 1's "establish logging" and rule 15 (no secrets
in logs — nothing here logs request bodies) without adding a dependency.
JSON lines are easy for Render or any log collector to parse once hosted.

**Alternatives considered:** Serilog with sinks — more capable (structured
properties, sinks to external services) but unneeded at this size; revisit if
a hosted log aggregator is adopted in M10.

**Consequence:** Log format changes by environment. If a specific field
format or external sink is needed later, this decision is revisited, not
silently changed.

## 2026-11-11 — D015: Pin Microsoft.EntityFrameworkCore explicitly in Infrastructure

**Status:** Active. Source: session 4; fixes an MSB3277 warning from `dotnet build`.

**Decision:** Add an explicit `PackageReference` to `Microsoft.EntityFrameworkCore`
version `10.0.14` in `Raqam.Infrastructure.csproj`, matching the version pulled
in transitively by `Microsoft.EntityFrameworkCore.Design` in `Raqam.Api`.

**Why:** `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 depends on
`Microsoft.EntityFrameworkCore` 10.0.4, which conflicted with the 10.0.14
pulled in elsewhere; MSBuild silently picked 10.0.4 and only warned (MSB3277).
Pinning removes the ambiguity instead of relying on MSBuild's unification
choice.

**Alternatives considered:** Central Package Management
(`Directory.Packages.props`) — a cleaner long-term fix once there are more
projects and packages to keep in sync; deferred until it earns its complexity.
Ignoring the warning — rejected; a silent version choice is exactly the kind
of thing that causes a working build to behave unexpectedly at runtime.

**Consequence:** Whenever `Npgsql.EntityFrameworkCore.PostgreSQL` is upgraded,
check whether this pinned version still matches what it expects, and bump
both together.

## 2026-11-11 — D016: Cookie-based authentication

**Status:** Active. Source: session 4; resolves spec §16 open decision 1.

**Decision:** Authentication uses a secure, HttpOnly cookie issued by ASP.NET
Core Identity, not a JWT. No access token is ever stored in the frontend
(spec §7.1 explicitly rules out localStorage for long-lived tokens).

**Why:** User chose this. For a single-user app with one trusted frontend
origin, a cookie is simpler to reason about and keeps the token out of
JavaScript entirely; the cross-site cookie configuration it requires
(`SameSite=None; Secure` once frontend and API are on different domains) is
manageable with one known origin.

**Alternatives considered:** JWT — avoids cross-site cookie configuration but
pushes storage and refresh concerns onto the frontend; not chosen.

**Consequence:** CORS must allow credentials from the exact frontend origin
(no wildcard). CSRF protection is required because the browser will send the
cookie automatically on cross-site requests; antiforgery tokens or the
`SameSite` setting must cover this. Revisit if a future client (e.g. a
mobile app) can't use cookies.

## 2026-11-11 — D017: Public registration disabled; single user is seeded

**Status:** Active. Source: session 4; resolves spec §16 open decision 2.

**Decision:** No `POST /auth/register` endpoint. The single user is created
by a startup/seed step (or a one-off script) instead of a public endpoint.

**Why:** User chose this. Raqam is single-user by design (spec §1); a
registration endpoint that can never legitimately be used by a second person
is attack surface with no product purpose.

**Alternatives considered:** A registration endpoint gated behind a setup
token or disabled by configuration — more moving parts for the same outcome;
not chosen.

**Consequence:** The seed step must not run against a database that already
has a user, and must not log the generated password. Exact mechanism (EF
Core seed data vs. a startup check vs. a CLI command) is decided during
implementation and recorded here once built.

## 2026-11-11 — D018: CSRF via ASP.NET Core antiforgery (double-submit header)

**Status:** Active. Source: session 5.

**Decision:** Every unsafe-verb action (`POST`/`PUT`/`PATCH`/`DELETE`)
requires a validated antiforgery token, enforced globally via a
project-written `CsrfFilter` (`Raqam.Api.Validation`) added as an MVC filter
in `AddControllers`. `GET /auth/csrf-token` issues the token (cookie
`XSRF-TOKEN` + a request token returned in the response body) for the
frontend to echo back in the `X-CSRF-TOKEN` header. `POST /auth/login` is
exempted via `[SkipCsrfValidation]`, since no session exists yet to have
handed out a matching token before the user signs in.

**Implementation note (corrected during the same session):** the first
attempt used the built-in `AutoValidateAntiforgeryTokenAttribute`, which
failed at request time with `No service for type
...AutoValidateAntiforgeryTokenAuthorizationFilter has been registered` —
that attribute resolves its filter through DI registrations that only
`AddControllersWithViews`/`AddMvc` set up (MVC's view-engine "ViewFeatures"
services), which this API-only project (`AddControllers`) doesn't register.
`CsrfFilter` is a small `IAsyncActionFilter` that calls
`IAntiforgery.ValidateRequestAsync` directly instead, with the same
behavior and no dependency on the view engine. `[SkipCsrfValidation]` is the
project's own marker attribute, replacing `[IgnoreAntiforgeryToken]` for the
same reason.

**Why:** The cookie-based auth transport (D016) needs `SameSite=None` to
work across the Vercel/Render domain split, which rules out `SameSite` as a
CSRF defense on its own (spec §7.1/§16 flagged this as a consequence of
D016). The built-in antiforgery system is the standard ASP.NET Core answer
and needs no extra package.

**Alternatives considered:** Custom header-presence check (e.g. requiring a
`X-Requested-With` header) — weaker, since it only relies on browsers
refusing to let cross-site requests set custom headers without CORS
pre-flight, which isn't a documented security guarantee; not chosen. Login
CSRF (forging a login request to log the single known seed user into an
attacker-controlled session) was considered and accepted as out of scope for
now given there's no sensitive action reachable without owner-scoped data
yet (M3+).

**Consequence:** The frontend must call `GET /auth/csrf-token` once and send
the token back as `X-CSRF-TOKEN` on every mutating request, including
`POST /auth/logout` and every endpoint from M3 onward. Revisit the
login-CSRF decision once the app has state worth protecting at that point.

## 2026-11-11 — D019: Rate limiting on login via the built-in RateLimiting middleware

**Status:** Active. Source: session 5.

**Decision:** `POST /auth/login` is limited to 5 attempts per minute per
client IP address, using `Microsoft.AspNetCore.RateLimiting`'s fixed-window
limiter (`AddRateLimiter`/`UseRateLimiter`, policy applied via
`[EnableRateLimiting("login")]`). Exceeding it returns `429 Too Many
Requests` with no queueing.

**Why:** Spec §8.1 calls for rate limiting on login. Keying by IP (rather
than the submitted email) also slows down guessing against emails that
don't exist yet, which Identity's own per-account lockout (configured in
`AddInfrastructure`) can't do since it only engages once an account is
actually found. No extra package needed — it ships with the ASP.NET Core
SDK, consistent with the project's preference for built-in options over
third-party packages where one suffices (see D012/D013/D014).

**Alternatives considered:** A sliding-window or token-bucket limiter —
smoother under bursty legitimate traffic, but this is a single-user login
endpoint with no legitimate burst pattern to protect; the simpler fixed
window was chosen. Keying by submitted email instead of IP — would let an
attacker rotate IPs to dodge it per-address but also lets one misbehaving IP
lock out everyone sharing it (NAT, campus Wi-Fi); IP was chosen since there
is exactly one legitimate account and sharing isn't a realistic concern
here.

**Consequence:** The same `"login"` policy (or a dedicated one) should be
applied to the TOTP 2FA verify endpoint once it's built, since it's an
equally attractive brute-force target. Revisit the limit (5/minute) if it
proves too tight for normal use once there's a real frontend driving retries
after typos.

**Amendment (M3, Part 5):** the permit limit is read from configuration key
`RateLimiting:LoginPermitLimit`, default 5. The default is the behaviour in every real
environment. Only the integration-test host (`ApiFactory`) raises it, because those
tests sign in a fresh user per test; `RateLimitingTests` runs against the default and
still proves the 6th attempt in a minute returns 429.

## 2026-11-11 — D020: TOTP 2FA via ASP.NET Core Identity's built-in mechanisms

**Status:** Active. Source: session 5; completes D007's 2FA commitment.

**Decision:** 2FA is implemented entirely through Identity's existing
`UserManager`/`SignInManager` APIs — `GetAuthenticatorKeyAsync` /
`ResetAuthenticatorKeyAsync` for enrollment, `VerifyTwoFactorTokenAsync` /
`SetTwoFactorEnabledAsync` to enable, `GenerateNewTwoFactorRecoveryCodesAsync`
(10 codes) on enable, and `TwoFactorAuthenticatorSignInAsync` /
`TwoFactorRecoveryCodeSignInAsync` to complete a login that Identity has
already flagged as requiring a second factor. A new `TwoFactorController`
(`api/v1/auth/two-factor`) exposes `Status`, `Setup`, `Enable`, `Disable`,
`Verify`, and `RedeemRecoveryCode`. `Setup` returns the shared key and an
`otpauth://` URI the frontend renders as a QR code; no server-side QR
generation. `Verify` and `RedeemRecoveryCode` are `[AllowAnonymous]` (the
user isn't fully signed in yet at that point) and `[SkipCsrfValidation]`
(same reasoning as `POST /auth/login` in D018 — no session/token exists yet),
and carry the same `[EnableRateLimiting("login")]` policy as login per D019's
consequence note, since they're an equally attractive brute-force target.

**Why:** Avoids reimplementing RFC 6238 TOTP or RFC 4648 Base32 by hand;
Identity's mechanisms are the supported, audited path and were already
committed to in D007.

**Alternatives considered:** A "remember this device" cookie to skip 2FA on
trusted devices — not implemented; the spec doesn't call for it and it adds
attack surface for a single-user app. A separate, dedicated rate-limit policy
for the 2FA endpoints instead of reusing `"login"` — not chosen; the two
endpoints protect the same account and a shared budget is simpler to reason
about.

**Consequence:** The frontend must handle the two-step login flow (initial
`POST /auth/login` succeeding but indicating 2FA is required, then a second
call to `Verify` or `RedeemRecoveryCode` to actually establish the session).
Recovery codes are single-use and Identity consumes them automatically on
redemption; the UI should prompt the user to regenerate and re-save them once
the supply runs low (not yet built — no endpoint surfaces remaining-code
count).

## 2026-11-11 — D021: Default categories are per-user owned rows

**Status:** Active. Source: session 6 (M3 Part 0); spec §3.4, §4 rule 4.

**Decision:** The default category set (spec §3.4 examples) is created as
ordinary owner-scoped `Categories` rows for the user, by the seeder, only when
that user has no categories yet. There are no global/system rows and no
nullable `UserId` on categories.

**Why:** User chose this. Ownership stays uniform (every row has a `UserId`,
every query is owner-scoped), and the user can rename or archive defaults like
any other category.

**Alternatives considered:** Global system rows with `UserId = null` — needs
special-case ownership checks and cannot be customised per user; not chosen.

**Consequence:** The seeder must be idempotent for categories (never
re-create defaults the user archived or renamed). A future second user would
need the same seeding step.

## 2026-11-11 — D022: Transaction date is a plain date

**Status:** Active. Source: session 6 (M3 Part 0); spec §3.2, §4 rule 8.

**Decision:** `TransactionDate` is a date only (`DateOnly` in the domain,
PostgreSQL `date`). There is no time-of-day field in M3. Ordering within a day
falls back to `CreatedAtUtc`. Persisted audit timestamps stay UTC.

**Why:** User chose this. A plain date cannot shift with timezone conversion
(rule 8), and it is the simplest model for lists, filters, and CSV import.

**Alternatives considered:** Date plus a nullable `TransactionTime` (the
literal reading of "date and optional time" in spec §3.2) — adds a field every
list, filter, and import must handle; can be added later with a migration if a
real need appears.

**Consequence:** Bank-statement times are not preserved in M3. Revisit in M6
if CSV import needs them for duplicate detection.

## 2026-11-11 — D023: Transfers are created through `/transactions`

**Status:** Active. Source: session 6 (M3 Part 0); spec §7.3, §7.5.

**Decision:** A transfer is one `Transactions` row with `Type = Transfer`, a
source account, and a destination account, created/edited/deleted through the
same `POST/PUT/DELETE /transactions` endpoints as income and expenses. There
is no separate `/transfers` endpoint and no pair of linked rows.

**Why:** User chose this. One create/edit/delete path and one set of domain
rules; a single row cannot get out of sync with a "matching" row, so the
source decrease and destination increase are always equal by construction.

**Alternatives considered:** A dedicated `/transfers` endpoint reusing the
same domain rules — cleaner request shapes but more controllers and DTOs.
Two linked rows per transfer — rejected; the spec's data model (§6.2) uses
one row.

**Consequence:** The transaction request DTO is type-dependent (destination
account required only for transfers; category required only for income and
expense), enforced by both the validator and database check constraints.

## 2026-11-11 — D024: Balances may go negative; archived accounts and categories reject new activity

**Status:** Active. Source: session 6 (M3 Part 0); spec §3.3, §3.4, §4 rule 9.

**Decision:** No overdraft check: an expense or transfer may take an account
below zero. Archiving an account or category keeps all history and keeps it
visible in reports, but new transactions cannot reference an archived account
or category.

**Why:** User chose this. A "no negative balance" rule makes editing or
deleting an old transaction fail unpredictably, because it changes the running
balance retroactively.

**Alternatives considered:** Rejecting any operation that would take the
source below zero — safer for cash accounts but brittle for edits/deletes.

**Consequence:** Overspending is surfaced later through budgets/warnings (M5),
not blocked in the ledger.

## 2026-11-11 — D025: Application reaches persistence through narrow repository-style interfaces

**Status:** Active. Source: session 6 (M3 Part 0), confirmed by the user; spec §5.4, D001.

**Decision:** Application defines small persistence interfaces (repository-style); Infrastructure implements them over `RaqamDbContext`. Application takes no EF Core package reference.

**Why:** Keeps the dependency direction in D001/spec §5.4 and lets Application logic be tested without a database.

**Alternatives considered:** An `IRaqamDbContext` interface exposing `DbSet`s — less code, but adds an EF Core reference to Application and leaks `IQueryable` into use cases; not chosen.

**Consequence:** Interfaces are added per aggregate as needed (accounts, categories, transactions, balance/totals queries), not as a generic repository.

## 2026-11-11 — D026: Owner scoping by explicit `UserId` filters, not EF global query filters

**Status:** Active. Source: session 6 (M3 Part 0), confirmed by the user; spec §4 rules 4–5, §8.2; D004.

**Decision:** Every repository query filters on `UserId == currentUser.Id` (`ICurrentUser`, M2) explicitly. EF Core global query filters are not used. A resource owned by someone else returns 404, never 403.

**Why:** The filter is visible at each call site and testable; global filters hide ownership logic, behave awkwardly in the seeder and tests (no current user), and are easy to bypass with `IgnoreQueryFilters`.

**Alternatives considered:** EF global query filters keyed on `ICurrentUser` — fewer places to forget a filter, but implicit and harder to reason about; not chosen.

**Consequence:** Each new repository method must take or resolve the owner id; cross-user tests (carried over from M2) cover every resource type.

## 2026-11-11 — D027: Optimistic concurrency with PostgreSQL `xmin`

**Status:** Active. Source: session 6 (M3 Part 0), confirmed by the user; spec §4 rule 7.

**Decision:** Accounts, Categories, and Transactions use the PostgreSQL `xmin` system column as an EF Core concurrency token (no extra column). The current version is returned in responses and sent back on `PUT`; a stale update returns `409 Conflict` as ProblemDetails.

**Why:** Rule 7 requires an explicit strategy; `xmin` needs no schema column or manual increment and is supported by Npgsql.

**Alternatives considered:** A manual `RowVersion` integer/bytea column — portable but needs maintenance code and a trigger or manual bump; not chosen. Last-write-wins — rejected by rule 7.

**Consequence:** `xmin` is a PostgreSQL-specific detail; moving off PostgreSQL would need a replacement. Concurrency exceptions must be mapped in `GlobalExceptionHandler`.

## 2026-11-11 — D028: Categories: one level of subcategory, same type as parent, archive cascades down

**Status:** Active. Source: session 6 (M3 Part 0), confirmed by the user; spec §3.4, §6.2.

**Decision:** A category is either top-level or a direct subcategory; subcategories cannot have subcategories. A subcategory has the same `Type` (Income/Expense) as its parent. Archiving a parent also archives its subcategories.

**Why:** Matches the spec's 'parent categories and subcategories' without the cost of arbitrary-depth trees (queries, UI, cycle prevention).

**Alternatives considered:** Arbitrary depth — needs recursive queries and cycle checks for no stated product need; not chosen.

**Consequence:** Depth is enforced in the domain and tested. Going deeper later is a rule change plus a UI change, not a schema change.

## 2026-11-11 — D029: Transactions are hard-deleted; accounts and categories are archived, never deleted

**Status:** Active. Source: session 6 (M3 Part 0), confirmed by the user; spec §3.2, §3.3, §3.4, §4 rule 9.

**Decision:** `DELETE /transactions/{id}` removes the row; its balance effect disappears because balances are derived from the ledger (D006). Accounts and categories have no delete endpoint, only archive.

**Why:** Spec §3.2 requires deleting transactions; historical activity must survive account/category archiving (rule 9).

**Alternatives considered:** Soft-deleting transactions — would need an exclusion filter in every balance and total query; not chosen for M3.

**Consequence:** Deleted transactions are unrecoverable (no audit trail in M3). Foreign keys use `Restrict`, so an account or category with history can only ever be archived.

## 2026-11-11 — D030: Amounts: reject more than 2 decimal places, never round

**Status:** Active. Source: session 6 (M3 Part 0), confirmed by the user; spec §3.2, §6, §4 rule 1; D005.

**Decision:** A request amount must be greater than zero, have at most 2 decimal places, and fit `numeric(18,2)`. Values with extra decimals are rejected with a validation error rather than rounded.

**Why:** Silent rounding of money hides input errors and can make a reconciliation fail by a paisa.

**Alternatives considered:** Round to 2 decimals (banker's or half-up) — convenient but silently changes what the user typed; not chosen.

**Consequence:** CSV import (M6) must normalise or reject statement amounts under the same rule.

## 2026-11-11 — D031: Opening balance stays editable; currency fixed to PKR

**Status:** Active. Source: session 6 (M3 Part 0), confirmed by the user; spec §3.3; D004, D006.

**Decision:** An account's opening balance can be edited at any time, because the balance is derived from opening balance plus ledger (D006). `CurrencyCode` is stored on the account but fixed to `PKR` in this release and not accepted from a request.

**Why:** Editing the opening balance is a correction, not a ledger event; the stored currency code keeps the model extensible without enabling multi-currency.

**Alternatives considered:** Locking the opening balance once transactions exist — safer against accidental edits but blocks legitimate corrections; not chosen.

**Consequence:** Changing an opening balance changes every historical balance for that account, so the update is covered by a reconciliation test.

## 2026-11-11 — D032: Account balance endpoint accepts an optional `asOf` date

**Status:** Active. Source: session 6 (M3 Part 0), confirmed by the user; spec §7.3, §6.4; D006.

**Decision:** `GET /accounts/{id}/balance` returns the balance as of an optional `asOf` date (default: today), computed as opening balance plus ledger movements on or before that date in one database query.

**Why:** A point-in-time balance is the natural form of a ledger-derived balance and is needed for reconciliation tests and later reports.

**Alternatives considered:** A current-balance-only endpoint — simpler but would need reworking for reports; not chosen.

**Consequence:** Transactions dated after `asOf` are excluded; future-dated transactions do not affect today's balance.

## 2026-11-11 — D033: Same-owner rule enforced by composite keys in the database

**Status:** Active. Source: session 6 (M3 Part 2); spec §4 rule 14, §6.3.

**Decision:** Accounts and Categories each have a unique key on `(UserId, Id)`.
Transactions reference accounts and categories through composite foreign keys
`(UserId, SourceAccountId)`, `(UserId, DestinationAccountId)`, and
`(UserId, CategoryId)`; a subcategory references its parent through
`(UserId, ParentCategoryId)`. The database therefore refuses a row that points
at another owner's account or category. Nullable parts (destination, category,
parent) skip the check when NULL, which is what non-transfers and top-level
categories need. All foreign keys are `Restrict`.

**Why:** Rule 14 asks for constraints in addition to application checks, and
cross-owner access is the worst failure in a finance app. Application checks
(domain entities, `FindAsync` by owner) stay as the first line.

**Alternatives considered:** Application checks only — one forgotten check
would be a silent data leak. Single-column foreign keys — cannot express
"same owner".

**Consequence:** Extra unique indexes on `(UserId, Id)`; foreign-key indexes
start with `UserId`, which suits the owner-scoped queries (D026). Tests that
create throwaway users must delete their data before the user, because the user
foreign keys are `Restrict`. Two rules cannot be expressed as a constraint and
rely on the domain and tests: an income/expense category's type matching the
transaction's type, and one-level subcategories of the same type (D028).

## 2026-11-11 — D034: Default-category seeding is serialized with a PostgreSQL advisory lock

**Status:** Active. Source: session 6 (M3 Part 2); refines D021.

**Decision:** The seeder takes `pg_advisory_lock` on a connection held open
while it checks "does the seed user have categories?" and inserts the defaults,
then releases it. Seeding is limited to the user named by `SeedUser:Email`.

**Why:** The first `dotnet test` run failed 3 of 7 tests with `40P01 deadlock
detected`: xUnit starts several `WebApplicationFactory` hosts in parallel, and
each ran the seeder and inserted the same categories at once. A catch-and-retry
was rejected because the non-retrying Npgsql strategy wraps the failure in an
`InvalidOperationException`, and a retry loop would only hide a race that a lock
removes.

**Alternatives considered:** Catching the failure and re-checking; skipping the
seeder in test hosts; seeding in a one-off command instead of at startup.

**Consequence:** Any future startup seeding that inserts rows must use the same
lock (or another serialization). The lock key is a constant in
`DatabaseSeeder`.

## 2026-11-11 — D035: Application layer structure

**Status:** Active. Source: session 6 (M3 Part 3); refines D001, D013, D025.

**Decision:** Use cases are plain scoped classes, one per feature area
(`AccountService`, `CategoryService`, later `TransactionService`), in
`Raqam.Application`. Request/response records and their FluentValidation
validators live next to them, and the API scans that assembly for validators.
Services depend on repository interfaces (D025), `IUnitOfWork`, `ICurrentUser`,
and `TimeProvider`; they hold no HTTP or EF Core types. `NotFoundException`
(404) and `ConflictException` (409), next to the domain's `DomainException`
(400), are mapped by `GlobalExceptionHandler`. Enums travel in JSON as names
(`JsonStringEnumConverter`), and enum fields in create/update requests are
nullable so a left-out value is a validation error, not the first enum value.
No MediatR or similar.

**Why:** The simplest structure that keeps the layering of D001 and is easy to
unit-test; no extra dependency (the user prefers minimal solutions).

**Alternatives considered:** MediatR-style handlers — more types per use case
for no current benefit. Request records in the Api project — would split a use
case across two assemblies.

**Consequence:** `Raqam.Application` gains a package reference to
`FluentValidation` (added with `dotnet add`, not by editing the csproj). Services
are registered in `Program.cs`. Responses carry the row `Version`, and updates
must send it back (D027).

## 2026-11-11 — D036: Transaction list filters, balance and ledger totals

**Status:** Active. Source: session 6 (M3 Part 3, slice 2); refines D006, D022, D023, D032.

**Decision:**
- `GET` list filters (all optional, combined with AND): `from`/`to` (inclusive,
  `DateOnly`), `type`, `accountId` (matches either side of a transfer, so it is
  also the account history), `categoryId`, `search`, `sort`, `page`,
  `pageSize`. `categoryId` on a top-level category also matches its
  subcategories. `search` is a case-insensitive "contains" on description and
  merchant, with `%` and `_` escaped. `sort` is `DateDesc` (default), `DateAsc`,
  `AmountDesc`, `AmountAsc`, with a fixed tie-break so paging is stable. Page
  size defaults to 20, maximum 100. The response is
  `{ items, page, pageSize, totalCount, totalPages }`.
- Balance = opening balance + income − expense + transfers in − transfers out,
  from one aggregate SQL query (four conditional sums) over the owner's
  transactions for that account, up to and including `asOf` when given. The
  opening balance always counts, whatever `asOf` is. The response returns the
  four components as well as the balance. `Transaction.SignedEffectOn` stays the
  single definition of direction; a test must check the SQL agrees with it.
- Ledger totals (income and expense for a date range, optionally one account)
  exclude transfers and are computed in one aggregate query.
- A body that names an account or category that is missing, or another user's,
  gets 404 ("Source account was not found." and so on); the domain's own
  same-owner message is a backstop only.
- Update takes the `Version` the client last saw (D027); delete is a hard
  delete (D029) with no version.

**Why:** The frontend needs one flexible list endpoint; a parent-category filter
that ignored its subcategories would look wrong. Returning the balance
components lets the UI and the tests check the sum.

**Alternatives considered:** loading transactions and summing in memory (rejected
by rule 15); a cached balance column (rejected by D006); exact-match-only
category filter (surprising for parent categories).

**Consequence:** Slice 2 adds `ITransactionRepository`, `TransactionService`,
`LedgerService`, `TransactionRepository`. Controllers (Part 4) expose
`GET /accounts/{id}/balance?asOf=` and `GET /accounts/{id}/transactions`; the
ledger-totals endpoint is M5 (dashboard), so for now totals are exercised by
tests only.

## 2026-11-11 — D037: Frontend reaches the API through the Vite dev proxy

**Status:** Active. Source: session 6 (M4 Part 0); applies D016, D018.

**Decision:** In local development the browser calls the Vite dev server
(`http://localhost:5173`) at `/api/...`, and Vite forwards to the API at
`https://localhost:7271` (`secure: false` for the self-signed dev certificate).
The frontend reads the API base from `VITE_API_BASE_URL`, which is `/api/v1` in
development; a hosted build sets the full API URL. Every request sends
credentials, and unsafe verbs send the `X-CSRF-TOKEN` header (token fetched from
`/auth/csrf-token` after sign-in, D018).

**Why:** the browser sees one origin, so there is no CORS to configure locally
and the cookie is set for the origin the user is actually on. This also avoids
making the browser trust the dev certificate for a second origin.

**Alternatives considered:** direct calls to `https://localhost:7271` with
`Cors:AllowedOrigins` (D016) — works, but relies on cross-origin `SameSite=None;
Secure` cookies and certificate trust in the browser, which is more fragile.

**Consequence:** the API must be run with the `https` launch profile while
developing the frontend. The auth cookie is `Secure` but is served to the browser
over `http://localhost`; Chrome and Firefox accept that for `localhost`, Safari
may not — if sign-in does not stick in Safari, use Chrome or Firefox for
development. The `.env.example` default changes from `http://localhost:5196/api/v1`
to `/api/v1`. Production CORS (`Cors:AllowedOrigins`) is unchanged and is still
needed when the frontend and API are on different domains (M10).

## 2026-11-11 — D038: UI components are Tailwind plus Radix UI primitives

**Status:** Active. Source: session 6 (M4 Part 0); realizes spec §5.2 "a small,
consistent component system" and §3.14.

**Decision:** Interactive widgets that are hard to make accessible by hand
(dialogs, confirm dialogs, dropdown menus, selects, tooltips, toasts where
needed) use Radix UI primitives, styled with Tailwind. Simple elements (button,
input, card, badge, table, form field) are written in the repo. All shared
components live in `src/components/ui/` and are the only place Radix is imported.
Each Radix package is added in the slice that first needs it, not up front.

**Why:** correct focus handling, keyboard navigation and ARIA for dialogs and
menus is easy to get subtly wrong; Radix supplies it unstyled, so the look stays
ours (spec §3.14: accessible labels and keyboard navigation).

**Alternatives considered:** hand-built set with native `<dialog>` and selects —
fewest dependencies, but more accessibility work to own (this was the
recommended option; the user chose Radix instead).

**Consequence:** a few more dependencies to keep updated; wrapping Radix in
`components/ui` keeps the rest of the app independent of it.

## 2026-11-11 — D039: Frontend tests use Vitest and Testing Library, in M4

**Status:** Active. Source: session 6 (M4 Part 0); spec §10.3.

**Decision:** M4 includes frontend tests: Vitest with jsdom, `@testing-library/react`
and `@testing-library/user-event`. They cover form validation and API-error
display, the sign-in and 2FA flow, transaction create/edit, theme persistence,
and key loading/empty/error states. API calls are mocked at the API-client
boundary; a mock-server library (MSW) is added only if that proves awkward. Tests
are written with each slice, and `npm test` must pass with `npm run build` and
`npm run lint`.

**Why:** the UI renders money and sends it to a ledger that is correct by test;
untested forms are where wrong amounts or silently swallowed errors would
appear. The spec lists these tests under §10.3.

**Alternatives considered:** deferring tests to a later milestone — rejected
because UI drift is harder to cover afterwards.

**Consequence:** the verification list for M4 includes `npm test` output shared
by the user. Import preview UX and end-to-end tests (§10.3/§10.4) belong to their
own milestones.

## 2026-11-11 — D040: Frontend conventions

**Status:** Active. Source: session 6 (M4 Part 0); decided by the AI as sensible
defaults, change if you disagree.

**Decision:**
- **Layout:** `src/features/{auth,accounts,categories,transactions,dashboard}`
  each with its pages, components, API calls and query hooks; shared code in
  `src/lib` (API client, money, dates), `src/components` (layout, `ui/`).
- **Server state:** TanStack Query for everything from the API; a mutation
  invalidates the affected queries. Sign-in state comes from `GET /auth/me`; a
  `401` anywhere returns the user to the sign-in screen.
- **Forms:** React Hook Form with Zod schemas that mirror the backend rules
  (amount greater than 0, at most 2 decimals, maximum, name lengths). The server
  stays the authority: a `400` is mapped onto field errors, a `409` shows a
  "changed elsewhere, reload" message and refetches, a `404` shows not found.
  The exact error body shape is confirmed against a real response in Part 1.
- **Money and dates:** amounts are held as strings in forms and sent as JSON
  numbers; never rounded on the client (D030). Dates are `YYYY-MM-DD` strings
  and are never passed through `Date` timezone conversion (D022). One helper
  formats PKR (`Intl.NumberFormat` with `en-PK` / `PKR`) and one formats dates.
- **Theme:** follows the system setting by default, with a light / dark / system
  toggle saved in `localStorage` (`raqam-theme`), applied as a class on `<html>`
  (Tailwind dark variant).
- **Destructive actions:** always confirmed in a dialog (spec §3.14); archiving
  a parent category warns that its subcategories are archived too.
- **Scope:** the dashboard in M4 is layout only (balances summary and recent
  transactions from existing endpoints); budgets and analytics are M5.

**Consequence:** later milestones add feature folders in the same shape.

## 2026-11-11 — D041: Dates use dayjs and display as "18 May 2026"

**Status:** Active. Source: session 6 (M4 Part 0), user instruction; refines D040
(money and dates) and applies D022.

**Decision:**
- All date handling in the frontend goes through **dayjs** (with the `utc` and
  `customParseFormat` plugins), in one helper module in `src/lib`.
- Every date the user sees, anywhere (lists, forms, filters, dashboard, dialogs),
  is formatted **`D MMM YYYY`**, for example `18 May 2026`. A timestamp, where one
  is shown at all, is `D MMM YYYY, h:mm A` in the user's local time.
- The **wire format stays `YYYY-MM-DD`** (the API's plain date, D022), and so do
  URL query parameters for shareable filters. Display formatting never changes
  what is sent.
- A transaction date is parsed and formatted as a local calendar date and is never
  converted through UTC, so it cannot shift by a day (spec rule 8). Only the
  `...Utc` timestamps are parsed as UTC and shown in local time.
- Date inputs are not the browser's native `<input type="date">` (its display
  format follows the browser locale and cannot be set). A date field is a button
  that shows `18 May 2026` and opens a calendar popover (`react-day-picker`
  inside a Radix popover, D038); the user can also type the date in that format.

**Why:** the user wants one consistent, unambiguous format everywhere; month
names avoid the day/month confusion of numeric formats; dayjs keeps date logic in
one small library instead of ad hoc string and `Date` handling.

**Alternatives considered:** native date inputs — simplest and most accessible on
mobile, but impossible to show in this format (not chosen because of the
"everywhere" requirement); `date-fns` or `Intl.DateTimeFormat` alone — fine, but
dayjs was asked for.

**Consequence:** two more dependencies, `dayjs` and `react-day-picker` (the
Radix popover is added with the first date field). The date picker is a component
the tests must cover (typing, picking, keyboard). If the custom picker proves
poor on phones, revisit by appending a new decision.

## 2026-11-20 — D042: Brand identity: lapis and gold, semantic colour tokens

**Decision:** the app has one visual identity, defined once in `src/index.css`.
- Palette: lapis blue (`#26398F`, lighter `#8FA3FF` in dark) for actions and links; gold
  (`#E3A52B` / `#F0B84A` in dark) only for the mark and the current-page marker; cool paper
  and deep-ink surfaces for light and dark; green, red and blue only for income, expense
  and transfer (and errors), never for decoration.
- Components use semantic Tailwind names (`bg-surface`, `text-muted`, `bg-brand`,
  `bg-side` ...) backed by CSS variables, so light and dark come from one file and
  components carry no `dark:` variants. Changing the brand later means editing the
  variable values only.
- The sidebar is the same deep lapis in both themes (the binding of the book); on mobile
  it becomes a lapis top bar.
- Type: IBM Plex Sans (variable) for everything, with tabular figures for money and dates
  (the `num` utility); the Arabic word رقم in Reem Kufi (variable) is the wordmark.
- Cards are flat and outlined (no shadows); only overlays (dialogs, calendar, toasts) get a
  shadow. Table headers are sentence case, not capitals. One focus ring for the whole app.
- Every text pair was checked against WCAG AA (4.5:1) in both themes.

**Why:** the first pass used default slate and indigo, which read as a template with no
identity. A finance app is read for numbers, so the brand lives in the frame (sidebar and
wordmark) and in disciplined colour use, and the content stays quiet.

**Alternatives considered:** a teal or green brand (the common finance default); a warm
cream and terracotta look; a gradient or illustrated look. Not chosen: each is the usual
choice for this kind of app rather than one that fits the name.

**Consequence:** two new dependencies, `@fontsource-variable/ibm-plex-sans` and
`@fontsource-variable/reem-kufi`; fonts are bundled, so no external font requests. The
favicon is replaced with a gold ring on lapis. The theme toggle is styled for the sidebar
and would need a variant if it moves onto a plain page.

**Amendment (same day): icons.** Buttons carry an icon with their text when the action
benefits from it (New, Save, Archive, Delete, Try again), navigation items have icons, and
row actions (edit, archive, delete) use the icon-only `IconButton`, which requires a label
(used as the accessible name and the tooltip). The theme toggle is three icons (sun, moon,
monitor) with labels for screen readers. Icons come from `lucide-react` (one new
dependency, tree-shaken). Dialog buttons stay text-only so the choice reads as words.

## 2026-11-20 — D043: Sign-in screens, session handling and 2FA scope

**Decision:**
- The signed-in user is held in the TanStack Query cache under `['session']` (user, or null
  when signed out), loaded from `GET /auth/me` (a 401 there means "not signed in", not an
  error). A route guard (`RequireAuth`) wraps every app page and sends anyone else to
  `/sign-in`, remembering the page they asked for; the sign-in screen sends a signed-in
  person away.
- The API answers every sign-in step with 200 and `{ succeeded, requiresTwoFactor,
  lockedOut }`, so the screen reads those flags: wrong credentials say "Email or password
  is incorrect" (never which one), a locked account says so, `429` says to wait.
- The 2FA step takes the 6-digit authenticator code (spaces allowed, sent as plain digits)
  or a recovery code, via `/auth/two-factor/verify` and `/auth/two-factor/recovery-code`.
  Both and `/auth/login` are sent without a CSRF header (the API exempts them, D018); the
  CSRF token is reset after sign-in and sign-out.
- Any 401 from any other request clears the cached user, so the guard returns the person
  to sign-in; sign-out clears the whole cache.
- If sign-in succeeds but `/auth/me` still answers 401, the screen says the browser did not
  keep the session cookie and points at HTTPS: this is the Safari risk recorded in D037.
- The 2FA setup and disable screen is deferred to a later settings page. It is optional for
  M4's exit criteria, and 2FA can already be turned on through the API.

**Why:** one place for "who is signed in" that every request path can clear keeps the guard,
the 401 rule and sign-out consistent, and avoids a second auth store beside Query.

**Consequence:** `SESSION_QUERY_KEY` lives in `src/lib/query-client.ts`; tests use
`src/test/api-mock.ts` and `render-app.tsx`. A user who enabled 2FA has no way to see or
change it in the UI until the settings page exists.

**Amendment 2 (same day): navbar and toasts.** The theme toggle, the signed-in email and
Sign out moved out of the sidebar into a navbar across the top of the content area; the
sidebar is navigation only. Below the `md` width the lapis top bar carries the wordmark, the
theme toggle and the menu button, and the menu panel holds navigation, the email and Sign
out. Toasts are shown by `dynaura` (small "island" toasts at the top of the screen): the
`useToast().notify(message, tone)` call is unchanged, so screens do not import the library.
Toast colours are CSS variables (`--toast-bg` and friends), so they follow light and dark;
the stylesheet without the Google Fonts import is used and the app font is set instead.
One new dependency, `dynaura`.


---

## 2026-11-20 — D044: Accounts screens

**Decision:**
- `/accounts` lists accounts with their type and balance. Each balance comes from
  `GET /accounts/{id}/balance` (one request per account, shown as a placeholder until it
  arrives, "—" if it fails), because the list response carries no balance (ledger-first,
  spec §6.4). Archived accounts are hidden unless "Show archived accounts" is ticked, and
  are labelled and read-only when shown.
- Create and edit share one dialog. The form checks the same rules as the API (name 1–100
  characters, a type, an opening balance of at most 2 decimals, which may be negative, and an
  optional institution of at most 100 characters) and never rounds. Server `400` messages are
  placed under the field they name; other errors show above the buttons.
- Edit sends the `version` the form was opened with. On `409` the dialog offers "Load
  latest": it fetches the account again, replaces the form's values and version, and the
  person saves again. Nothing is overwritten silently.
- Archiving always asks first (it cannot be undone). The detail page `/accounts/:id` shows
  the balance and its parts (opening, income, expenses, transfers in and out) and a paged
  history (`GET /accounts/{id}/transactions`, 20 a page). In the history each amount is
  signed by its effect on this account: a transfer is "Transfer out" or "Transfer in"
  depending on which side this account is.
- A missing or foreign account shows "Account not found" (the API answers 404 for both).
- Below the `sm` width the Type column is dropped and the type is shown under the name, so
  nothing is clipped on a phone.

**Why:** the list needs no new endpoint, and reloading the latest values on a conflict is
the least surprising recovery. Reusing one dialog keeps create and edit rules from drifting.

**Consequence:** one request per account for balances; fine for a personal account list. New
shared pieces: `Select` and `Pagination` (reused by transactions in Part 5), and
`features/transactions/types.ts` holds the `Transaction` and `Paged` shapes. Account data is
refetched as a whole after any create, edit or archive. `render-app.tsx` now mounts
`ToastProvider`, like the real app.

---

## 2026-11-20 — D045: Categories screens, and how a 409 is told apart

**Decision:**
- `/categories` shows one type at a time (Expenses or Income, a two-way switch), as a tree:
  top-level categories with their subcategories nested below, each sorted by name. Archived
  ones are hidden unless "Show archived categories" is ticked, and are labelled and
  read-only when shown. All categories load in one request and are grouped in the browser.
  A subcategory whose parent is missing from the list is shown at top level, never dropped.
- Create: name, type, an optional parent (only top-level, unarchived categories of the chosen
  type are offered; changing the type clears the parent) and an optional colour. "Add
  subcategory" on a top-level row opens the same dialog with the parent fixed, which also
  fixes the type. Subcategories of subcategories are not offered (D028).
- Edit changes name and colour only; type and parent are shown as text because the API fixes
  them after creation (D028). The stored icon is sent back unchanged.
- Colour is one of nine fixed swatches or none, stored as a hex string (the API accepts up to
  20 characters of free text). A colour already stored that is not a swatch stays selectable
  as "Current colour". The icon field has no editor yet: the seeded defaults have no icon or
  colour, and the spec calls both optional metadata.
- Archive always asks, and when the category has unarchived subcategories the dialog says they
  are archived with it (D028, the API does this in one save).
- **A 409 has two causes with no code to tell them apart:** a stale version, and a name that
  is already taken. When an edit gets a 409, the dialog fetches the record again; only if its
  version differs does it offer "Load latest". Otherwise it shows the server's message and
  keeps what the person typed. No message text is matched.

**Correction to D044:** the accounts dialog treated every 409 on an edit as stale, and its
test used an invented 400 for a duplicate name. Account names are unique per user, and the
API answers a taken name with 409. Duplicate names on an account edit would have offered
"Load latest", which replaces the typed name. The accounts dialog now uses the same check
(`versionHasMoved` in `src/lib/api/conflict.ts`) and its tests cover the real 409 on create
and on edit.

**Why:** the API's two 409 messages are plain text under the same status and title;
matching them would break when a message is reworded, and always offering a reload would
discard a person's edit for a simple name clash.

**Consequence:** one extra GET after a 409 on an edit. The icon cannot be set from the UI until
a later pass chooses an icon set. Transactions (Part 5) will reuse the same check.

---

## 2026-11-20 — D046: Transactions screens

**Decision:**
- **List and filters.** `/transactions` shows the signed-in user's transactions, 20 to a page.
  Filters, sort and page live in the address, so a filtered view can be reloaded or shared:
  `from`, `to` (`YYYY-MM-DD`), `type`, `account`, `category`, `q` (search), `sort`, `page`.
  Anything at its default is left out; anything invalid in a link (a bad date, an id that is
  not a UUID, an unknown sort) is ignored rather than sent to the API. Changing a filter goes
  back to page 1. Filter changes replace the history entry, so Back does not step through
  every keystroke. Search waits 300 ms after typing stops. Sort offers newest first (the
  default), oldest first, highest amount and lowest amount, the API's four orders.
- **Date range.** An end date before the start date is not sent (the API would answer 400);
  the screen says so under the dates.
- **Names.** Rows show account and category names resolved from the account and category
  lists, which are loaded including archived ones, since history can point at them. A
  subcategory shows as "Food › Groceries". A transfer shows "From → To". Amounts are signed:
  income "+" in the income colour, expense "−" in the expense colour, a transfer plain.
- **Category filter** offers every category (expense, then income), including archived; a
  top-level category also matches its subcategories, as the API does (D036).
- **Form.** One dialog for new and edit. A three-way switch (Expense, Income, Transfer) decides
  the fields: income and expense take one account, a category of the matching type and an
  optional merchant; a transfer takes a From and a To account (the To list leaves out the From
  account) and has no category. Changing the type clears the category and the To account. The
  amount is positive with up to 2 decimals and is never rounded (D030); the date defaults to
  today and is shown as `D MMM YYYY` (D041).
- **Archived accounts and categories.** A new transaction offers only active ones; an edit
  also keeps the account or category already on the transaction, labelled "(archived)", so an
  old entry can still be edited. This mirrors the domain rule.
- **Fast entry.** The amount has focus when the dialog opens and Enter saves. "Save and add
  another" saves, keeps the dialog open, keeps type, date, account and category, and clears
  amount, description and merchant. The account used last is remembered in the browser
  (`raqam.lastAccountId` in local storage, best effort) and pre-selected; with exactly one
  active account that one is pre-selected.
- **Errors.** A `400` with field errors shows under the matching field; a rule message
  (such as an archived category) shows above the buttons; a `404` for an account or category
  that has gone shows its message. A `409` is checked with the same refetch-and-compare as D045
  and offers "Load latest" when the version moved. A transaction has no unique name, so in
  practice every `409` here is a stale edit; the check costs one request and keeps the rule
  the same everywhere.
- **Delete** asks first, naming the transaction, amount and date, and says balances will
  change. Deleting the only row on a later page steps back one page.
- **Phones.** Below the `md` width the Date, Category and Account columns are hidden and
  their text moves under the description, so the amount and the row buttons stay on screen.
  The filters other than search fold behind a "Filters" button that shows how many are
  applied. Table cells use less side padding below `sm`, which also tightens the accounts
  list and the account history.

**Why:** the URL is the single source of truth for the view, which gives reload, sharing and
the Back button for free and avoids a second copy of the filters in component state. Mirroring
the domain's archived rule in the form avoids offering choices the API will reject.

**Consequence:** any create, edit or delete refreshes the transaction lists and all account
data (balances and histories), because balances are computed from the ledger (D006). The
dashboard (Part 6) will need the same refresh. New shared pieces: `categoryOptions`
(`features/categories/category-options.ts`), `parseFilters` and `toSearchParams`
(`features/transactions/transaction-filters.ts`), and a `query` field on calls recorded by the
test API mock. Not built: bulk actions, export, a time of day (D022).

---

## 2026-11-20 — D047: Dashboard layout

**Decision:**
- The dashboard (`/`) is layout only, built from endpoints that already exist; reports and
  charts stay in M5. It has three parts: a **Total balance** card, an **Accounts** list, and
  **Recent transactions** (the newest 8, the transactions page's default order), each with a
  link to its full page. A "New transaction" button opens the same form as the transactions
  page, and saving it refreshes the dashboard.
- **The total** is the sum of the balances the server returns for each account
  (`GET /accounts/{id}/balance`), added in whole paise (`sumMoney`) because adding the decimals
  directly drifts (0.1 + 0.2). It includes archived accounts, because they keep their history
  and their money (the archive message says so), and the card says "including N archived" when
  there are any. If any balance has not loaded or failed, the card shows a note instead of a
  partial total, since a wrong total is worse than none. There is no new server endpoint for it:
  the app is single-currency (PKR), so a client-side sum of balances the server computed is
  safe; a server total can replace it in M5 if reports need one.
- The accounts list shows active accounts only, each linking to its page. Each section has its
  own loading, empty and error state, so one failing request does not blank the page.
- With no active account the page says "No accounts yet" and links to accounts; "New
  transaction" is disabled until there is one.
- Shared pieces extracted for both pages: `describeTransaction` (category and account text for
  a row) and `TransactionAmount` (signed, coloured amount); the transactions list hook takes an
  optional page size.

**Why:** the checklist asks for balances and recent activity from existing endpoints only, and
the dashboard should show the same numbers as the account pages.

**Consequence:** the dashboard makes one request per account for balances plus one for the
recent list; fine for a personal number of accounts. It depends on the account and transaction
refresh that already happens after any change (D046), so no extra wiring is needed.

## D048 — Quality pass: what an automated audit covered, and what it changed

**Date:** 2026-11-20 **Status:** accepted (Part 7)

**Context:** Part 7 asks for state, responsive, accessibility and theme checks. The AI cannot
run a real browser session against the real API, so the audit ran on the built app (`vite
preview`) in headless Chromium with the API stubbed at the network layer, using axe-core
(WCAG 2.0/2.1/2.2 A and AA plus best practices).

**Decision:**
- **Audit scope.** axe on every page and dialog in light and dark (dashboard, accounts, account
  detail, categories, transactions, all form and confirm dialogs, phone menu, sign-in), and again
  on every page in its loading, empty and server-error state. Overflow measured at 390, 768, 1024
  and 1440 px. Theme persistence, first-paint class and the system setting checked in a real
  browser. Keyboard: tab order, focus ring, dialog focus in and out.
- **Fixes made because of it:**
  - Dialogs gave focus to the page top on close. Radix only restores focus to a `Trigger`, and
    ours open from plain buttons. `useRestoreFocus(open)` records the opener in a layout effect
    (not `onOpenAutoFocus`, which Radix skips when a field has `autoFocus`) and restores it;
    if the opener is gone (a deleted row) focus goes to `main`, which is now `tabIndex={-1}`.
  - At 768 px the sidebar leaves about 430 px, and the transactions table pushed Amount and the
    row buttons out of view. Date, Category and Account now fold into the details line below `lg`.
  - The visually hidden "Actions" header escaped the table's scroll wrapper and made the whole
    page scroll sideways; the wrapper is now `relative`.
  - Sign-in's brand panel sat outside any landmark; it is now a `header`.
  - Loading placeholders had `aria-label` on a role-less `div` (ignored by screen readers); they
    are now `role="status"`, and the account detail page announces its loading too.
  - A failed or missing account on the detail page had no `h1`; it has a hidden "Account" one.
- **Not claimed:** axe finds about a third of accessibility problems. It does not judge reading
  order, wording, or how a screen reader actually sounds. Nothing here is a manual
  screen-reader test, and nothing ran against the real API or on the user's machine.

**Why:** the failures found (lost focus, hidden Amount column, silent loading) are the kind that
tests with a stubbed DOM do not see.

**Consequence:** the audit scripts are scratch files, not in the repo. If the user wants this
repeatable, an axe check could be added as a Playwright test in M5 or later; that would add a
dependency and a browser download, so it is not done now.

## D049 — An account never goes below zero (reverses D031)

**Date:** 2026-11-20 **Status:** accepted (user requirement, M4 walkthrough)

**Context:** D031 allowed negative balances (overdraft). The user's walkthrough feedback: a
transfer must not exceed what the account holds (1000 means at most 1000), and an account
balance is always positive and never negative.

**Decision:**
- An account's current (all-time) balance never goes below zero. Exactly zero is allowed.
- Enforced in the application layer by `BalanceGuard` on transaction create, edit and delete and
  on opening-balance changes. Create guards the new effect; edit guards the reversal of the old
  effect plus the new one; delete guards the reversal (deleting income that was already spent,
  or a transfer that already left the destination, is refused; deleting an expense never is).
  The refusal is a `DomainException` (400) naming the account and what it has available.
- The guard also touches the account row (`Account.Touch`), so the xmin version changes and two
  simultaneous spends on one account conflict (409) instead of both passing the check.
- Opening balance must be 0 or more (domain `MoneyRules`, FluentValidation, and the form).
- `Account.Update` validates all fields before assigning any, so a refused change leaves the
  entity untouched.
- Frontend mirrors the rule only as guidance: the form shows "Available: Rs X" for an expense or
  transfer, takes the amount being edited back out of the balance first, and blocks a larger
  amount. If the balance is unavailable the form checks nothing and the server decides.
- Accounts already below zero are not locked out; only changes that lower them further are refused.

**Known limits:** only the current balance is checked, not historical running balances, so a
backdated expense can pass today and still leave an earlier day negative. No database constraint
or migration was added (a CHECK cannot see the ledger, which computes balances).

**Why:** the user's rule is about what an account holds now; the check belongs with the ledger
rules in the application layer, like the other money rules.

**Status of verification:** frontend 246 tests pass in the AI's workspace. The backend change
is written and hand-reviewed but has not been compiled or run; it needs `dotnet test` from the user.

## D050 — Transactions open on this month; no future dates in the filter

**Date:** 2026-11-20 **Status:** accepted (user requirement, M4 walkthrough)

**Decision:**
- The list defaults to the 1st of the current month through today. Older entries are fetched
  only when the user changes From (or clears filters to the default again).
- From and To cannot be after today: the pickers grey out later days and the typed field refuses
  them with "Choose <date> or earlier."; a future date in the URL is ignored and replaced by the
  default for that side.
- `from`/`to` are written to the URL only when either differs from the default, so a default view
  has a clean URL and "Clear filters" and the "Filters (n)" count ignore the default dates.
- The dashboard's latest-8 list stays unfiltered by date (it is "latest overall", not "this month").
- Today is highlighted more strongly in the calendar (bold, 2px brand ring, soft fill); the
  selected day is a solid brand circle, so the two stay distinguishable.
- The calendar popover has `aria-label="Calendar"`, which fixed an axe `aria-dialog-name` finding.

**Not decided:** a transaction itself can still be dated in the future (the server accepts it);
the default `to = today` filter would hide it. Asked the user.

## D051 — A transaction cannot be dated in the future (supersedes the "Not decided" note in D050)

**Date:** 2026-11-20 **Status:** accepted (user requirement)

**Decision:**
- The server refuses a transaction date after the server's UTC today **plus one day**, on create
  and on edit ("Transaction date cannot be in the future.", 400). The extra day is there because
  the server only knows UTC: a person in Pakistan (UTC+5) is already on the next date for five
  hours a day, and must still be able to record "today". The check lives in the domain
  (`Transaction.Apply`, shared by create and update), so it applies however a transaction arrives.
- The form's date field takes `maxDate` = the person's own today; a typed later date is refused
  with "Choose <date> or earlier.", and the form's rule repeats that for a value that arrives
  already late.
- A transaction that is already saved with a future date (possible before this rule) can still be
  listed and deleted, but cannot be saved again until its date is fixed.

**Why:** the default list ends today (D050), so a future-dated entry would be saved and then hidden.

**Known limit:** someone behind UTC (the Americas) can be accepted up to two days ahead of their own
today by the server alone; the form still stops them at their own today. Nothing here is a
database constraint.

## D052 — Two-step verification gets a screen (supersedes the deferral in D043)

**Date:** 2026-11-20 **Status:** accepted (user asked for it in scope)

**Decision:**
- New page `/security` ("Security" in the navigation) over the existing endpoints: `status`,
  `setup`, `enable`, `disable`. No backend change.
- Off: "Turn on" asks for the key (`setup`), shows a QR code and the key in groups of four, and
  asks for the 6-digit code; `enable` with a valid code turns it on and returns the recovery
  codes, which are shown once with "Copy codes" and "I have saved them". A wrong code shows the
  server's message under the field and keeps the setup open.
- On: "Turn off" asks first (confirm dialog), then calls `disable`.
- The QR code is drawn from the `otpauth://` link by `uqr` (new dependency, no sub-dependencies),
  as an SVG built from rects, not injected HTML. It is always dark on white in both themes so
  scanners can read it.

**Checked:** axe clean in every state in both themes; the rendered QR decodes back to the exact
link; no horizontal overflow at 390 and 768 px. Not checked: a real authenticator app, or the
real API.

**Recommended, not done:** `disable` needs only a signed-in session, so anyone at an unlocked
browser can turn 2FA off. Requiring a current code (or the password) to turn it off would close
that; it is a backend change plus test, so it waits for a decision.

## D053 — Budgets: one per owner, month and category; what counts as spending; alerts without a notification inbox

**Date:** 2026-11-20 **Status:** accepted as the AI's defaults (the user asked to move on; they can change any of it)

**Decision:**
- **Model.** `Budget`: owner, year, month, amount (> 0, 2 decimals, `numeric(18,2)`), and an optional
  category (null is the overall budget). One budget per owner, month and category; the overall
  budget is the NULL-category row, made unique with `NULLS NOT DISTINCT` like category names (D033).
  A budget can only be on an expense category the owner has and that is not archived. Month, year
  and category are fixed after creation; only the amount is edited (to move a budget, delete it and
  add another). The category link is the same owner-pairing composite foreign key as transactions.
  Budgets are plans, not financial history, so delete is a real delete (D029 does not apply); the
  transactions are untouched. An archived category keeps its budget and its spending.
- **What counts as spending.** Expense transactions dated inside the budget's month, nothing else:
  income, transfers (and later debts and savings, which will not be expenses) never count, so they
  cannot inflate spending (spec §3.5). An overall budget counts every expense. A category budget
  counts that category and its subcategories; a subcategory budget counts only itself. A parent and
  a subcategory may both have budgets; they are independent and overlap on purpose. Archived
  categories and accounts still count: the money was spent. One place decides this
  (`BudgetService.SpentAsync`), fed by one aggregate query (`GetExpenseTotalsByCategoryAsync`).
- **Progress.** `BudgetProgress.Calculate`: remaining (negative once exceeded), percent used
  truncated to 2 decimals (never rounded up, so "80.00" really means 80% is reached), and a status:
  `OnTrack` below 80%, `NearLimit` from 80%, `LimitReached` from 100%. The thresholds are compared
  exactly, without division. Both are constants (80 and 100) for now.
- **Endpoints.** `GET /budgets?year=&month=` (a month's budgets, each with its progress, overall
  first), `POST`, `GET /{id}`, `PUT /{id}` (amount and version), `DELETE /{id}`. The spec's separate
  `/budgets/{id}/progress` is merged into the budget itself: one shape for the frontend and one
  fewer call. The spec's `/dashboard/budget-overview` is likewise the month's budget list (Part 2).
- **Alerts (scope reduction).** M5 shows threshold alerts as in-page status (a banner or badge on the
  Budgets page and the dashboard) computed from the status above. Because the status is computed,
  there is nothing to duplicate. **Not built:** stored notification records, an inbox with read or
  dismiss, per-user thresholds, and turning alert types off (spec §3.11 asks for these). They belong
  with the rest of notifications (recurring, debts), which the roadmap puts in M9. Ask the user if
  this should move earlier.
- **Not built:** copying last month's budgets forward; budgets for a range other than one month.

**Why:** spending is already ledger data, so progress is computed, never stored (D006's reasoning);
nothing to drift out of step with transactions. Keeping subcategories in a parent's budget matches
how people budget ("Food" includes groceries).

**Consequence:** the database needs one migration (`AddBudgets`). Test cleanup deletes a user's budgets
before their categories. The race where two requests create the same budget at once ends in the
unique index and a 409 with the generic message from `UnitOfWork`.

**Not verified:** written without a compiler; `dotnet test` from the user is the check.

## D054 — Dashboard endpoints: computed from the ledger, previous period of equal length, categories rolled up

**Date:** 2026-11-20 **Status:** accepted as the AI's defaults

**Decision:**
- `GET /api/v1/dashboard/summary?from=&to=` (both required, inclusive, 2000-01-01 or later, at most
  3660 days). Returns `current` and `previous` (income, expense, net, transaction count) and
  `expenseByCategory`. The previous period is the same number of days immediately before `from`
  (1–30 Nov is compared with 2–31 Oct). The change in percent is left to the client, which must handle
  a previous total of zero.
- `expenseByCategory` groups by top-level category (a subcategory counts toward its parent), largest
  first, with `percentOfExpense` truncated to 2 decimals (the same rule as budgets, D053). Archived
  categories are included. Income categories never appear. Percentages can add to just under 100.
- `GET /api/v1/dashboard/monthly?months=N&to=` (N 1–24, default 6): one row per calendar month, oldest
  first, ending with the month of `to`; months with no transactions are returned as zeros so a chart
  needs no gap filling. `to` is the person's own today (the client sends it, as with D051); when
  omitted the server's UTC date is used.
- Transfers are never income or expense (rule 3); all figures reuse `GetTotalsAsync` and
  `GetExpenseTotalsByCategoryAsync`, so they agree with the transaction list for the same dates (a test
  compares them). Nothing is stored; no migration.
- The spec's `/dashboard/budget-overview` is `GET /budgets?year=&month=` (D053). Account balances stay on
  the existing account endpoints.
- **Not built:** per-account or per-category filters on the dashboard, a "total balance" figure, trends
  per category, a custom month grouping. Add when a screen needs them.

**Why:** one aggregate query per figure keeps it fast and always correct (D006); rolling up to the
top-level category keeps a chart readable and matches how budgets count (D053).

**Not verified:** written without a compiler; the user's `dotnet test` is the check.
