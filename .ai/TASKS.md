# TASKS.md — Current milestone checklist

## M2 — Authentication and security

Source: spec §11 Phase 2, §6.1, §7.1, §8.1, §8.2, §16. Two decisions from
`PROJECT.md` "Open technical decisions" are needed before/during this
milestone: authentication transport (cookie vs JWT) and whether public
registration is enabled.

### Part 0 — Decisions (discuss with the user, then record in `DECISIONS.md`)

- [ ] Auth transport: secure HttpOnly cookie vs JWT. Frontend (Vercel) and API
      (Render) will likely be on different domains (spec §16 item 1,
      §9.2–§9.3) — this affects CORS, SameSite, and CSRF choices made here.
- [ ] Public registration: likely disabled/restricted for a single-user app
      (spec §16 item 2) — decide whether `POST /auth/register` exists at all,
      or whether the one user is seeded instead.

### Part 1 — Implementation

- [ ] Add ASP.NET Core Identity (`Microsoft.AspNetCore.Identity.EntityFrameworkCore`)
      to Infrastructure; `RaqamDbContext` extends `IdentityDbContext` with a
      UUID key (spec §6.1)
- [ ] New migration for Identity's tables
- [ ] Login endpoint (`POST /auth/login`), logout (`POST /auth/logout`),
      `GET /auth/me`
- [ ] TOTP 2FA: enable/disable endpoints, recovery codes, verify endpoint
      (`POST /auth/two-factor/*`), using Identity's built-in mechanisms
- [ ] Authorization: require authentication on all endpoints except auth
      itself; `[Authorize]` as the default policy
- [ ] Owner-scoping infrastructure: a way to get the current user's id from
      the authenticated principal (e.g. a small `ICurrentUser` service in
      Application, implemented in Api) — never trust a payload-supplied id
      (business rule 5)
- [ ] CORS: explicit allowed-origins list from configuration
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
