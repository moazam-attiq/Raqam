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
