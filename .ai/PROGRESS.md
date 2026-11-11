# PROGRESS.md — Session log

Reverse chronological. Record what actually happened; never rewrite earlier
entries.

## 2026-11-11 — Session 5: Identity auth verified; owner-scoping, CSRF, rate limiting, and TOTP 2FA built

**Context:** Continuing M2. Previous session left `AuthController`
(login/logout/me) and the authorization fallback policy written but not yet
run.

**What changed:**

- `AddIdentity` migration created and applied; `AspNetUsers`/`AspNetRoles`/
  etc. confirmed on the Mac via `psql \dt` (8 Identity tables present).
- Seed user created via `DatabaseSeeder` reading `SeedUser:Email`/
  `SeedUser:Password` from user-secrets (public registration stays off, D017).
  One failed attempt hit Identity's password policy (12+ chars, mixed case,
  symbol) — not a bug; user retried with a compliant password.
- Login flow verified end-to-end on the Mac via curl: `POST /auth/login` sets
  the auth cookie, `GET /auth/me` returns the signed-in user using that
  cookie. This also confirms the global fallback authorization policy and the
  cookie auth transport (D016) are working together as intended.
- Owner-scoping infrastructure added: `ICurrentUser` (`Raqam.Application.Common`)
  and its implementation `CurrentUser` (`Raqam.Api.Services`, via
  `IHttpContextAccessor` + `ClaimTypes.NameIdentifier`), registered in
  `Program.cs` (`AddHttpContextAccessor` + `AddScoped<ICurrentUser, CurrentUser>`).
  Build and tests pass (no entities exist yet to call it from — real exercise
  comes in M3 when owner-scoped records are introduced).
- CSRF protection added (D018): ASP.NET Core antiforgery, double-submit header.
  `GET /auth/csrf-token` issues the token; `POST /auth/login` is exempted
  since no session exists yet to validate against. Two problems along the
  way, both fixed: (1) a namespace mistake —
  `AutoValidateAntiforgeryTokenAttribute`/`IgnoreAntiforgeryTokenAttribute`
  are in `Microsoft.AspNetCore.Mvc`, not `.Mvc.ViewFeatures` as first
  guessed; (2) a deeper problem — even with the right namespace,
  `AutoValidateAntiforgeryTokenAttribute` failed at request time
  (`No service for type ...AutoValidateAntiforgeryTokenAuthorizationFilter
  has been registered`) because that attribute needs MVC view-engine DI
  registrations that only `AddControllersWithViews`/`AddMvc` set up, which
  this API-only project (`AddControllers`) doesn't have. Replaced with a
  project-written `CsrfFilter` (`Raqam.Api.Validation`) that calls
  `IAntiforgery.ValidateRequestAsync` directly, and a `[SkipCsrfValidation]`
  marker attribute replacing `[IgnoreAntiforgeryToken]`. Build and tests pass
  after the fix.
- Rate limiting added (D019) on `POST /auth/login`: built-in
  `Microsoft.AspNetCore.RateLimiting`, fixed-window limiter keyed by client
  IP, 5 attempts/minute, `429` beyond that. Build and tests pass.
- Three automated tests added, closing out most of M2 Part 2 verification:
  `AuthorizationTests.Me_WithoutAuthentication_ReturnsUnauthorized` (401),
  `RateLimitingTests.Login_SixthAttemptWithinAMinute_ReturnsTooManyRequests`
  (429, D019), and `CsrfTests` (`Logout_WithoutCsrfToken_IsRejected` /
  `Logout_WithValidCsrfToken_Succeeds`, D018). `CsrfTests` creates and
  deletes its own throwaway user via `UserManager` rather than using the
  real seed credentials, which live only in the user's secrets. Only two
  Part 2 items remain, both genuinely blocked rather than skipped: 2FA
  verification (2FA isn't built) and the cross-user-id test (needs an
  owner-scoped entity from M3).
- TOTP 2FA added (D020), the last deferred M2 Part 1 item: a new
  `TwoFactorController` (`api/v1/auth/two-factor`) with `Status`, `Setup`,
  `Enable`, `Disable`, `Verify`, and `RedeemRecoveryCode`, built entirely on
  Identity's own `UserManager`/`SignInManager` TOTP and recovery-code
  mechanisms (no hand-rolled crypto). `Setup` returns the shared key plus an
  `otpauth://` URI for the frontend to render as a QR code. `Enable` issues 10
  recovery codes. `Verify`/`RedeemRecoveryCode` are `[AllowAnonymous]`,
  `[SkipCsrfValidation]`, and share the `"login"` rate-limit policy (D019),
  since they complete a login rather than acting on an existing session. Six
  new contract records added under `Contracts/Auth/`.
- Two automated tests added in `TwoFactorTests.cs`, closing the remaining
  2FA item in M2 Part 2: `EnableAndDisable_RoundTrip_UpdatesStatus` and
  `Login_WithTwoFactorEnabled_RequiresVerifyToCompleteSignIn` (full login →
  2FA-required → verify → authenticated flow). Both create and delete their
  own throwaway test user via `UserManager`, reimplementing RFC 6238 TOTP
  code generation and RFC 4648 Base32 decoding directly in the test (Identity's
  own `Rfc6238AuthenticationService` is internal). Build and tests pass, all 7
  green. Only one M2 Part 2 item remains, and it's genuinely blocked rather
  than skipped: the cross-user-id test, which needs an owner-scoped entity
  from M3.
- Process note: pushing a file to the Mac via the device bridge repeatedly
  reported success while the old content stayed on disk (silent push
  failure, same class of issue as earlier sessions, but far more frequent
  this session — happened on `Program.cs`, `AuthController.cs`, and
  `.ai/TASKS.md`/`.ai/DECISIONS.md` multiple times each). Standing practice
  going forward: after every push, re-stage the file and read its actual
  content (not just byte count/mtime, which can also look changed without
  the real content landing) before relying on it or telling the user to
  build; retry (plain, then `force: true`) until a content read confirms
  the push actually landed.

**Verification:**

- User-confirmed via shared output: Identity tables exist; seed user created;
  login → `/auth/me` round-trip succeeds with the cookie; `dotnet build` +
  `dotnet test` pass after owner-scoping, after CSRF, after rate limiting,
  and after TOTP 2FA (four separate confirmed build/test cycles, the last
  with all 7 tests green including the two new 2FA tests).

- README updated with an Authentication section: seed-user setup, the
  CSRF/login/me curl flow, and a full 2FA enrollment walkthrough
  (`setup` → authenticator app → `enable` → recovery codes), plus the shared
  login/2FA rate limit. M2 Part 3 documentation is now complete: all of
  D016–D020 were recorded as each decision was made, and this entry closes
  out the session log.
- M2 marked `[x]` in `ROADMAP.md`. The only item from its original
  verification list not actually run — "ownership tests pass" — is recorded
  there as carried forward to M3 rather than outstanding M2 work, since
  there is no owner-scoped entity yet to test against.

**Not done:** nothing further within M2's own scope. M3 has not been
started: `TASKS.md` still holds the M2 checklist and needs replacing with
the M3 checklist (including the carried-forward ownership test) before M3
work begins.

**Next:** open M3 — read spec §11 Phase 3, discuss any open M3 decisions
with the user, and replace `TASKS.md` with the M3 checklist (Accounts,
Categories, Transactions, balance calculation, the ownership test carried
over from M2).

## 2026-11-10 — Session 3: M0 closed, M1 opened

**Context:** The user reported that everything was good on the Mac and that
the project is pushed to GitHub.

**What changed:**

- M0 marked `[x]`; M1 marked `[~]`. `TASKS.md` replaced with the M1 checklist.
- B002 and B003 moved to Resolved.
- No application code changed.

**M0 task summary (archived from `TASKS.md`):** folder inspected; nothing to
migrate from `ExpenseTracker`; solution with four projects and references;
Vite + React + TypeScript + Tailwind frontend; `.gitignore`, `.env.example`,
README; build, API start, frontend build/lint/start verified in the AI
workspace; Mac verification and Git push confirmed by the user.

**Verification:**

- User-confirmed: the M0 checks pass on the Mac; repository pushed to GitHub.
- Verified by the AI: a `.git` directory exists in the project folder.
- Not seen by the AI: command output, tool versions, the commit history, the
  remote URL.

**Later in the same session (M1 started):**

- User ran on the Mac (output shown to the AI): added
  `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 to Infrastructure and
  `Microsoft.EntityFrameworkCore.Design` 10.0.14 to Api, no warnings. The
  output shows .NET SDK 10.0.402 and PostgreSQL 17.10.
- User created the local role and database `raqam_dev` and showed a successful
  connection as `raqam_dev`. The local admin user is `postgres`
  (password-authenticated).
- AI wrote, unbuilt: `Infrastructure/Persistence/RaqamDbContext.cs`,
  `Infrastructure/DependencyInjection.cs` (`AddInfrastructure`),
  `Api/HealthChecks/DatabaseHealthCheck.cs`, and a new `Api/Program.cs` mapping
  `/health`. These could not be compiled in the AI workspace (B004).

- User set the connection string with user-secrets, built, ran the API, and
  showed `curl -i http://localhost:5196/health` returning `200 OK` with body
  `Healthy`. This verifies the AI-written code compiles and reaches the
  database on the Mac. The build output itself was not shown.

**Not done:** confirmation that `PingController` was deleted; initial
migration; exception handling; validation; OpenAPI; logging; test project.

**Next:** install `dotnet-ef` as a local tool, create and apply the initial
migration.

## 2026-11-10 — Session 2: Phase 0 skeleton scaffolded

**Context:** The user confirmed there is nothing to migrate from any earlier
`ExpenseTracker` work and asked to scaffold from scratch and start building
per the plan. The AI had no shell on the developer's Mac, so the skeleton was
generated and checked in the AI's Linux workspace and the files were copied
into the project folder.

**What changed:**

- `backend/Raqam.sln` (classic `.sln` format) with `Raqam.Domain`,
  `Raqam.Application`, `Raqam.Infrastructure`, `Raqam.Api`, all `net10.0`, and
  project references in the specified direction. No NuGet packages.
- `Raqam.Api`: `AddControllers` / `MapControllers`, one placeholder
  `PingController` at `GET /api/v1/ping`, `launchBrowser` turned off.
  Controllers chosen over minimal APIs (D010).
- `frontend/raqam-web`: Vite `react-ts` template (React 19, TypeScript 7,
  Vite 8, oxlint), Tailwind CSS 4 via `@tailwindcss/vite`, starter demo content
  replaced by a placeholder Raqam page.
- Root `.gitignore`, `.env.example`, `README.md`; frontend `.env.example`.
- B001 resolved (user-confirmed). B004 opened (AI workspace limits).

**Verification (AI workspace only: Ubuntu, .NET SDK 10.0.114, Node 22.23.4):**

- Tested: `dotnet build Raqam.sln` — 0 warnings, 0 errors.
- Tested: API started; `GET /api/v1/ping` returned HTTP 200 with
  `{"service":"Raqam.Api","status":"ok"}`.
- Tested: `npm run build` and `npm run lint` clean; dev server returned
  HTTP 200; Tailwind utility classes present in the built CSS.
- Not tested: anything on the developer's Mac (macOS, SDK 10.0.402 reported).
  The page was not viewed in a browser.
- User-confirmed: nothing to migrate from `ExpenseTracker`.

**Not done:** tool-version check on the Mac (B002); `git init` and first
commits (B003); M0 is therefore still in progress. M1 was not started: it needs
NuGet packages and a local PostgreSQL, which the AI workspace cannot reach
(B004).

**Next:** the user runs the "On the developer's Mac" checks in `TASKS.md` and
initializes Git. Once confirmed, close M0 and begin M1 (EF Core + Npgsql,
configuration, exception handling, `/health`, first migration) with the user
running `dotnet` commands locally.

## 2026-11-10 — Session 1: Project memory initialized

**Context:** First AI session on Raqam. The user supplied the baseline project
specification (v1.0, dated 10 November 2026) and asked for the `.ai/`
project-memory system. No prior `.ai/` existed.

**What changed:**

- Read the full specification.
- Inspected the Raqam project folder through the desktop bridge: a recursive
  listing returned no entries. There was no code, solution, frontend, README,
  package manifest, test, or documentation to inspect.
- Created `.ai/` with `PROJECT.md`, `CONTEXT.md`, `ROADMAP.md`, `TASKS.md`,
  `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`.
- Saved an unmodified copy of the specification to
  `docs/raqam-project-specification.md` so future sessions can read the
  authoritative scope from inside the repository.
- Recorded the specification's confirmed decisions as D001–D008, and the
  project-memory layout as D009.

**Verification:**

- Implemented: nothing (no application code written, by instruction).
- Tested: nothing. No build, test, or run command was executed; none exists.
- Verified: the folder listing was empty.
- Not verified: whether `.git` exists (the listing may omit hidden entries);
  the tool versions reported in the specification; the existence or location
  of the earlier `ExpenseTracker` directory.
- User-confirmed: nothing beyond the specification's contents.

**Not done:** every M0 task except the first inspection item. No commands were
run on the user's machine.

**Next:** continue M0 at `TASKS.md` Part 1 — confirm the folder state with
`pwd` / `ls -la`, resolve B001 (`ExpenseTracker`) and B002 (tool versions)
with the user, then scaffold.


## 2026-11-10 — Session 3 (continued): exception handling and OpenAPI written

**Context:** Continuing M1 Part 2 after the initial migration was applied and
verified.

**What changed:**

- AI wrote, unbuilt: `Api/ErrorHandling/GlobalExceptionHandler.cs`
  (`IExceptionHandler` implementation returning ProblemDetails; includes the
  exception detail only when `IHostEnvironment.IsDevelopment()`).
- `Api/Program.cs` updated to register `AddExceptionHandler<GlobalExceptionHandler>()`,
  `AddProblemDetails()`, `UseExceptionHandler()`, and `AddOpenApi()` /
  `MapOpenApi()` (Development only). D012 records the OpenAPI package choice.
- None of this has been built on the Mac yet; `Microsoft.AspNetCore.OpenApi`
  is not yet added as a package reference.

**Verification:** Not yet attempted. Not implemented, tested, or user-confirmed.

**Not done:** adding the `Microsoft.AspNetCore.OpenApi` package; building;
checking `/openapi/v1.json`; triggering an exception to confirm the
ProblemDetails shape; request validation; logging; test project.

**Next:** user adds the OpenAPI package, builds, and checks the new
endpoints.


## 2026-11-11 — Session 4: request validation, logging, and a test project

**Context:** Continuing M1 Part 2 after the previous session's exception
handling and OpenAPI work was verified and ready to commit.

**What changed:**

- AI wrote, unbuilt: `Api/Validation/ValidationFilter.cs`; `Program.cs`
  updated to wire it in, configure console logging by environment, and expose
  `public partial class Program` for test discoverability; new test project
  `backend/tests/Raqam.Api.Tests` with one integration test
  (`HealthEndpointTests`) against the real local database; `Raqam.Api.csproj`
  updated with `FluentValidation.DependencyInjectionExtensions` and an
  `InternalsVisibleTo` entry for the test project.
- D013 (validation approach) and D014 (logging approach) recorded.
- None of this has been built, and the test project has not been added to
  `Raqam.sln` yet.

**Verification:** Not yet attempted on the Mac.

**Not done:** adding the FluentValidation package and restoring; adding the
test project to the solution; running `dotnet test`; README and
`docs/architecture.md` updates; the commit from the previous session (unclear
whether it happened).

**Next:** user adds the FluentValidation package, adds the test project to
the solution, builds, and runs the tests.


## 2026-11-11 — Session 4 (continued): EF Core version pin, and a sync mistake

**Context:** Fixing the MSB3277 version-conflict warning from the previous
build.

**What changed:** added an explicit `Microsoft.EntityFrameworkCore` 10.0.14
`PackageReference` to `Raqam.Infrastructure.csproj` (D015).

**Mistake and correction (important for future sessions):** the AI's local
copy of `Raqam.Infrastructure.csproj` had drifted from the real file — it
never reflected the `Npgsql.EntityFrameworkCore.PostgreSQL` package the user
had added directly on the Mac with `dotnet add`. Editing the stale local copy
and pushing it overwrote the real file, deleting that package reference and
breaking the build (32 compile errors — EF Core types not found). This was
caught by re-staging and reading the device file immediately after, and fixed
by writing the full corrected content (both package references) back. The
first corrective push also silently failed to take effect (device reported
"written" but the file was unchanged); a second push with `force: true`
worked, verified by re-staging before telling the user to rebuild.

**Lesson recorded:** before editing any `.csproj`, `.sln`, or tool-manifest
file that the user also edits directly (via `dotnet add`/`dotnet tool
install`/`dotnet sln add`), stage and read the live file on the Mac first —
never assume the AI's local copy is current. After pushing such a file back,
re-stage it to confirm the write actually landed before telling the user to
build.

**Verification:** user ran `dotnet build Raqam.sln` and reported success —
MSB3277 is gone.

**Not done:** README and `docs/architecture.md` updates; confirming no
secrets are in `git status`; a Session 3/4 commit and push (unclear whether
one has happened since the "everything is good" push in Session 3).

**Next:** update README's run instructions (database setup, user-secrets,
migrations, tests), consider a short `docs/architecture.md`, confirm `git
status` is clean of secrets, then close M1 Part 3/4 and open M2.


## 2026-11-11 — Session 4 (continued): M1 closed, M2 opened

**What changed:** README updated with database setup, user-secrets,
migration, and test-run instructions; `docs/architecture.md` created
summarizing the project split and M1's cross-cutting pieces. User confirmed
`git status` has no secrets staged. M1 marked `[x]` in `ROADMAP.md`; M2
marked `[~]`. `TASKS.md` replaced with the M2 checklist (ASP.NET Core
Identity, TOTP 2FA, owner scoping, CORS/CSRF, rate limiting).

**M1 summary:** EF Core + Npgsql configured against the Mac's local
PostgreSQL (D011); initial (empty) migration applied; `/health` with a real
database check; global exception handling returning ProblemDetails;
FluentValidation wired through a custom filter (D013, no validators yet);
environment-based console logging (D014); OpenAPI document in Development
(D012); an integration test project exercising `/health` against the real
database; an EF Core package-version conflict found and fixed (D015). One
process note: an AI edit briefly broke `Raqam.Infrastructure.csproj` by
editing a stale local copy; caught and corrected within the session (see the
mistake entry above). Controllers over minimal APIs (D010) carried over from
M0.

**Verification:** all user-confirmed via shared command output — build,
`/health`, `/openapi/v1.json`, `dotnet test` (1/1 passing), and `git status`.

**Not done:** anything in M2. The two open decisions (auth transport, public
registration) have not been discussed with the user yet.

**Next:** discuss and record the M2 Part 0 decisions, then add ASP.NET Core
Identity.
