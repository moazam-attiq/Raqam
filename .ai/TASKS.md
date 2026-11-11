# TASKS.md — Current milestone checklist

## M2 — Authentication and security

Source: spec §11 Phase 2, §6.1, §7.1, §8.1, §8.2, §16. Two decisions from
`PROJECT.md` "Open technical decisions" are needed before/during this
milestone: authentication transport (cookie vs JWT) and whether public
registration is enabled.

### Part 0 — Decisions (discuss with the user, then record in `DECISIONS.md`)

- [x] Auth transport: secure HttpOnly cookie (D016)
- [x] Public registration: off; the one user is seeded instead (D017)

### Part 1 — Implementation

- [x] ASP.NET Core Identity added to Infrastructure; `ApplicationUser : IdentityUser<Guid>`; `RaqamDbContext` now extends `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>`
- [x] `AddIdentity` migration created and applied; `AspNetUsers`/`AspNetRoles`/etc. confirmed via `\dt` (user showed output, 2026-11-11)
- [x] Login endpoint (`POST /auth/login`), logout (`POST /auth/logout`),
      `GET /auth/me` — verified end-to-end: login sets the cookie, `/auth/me` returns the user (user showed output, 2026-11-11); no 2FA step yet
- [x] TOTP 2FA: enable/disable endpoints, recovery codes, verify endpoint
      (`POST /auth/two-factor/*`), using Identity's built-in mechanisms (D020);
      build and tests pass, including two automated tests (`TwoFactorTests.cs`)
      covering the enable/disable round trip and a full login-with-2FA flow
      (user showed output, 2026-11-11)
- [x] Authorization: fallback policy requires authentication on every endpoint; `/health`, OpenAPI, and `POST /auth/login` explicitly exempted — verified via the login/me curl flow
- [x] Owner-scoping infrastructure: `ICurrentUser` (Application) /
      `CurrentUser` (Api, via `IHttpContextAccessor` + `ClaimTypes.NameIdentifier`)
      — registered in `Program.cs`; build and tests pass (user showed output,
      2026-11-11); never trust a payload-supplied id (business rule 5)
- [x] CORS: explicit allowed-origins list from `Cors:AllowedOrigins` config (dev default: `http://localhost:5173`) — not yet exercised from an actual browser/frontend, but config and wiring confirmed correct by the successful curl-based login
- [x] CSRF: ASP.NET Core antiforgery (double-submit header) via a project-written `CsrfFilter`
      (calls `IAntiforgery.ValidateRequestAsync` directly — the built-in
      `AutoValidateAntiforgeryTokenAttribute` needs `AddControllersWithViews`'s DI
      registrations, which this API-only project doesn't have, and threw at request time),
      applied globally to all unsafe verbs; `GET /auth/csrf-token` issues the token;
      `POST /auth/login` exempted via `[SkipCsrfValidation]` since no session exists yet to
      validate against (D018); build and tests pass, including two automated tests
      (`CsrfTests.cs`) covering rejection-without-token and success-with-token
      (user showed output, 2026-11-11)
- [x] Rate limiting on login (built-in `Microsoft.AspNetCore.RateLimiting`): fixed-window
      limiter keyed by client IP, 5 attempts/minute, `429` on exceeding it (D019); build
      and tests pass (user showed output, 2026-11-11). 2FA endpoints don't exist yet —
      apply the same policy to them when they're built
- [x] Account-enumeration care: login always returns the same response shape regardless of whether the email exists (spec §8.1); no registration endpoint exists at all (D017)

### Part 2 — Verification

- [x] The seeded user can log in (public registration is off — D017)
- [x] 2FA enrollment and verification work end-to-end — automated tests
      (`TwoFactorTests.EnableAndDisable_RoundTrip_UpdatesStatus` and
      `Login_WithTwoFactorEnabled_RequiresVerifyToCompleteSignIn`)
- [x] Protected endpoints reject anonymous requests (401) — automated test
      (`AuthorizationTests.Me_WithoutAuthentication_ReturnsUnauthorized`)
- [ ] A request with a different user's id in the payload cannot act as that
      user — test this explicitly (spec §8.2, business rule 5); blocked on having an
      owner-scoped entity to test against (M3)
- [x] A mutating request without a valid CSRF token is rejected, and accepted with one —
      automated tests (`CsrfTests.Logout_WithoutCsrfToken_IsRejected` and
      `Logout_WithValidCsrfToken_Succeeds`)
- [x] Rate limiting triggers after repeated failed logins (6th attempt within a minute
      from the same IP returns `429`) — automated test
      (`RateLimitingTests.Login_SixthAttemptWithinAMinute_ReturnsTooManyRequests`)
- [x] No password, token, or recovery code appears in logs (business rule 15) — confirmed
      from the test run's EF Core command logs: parameter values are redacted (`@p0='?'`)
      since `EnableSensitiveDataLogging` is never called; `DatabaseSeeder` and `AuthController`
      never log `request.Password` or any token themselves

### Part 3 — Documentation

- [x] `DECISIONS.md`: record the transport and registration decisions, the
      owner-scoping approach, the CSRF approach (D018), and the rate-limiting
      approach (D019) — all recorded, plus D020 for the TOTP 2FA approach
- [x] README: how to log in locally, how to enable 2FA — Authentication
      section added with curl walkthroughs for login, CSRF, and 2FA
      enrollment/verify
- [x] `PROGRESS.md` entry; close M2 in `ROADMAP.md` — done. The one
      remaining Part 2 item (cross-user-id test) is blocked on M3, not
      undone work; see `ROADMAP.md`'s M2 status note. This file should be
      replaced with the M3 checklist when M3 starts.
