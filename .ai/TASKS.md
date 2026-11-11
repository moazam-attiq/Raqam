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
- [~] Login endpoint (`POST /auth/login`), logout (`POST /auth/logout`),
      `GET /auth/me` — written (`AuthController`), not yet built; no 2FA step yet
- [ ] TOTP 2FA: enable/disable endpoints, recovery codes, verify endpoint
      (`POST /auth/two-factor/*`), using Identity's built-in mechanisms
- [~] Authorization: fallback policy requires authentication on every endpoint; `/health`, OpenAPI, and `POST /auth/login` explicitly exempted — written, not yet verified
- [ ] Owner-scoping infrastructure: a way to get the current user's id from
      the authenticated principal (e.g. a small `ICurrentUser` service in
      Application, implemented in Api) — never trust a payload-supplied id
      (business rule 5)
- [~] CORS: explicit allowed-origins list from `Cors:AllowedOrigins` config (dev default: `http://localhost:5173`) — written, not yet verified
- [ ] CSRF strategy appropriate to the chosen auth transport
- [ ] Rate limiting on login and 2FA endpoints (built-in `Microsoft.AspNetCore.RateLimiting`)
- [ ] Account-enumeration care: login/registration responses don't reveal
      whether an email exists (spec §8.1)

### Part 2 — Verification

- [ ] User can register (if enabled) or the seeded user can log in
- [ ] 2FA enrollment and verification work end-to-end
- [ ] Protected endpoints reject anonymous requests (401)
- [ ] A request with a different user's id in the payload cannot act as that
      user — test this explicitly (spec §8.2, business rule 5)
- [ ] Rate limiting triggers after repeated failed logins
- [ ] No password, token, or recovery code appears in logs (business rule 15)

### Part 3 — Documentation

- [ ] `DECISIONS.md`: record the transport and registration decisions, and
      the owner-scoping approach
- [ ] README: how to log in locally, how to enable 2FA
- [ ] `PROGRESS.md` entry; close M2 in `ROADMAP.md` only when Part 2 is
      confirmed; replace this file with the M3 checklist
