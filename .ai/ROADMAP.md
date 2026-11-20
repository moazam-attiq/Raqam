# ROADMAP.md — Sequential development plan

Milestones M0–M10 map one-to-one to Phases 0–10 of
`docs/raqam-project-specification.md` §11. Phase 11 (post-MVP improvements) is
out of scope and intentionally has no milestone; see `PROJECT.md`.

```text
[ ] Not started
[~] In progress
[x] Completed
```

A milestone is `[x]` only when its verification list was actually checked and
the evidence is recorded in `PROGRESS.md`.

MVP gate (spec §12): M0–M6, the report and transaction-export parts of M9, and
M10. M7, M8, and the PDF/XLSX and advanced-notification parts of M9 are approved
scope that may follow the first usable release if the user chooses to control
time; the default order below is the specification's order.

---

## [x] M0 — Repository and development environment

**Objective:** a clean, building skeleton in the specified structure.

**Deliverables:** inspection of the existing folder and any earlier
`ExpenseTracker` work; repository structure; `Raqam.sln` with the four projects
and correct references; React + TypeScript + Vite frontend with Tailwind CSS;
`.gitignore`; `.env.example`; basic README.

**Verification:** solution builds; API starts; frontend starts; no secrets
committed; repository structure understood.

**Manual actions:** user confirms tool versions on the Mac; user locates or
rules out the earlier `ExpenseTracker` directory; user creates the GitHub
repository when ready.

**Status note (session 2, 2026-11-10):** skeleton scaffolded; build, API start,
frontend start, and lint verified in the AI's Linux workspace (.NET SDK
10.0.114, Node 22.23.4). Not yet complete: the same checks on the developer's
Mac, `git init`, and the first commit. Stays `[~]` until the user confirms
those.

**Completed 2026-11-10 (session 3):** the user confirmed the checks on the Mac
were good and that the repository is pushed to GitHub. Completion rests on
that confirmation; the AI did not see the command output.

**M1 completed 2026-11-11 (session 4):** EF Core + Npgsql wired up, initial
migration applied, `/health` with a database check, global exception
handling, FluentValidation wiring (no validators yet), environment-based
console logging, OpenAPI document in Development, and an integration test
project — all verified by output the user shared, with one real mid-session
mistake (an AI edit briefly broke `Raqam.Infrastructure.csproj`; caught and
fixed the same session; see `.ai/PROGRESS.md`).

## [x] M1 — Architecture foundation

**Objective:** the API talks to PostgreSQL with production-shaped plumbing.

**Deliverables:** dependency injection; EF Core + Npgsql; environment-based
configuration; global exception handling; request validation; OpenAPI/Swagger
for development; `/health` endpoint; logging; initial migration.

**Verification:** API connects to local PostgreSQL; health endpoint responds;
migrations apply cleanly; a basic integration test passes.

**Manual actions:** local PostgreSQL (native or Podman) available with
credentials supplied by the user.

## [x] M2 — Authentication and security

**Objective:** secure single-user sign-in with 2FA and owner scoping.

**Deliverables:** ASP.NET Core Identity with UUID user IDs; login/logout; TOTP
2FA and recovery codes; authorization policies; cookie-vs-JWT decision; CORS and
CSRF strategy; rate limiting; owner-scoping infrastructure.

**Verification:** user can authenticate; 2FA works; protected endpoints reject
anonymous requests; ownership tests pass.

**Manual actions:** user enrolls an authenticator app and confirms TOTP and
recovery codes. Decisions needed: auth transport, public registration.

**Completed 2026-11-11 (session 5):** Identity with cookie auth (D016), no
public registration (D017), CSRF via a custom filter (D018), IP-keyed rate
limiting on login and 2FA (D019), and TOTP 2FA with recovery codes (D020) —
all built and verified by user-shared build/test output, including automated
tests for anonymous rejection, CSRF, rate limiting, and the full 2FA
enrollment/login flow. One verification item from the original list —
"ownership tests pass" — could not be run: there is no owner-scoped entity
yet to test against (`ICurrentUser`/`CurrentUser` are wired up and covered by
build/tests, but have nothing real to be exercised on until M3 creates the
first owned entity). That single item is carried forward as an M3 task
rather than treated as outstanding M2 work. README documentation (login,
CSRF, 2FA) added.

## [x] M3 — Core financial domain and database

**Objective:** a correct ledger.

**Deliverables:** Accounts; Categories and subcategories; Transactions; Income,
Expense, and Transfer domain rules; balance calculation; indexes, constraints,
and migrations; domain and integration tests.

**Verification:** accounts and categories can be managed; income, expenses, and
transfers work; balances reconcile; transfers are excluded from income/expense
totals.

**Completed 2026-11-11 (session 6).** Evidence (user-run, output shared):
`scripts/m3-smoke.sh` 56 passed, 0 failed over HTTPS; `dotnet test` green
(`Raqam.Api.Tests` 55 passed; the earlier 139-test run implies 84 in
`Raqam.Domain.Tests`, all passing); migration applied to the dev database and to
an empty scratch database; OpenAPI document lists every M3 endpoint. The M2
carry-over (cross-user ownership test) is covered by `OwnershipTests`. Details in
`PROGRESS.md`.

## [~] M4 — Core frontend

_Status 2026-11-20: all deliverables are written and the build, lint and test run passed on the user's machine; the browser walkthrough with the real API is still open (see `TASKS.md`, "M4 carry-over"). M5 was opened in parallel at the user's request._

**Objective:** core financial tasks usable in the browser.

**Deliverables:** application shell and navigation; sign-in and 2FA screens;
dashboard layout; account management; category management; transaction list,
filters, and forms; responsive layout; dark/light themes; loading, empty, and
error states.

**Verification:** user completes core financial tasks through the browser; UI
works at desktop and mobile widths; API validation errors are shown clearly.

**Manual actions:** user checks the UI on real devices if desired.

## [~] M5 — Budgets and dashboard analytics

**Objective:** budgets and a dashboard whose numbers reconcile.

**Deliverables:** overall and category budgets; budget progress calculations;
threshold notifications; dashboard summaries; income/expense and category
charts; period filters and monthly comparisons.

**Verification:** budget calculations are accurate; dashboard totals reconcile
with transactions; transfers and debt/savings activity are correctly excluded.

## [ ] M6 — CSV import

**Objective:** safe statement import with preview and idempotent confirmation.

**Deliverables:** upload endpoint and UI; safe CSV parsing; column mapping;
preview/staging; validation and duplicate detection; user review and
confirmation; import history and summaries; idempotency and file limits.

**Verification:** a sample statement can be previewed and reviewed; invalid rows
are explained; duplicate rows are identified; confirmation creates only approved
transactions; retrying confirmation does not duplicate records.

**Manual actions:** user provides a representative (non-sensitive or sanitized)
sample bank CSV.

## [ ] M7 — Recurring transactions

**Objective:** recurring items that generate exactly once.

**Deliverables:** recurrence model; due-transaction generation; monthly edge
cases defined; pause/resume/cancel; idempotency protection; upcoming list and
notification integration.

**Verification:** due transactions generate correctly; re-running the generator
does not duplicate occurrences; paused/cancelled schedules do not generate.

**Decisions needed:** scheduler mechanism; month-end rule; catch-up policy.

## [ ] M8 — Savings goals and debts

**Objective:** goals and lent/borrowed tracking without double counting.

**Deliverables:** savings goals and contributions; lent/borrowed records;
repayments; linkage to actual account movements; outstanding-balance
calculations; relevant dashboard summaries.

**Verification:** goal and debt balances are accurate; no double counting
occurs; partial and full repayments work.

## [ ] M9 — Reports, exports, and notifications

**Objective:** reports that reconcile, exports that are safe.

**Deliverables:** reports; CSV export; Excel export; PDF export; completed
in-app notifications; notification preferences; formula-injection protection
tests.

**Verification:** reports reconcile with source data; exports respect filters
and owner boundaries; notifications are deduplicated.

**Manual actions:** user reviews QuestPDF licensing before adoption.

## [ ] M10 — Deployment and production hardening

**Objective:** production app on Vercel / Render / Neon with verified restore.

**Deliverables:** production Dockerfile; API on Render; Neon PostgreSQL;
frontend on Vercel; secrets and CORS; health checks and logs; production
migrations; backups; restore test; security and end-to-end tests; provider
pricing and free-tier review. Deployment checklist in spec §9.7.

**Verification:** production app accessible over HTTPS; authentication, 2FA, and
core flows work; database backup and restoration verified; no secrets exposed;
critical financial correctness tests pass.

**Manual actions:** nearly all of it — account creation, secrets, deploys,
backup configuration, restore test, pricing review. See `PROJECT.md` Manual
Action Rule.

---

## Current milestone

**M3 — Core financial domain and database** is complete (closed 2026-11-11,
session 6). **M4 — Core frontend** is code-complete and its build, lint and tests passed on the
user's machine; the browser walkthrough with the real API is still open, so it is not closed.
**M5 — Budgets and dashboard analytics** (in progress, opened 2026-11-20, session 7, at the
user's request while M4 is being tested). `TASKS.md` holds the M5 checklist and lists the M4
items still open; the full M4 checklist is `TASKS-M4.md`. Decisions: D049–D052 (rules and 2FA
screen added during the M4 walkthrough), D053 (budgets).
