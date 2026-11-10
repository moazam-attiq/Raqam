# PROJECT.md — Raqam: identity, scope, architecture

Permanent source of truth for what Raqam is and how it is built.

**Authoritative scope document:** `docs/raqam-project-specification.md`
(Baseline project specification, version 1.0, last updated 10 November 2026,
supplied by the user). If this file and the specification disagree, the
specification wins and this file must be corrected.

**Repository state (updated 2026-11-10, session 3):** Phase 0 skeleton only, user-confirmed working and pushed to GitHub.
The solution, four empty projects, and a placeholder frontend exist; no product
feature is implemented. "Architecture" and "Technology stack" describe the plan
per the specification except where marked *present*.

---

## Goal

Raqam (رقم, "amount or sum of money") is a personal finance web application for
recording, organizing, understanding, and planning an individual's money: income,
expenses, transfers, account balances, budgets, recurring transactions, savings
goals, and money lent or borrowed, with manual entry and CSV statement import,
plus reports and exports.

The first release is deliberately a **single-user, PKR-first modular monolith**.

Guiding principle (spec §17): build a trustworthy financial ledger first.
Dashboard, charts, budgets, and insights are only useful when the underlying
numbers are right.

## Scope

### In scope (spec §3)

| Area | Summary | Spec |
|---|---|---|
| Dashboard | Total balance, income, expenses, net cash flow, savings progress, budget usage, category breakdown, recent transactions, upcoming recurring, outstanding lent/borrowed; period filters (this month, previous month, this year, custom) | §3.1 |
| Transactions | Income, Expense, Transfer; CRUD, search, filter, sort, paginate | §3.2 |
| Accounts | Cash, Bank account, Digital wallet, Savings account; create/edit/archive; transfers between accounts | §3.3 |
| Categories and subcategories | Default and user-created; separate income/expense; parent/child; archive when historically used | §3.4 |
| Budgets | Overall monthly and category-specific monthly; progress; in-app alerts at configurable thresholds (defaults 80% and 100%) | §3.5 |
| CSV imports | Upload, select account, preview, column mapping, validation, duplicate detection, review, idempotent confirm, import history | §3.6 |
| Analytics and reports | Income vs expenses; daily/weekly/monthly/yearly summaries; by category; by account; savings trend; monthly comparisons; budget vs actual; transaction history | §3.7 |
| Recurring transactions | Daily, Weekly, Monthly; pause/resume/edit/cancel; safe, non-duplicating generation | §3.8 |
| Savings goals | Goals, contributions (add and reverse), progress, history | §3.9 |
| Money lent and borrowed | Debt/receivable records, partial and full repayments, outstanding balances, due/overdue | §3.10 |
| Notifications | In-app only: budget 80%/100%, recurring upcoming, debt due/overdue, savings milestone (if not excessively complex); configurable, deduplicated | §3.11 |
| Exports | CSV, Excel (XLSX), PDF for transactions, account history, budget summaries, selected reports | §3.12 |
| Backup and restore | Operational capability via provider facilities and documented operator procedures; tested restore | §3.13, §7.13 |
| Interface and accessibility | Responsive (desktop/tablet/mobile), dark and light themes, clear states, accessible labels, keyboard navigation, PKR formatting | §3.14 |
| Security | ASP.NET Core Identity, authenticator-app TOTP 2FA, recovery codes, rate limiting, owner scoping | §8 |

### MVP release definition (spec §12)

The MVP is complete when a user can: sign in securely with 2FA; manage cash,
bank, and wallet accounts; create categories and subcategories; record income,
expenses, and transfers; see accurate balances; view a dashboard and recent
transactions; set monthly budgets and see progress; import a CSV statement
through preview and confirmation; review basic income/expense and category
reports; export transaction data; use the app on mobile and desktop; use dark
and light themes; recover from a database backup using a tested procedure.

Savings goals, debts, recurring transactions, PDF/Excel exports, and more
advanced notifications are **approved product scope** but may follow the first
usable release. They stay planned in `ROADMAP.md`; they are not dropped.

### Out of scope for the first release (spec §1.2, §11 Phase 11)

Explicitly deferred by the specification:

- Multiple currencies and foreign-exchange conversion.
- PDF bank-statement extraction.
- Excel bank-statement imports.
- Receipt image attachments and OCR.
- Automatic bank-account integrations.
- AI financial advice, AI-generated insights, AI-assisted categorization.
- Multi-user, family, or shared household accounts.
- A native iOS or Android application.
- Complex accounting ledgers and tax filing.
- Financial calendar; advanced forecasting and savings analysis.
- Email or push notifications ("can be considered later", §3.11).
- Microservices (§5.1).
- An unrestricted application-level restore endpoint (§7.13).

Raqam is not a bank, accounting platform, investment platform, or multi-user
household finance suite.

## Current scope rule

Development must not exceed the scope documented above without explicit user
approval. Deferred items are not to be started, scaffolded, or "prepared for"
beyond what the specification itself requires (for example, every financial
record still carries an owner ID even though the app is single-user).

## Business rules (spec §4 — non-negotiable)

1. Money is `numeric/decimal`, never `float`/`double`. Database type `numeric(18,2)`.
2. Amounts are stored positive; transaction type expresses direction.
3. Transfers are neither income nor expenses.
4. Every account, category, transaction, budget, import, goal, debt, and notification is scoped to the authenticated owner.
5. Never trust a client-supplied user ID for ownership.
6. Multi-record financial operations use database transactions.
7. Use optimistic concurrency or another explicit strategy against conflicting edits.
8. Persist timestamps in UTC; a date-only transaction date stays a date and must not shift with timezone conversion.
9. Archiving accounts or categories keeps historical records.
10. Transfer source and destination must be distinct and owned by the user.
11. Recurring generation must not duplicate.
12. Import confirmation is idempotent.
13. Debt and savings activity must not be double-counted.
14. Database constraints and indexes back up application validation.
15. Log security-relevant events without passwords, tokens, or unnecessary financial detail.
16. Migrations are tested against a disposable/local database before hosted data.

Accounting rules: a virtual savings-goal contribution is not an expense and
moves no money (§3.9). Money lent is a receivable, not an expense; money
borrowed is a liability, not income; repayments are not income/expense and
must be linked to account movements so they cannot be recorded twice (§3.10).

## Architecture (planned, spec §5)

Layered modular monolith: one deployable ASP.NET Core API, one PostgreSQL
database, one React frontend.

```text
Raqam.Api ───────────────► Raqam.Application
    │                            ▲
    └────► Raqam.Infrastructure ─┘

Raqam.Application ───────► Raqam.Domain
Raqam.Infrastructure ────► Raqam.Application
Raqam.Infrastructure ────► Raqam.Domain
```

- **Raqam.Domain** — entities, enums, value objects, domain rules. No dependency on EF Core, HTTP, or UI.
- **Raqam.Application** — use cases, DTOs/contracts, validation, persistence and external-service abstractions.
- **Raqam.Infrastructure** — EF Core DbContext and configurations, PostgreSQL, Identity persistence, CSV/report infrastructure.
- **Raqam.Api** — endpoints, auth configuration, DI composition root, middleware, exception handling, OpenAPI.
- **Frontend** — pages/layouts, reusable components, API client, feature modules, form schemas, auth state, charts.

API base route: `/api/v1` (endpoint plan in spec §7). Data model in spec §6:
UUID primary keys, explicit relationships, delete behaviours, indexes, and
constraints.

Hosted topology (spec §9): browser → Vercel (frontend) → Render (Dockerized
API) → Neon (PostgreSQL). GitHub is the source and deployment trigger.

## Technology stack (spec §2 and §5.2)

*Present in the repo as of session 2:* .NET 10 (`net10.0`) projects with no
NuGet packages; React 19, TypeScript 7, Vite 8, Tailwind CSS 4 (via
`@tailwindcss/vite`), oxlint (the Vite template's linter). Everything else
below is planned and not installed.

- **Backend:** ASP.NET Core Web API on .NET 10, C#, Entity Framework Core, Npgsql, ASP.NET Core Identity, TOTP 2FA with recovery codes, FluentValidation or equivalent, Swagger/OpenAPI.
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Recharts.
- **Database:** PostgreSQL (local 17.x reported; Neon when hosted).
- **File/report libraries (evaluate and pin when the phase needs them):** CsvHelper, ClosedXML, QuestPDF (after a licensing review).
- **Containers:** Podman preferred locally; do not assume Docker Desktop; no dependency on Podman-specific runtime behaviour.

Rule (spec §5.2): do not install every package at the beginning. Add
dependencies when a phase needs them.

## Repository structure (target, spec §5.3)

```text
Raqam/
├── .ai/                      project memory (this directory)
├── backend/
│   ├── Raqam.sln
│   └── src/
│       ├── Raqam.Api/
│       ├── Raqam.Application/
│       ├── Raqam.Domain/
│       └── Raqam.Infrastructure/
├── frontend/
│   └── raqam-web/
├── docs/
│   ├── raqam-project-specification.md   authoritative scope (present)
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   └── deployment.md
├── docker-compose.yml
├── .gitignore
└── README.md
```

As of session 2 everything above exists except `docs/architecture.md`,
`docs/database.md`, `docs/api.md`, `docs/deployment.md`, and
`docker-compose.yml`, which are created when a phase needs them. Also present:
root `.env.example`, `frontend/raqam-web/.env.example`, and
`backend/src/Raqam.Api/Controllers/PingController.cs` (Phase 0 placeholder at
`GET /api/v1/ping`, to be replaced by `/health` in M1).

## Open technical decisions (spec §16)

Decide at the stated phase; record the outcome in `DECISIONS.md`. Do not guess early.

| # | Decision | Needed by |
|---|---|---|
| 1 | Authentication transport: secure HttpOnly cookie vs JWT (Vercel and Render may be different domains; no long-lived tokens in localStorage) | M2 |
| 2 | Public registration: likely disabled or restricted | M2 |
| 3 | ~~Controllers vs minimal APIs~~ — decided: controllers (D010) | done |
| 4 | Recurring scheduler mechanism (a sleeping free web service will not run on time) | M7 |
| 5 | Monthly recurrence month-end handling and catch-up policy after downtime | M7 |
| 6 | Representation of the overall budget in the unique constraint | M5 |
| 7 | PDF generation: QuestPDF licensing and deployment requirements | M9 |
| 8 | Backup method: provider backups, scheduled logical backups, or both | M10 |
| 9 | Email delivery: whether recovery or alerts need a transactional provider | M2 / M9 |
| 10 | Production domain | M10 |

Balance implementation (spec §16 item 3) is already settled as ledger-first; see D006.

## Definition of Done

A unit of work is done only when all applicable items hold:

- Backend builds: `dotnet build backend/Raqam.sln`
- Backend tests pass: `dotnet test backend/Raqam.sln`
- Frontend builds and typechecks: `npm run build` in `frontend/raqam-web`
- Frontend lint passes: `npm run lint` in `frontend/raqam-web`
- Financial rules touched by the change have tests (spec §10.2 lists the minimum scenarios).
- Migrations were applied to a local/disposable database before any hosted one.
- No secrets or real financial data are committed.
- README/`docs/` notes affected by the change are current.
- `.ai/` is updated: `TASKS.md`, `PROGRESS.md`, and where relevant `ROADMAP.md`, `DECISIONS.md`, `BLOCKERS.md`.

Status of these commands (session 2): `dotnet build`, `npm run build`
(`tsc -b && vite build`), and `npm run lint` (`oxlint`) exist and ran clean in
the AI's Linux workspace. `dotnet test` has nothing to run until the first test
project is added in M1. The user confirmed the skeleton works on the Mac (session 3).

## Manual Action Rule

The AI must not perform, and must never claim completion of, the following.
They require the user, and are recorded as done only after the user confirms:

- Creating or configuring the GitHub repository, and pushing with the user's credentials.
- Creating accounts/projects on Neon, Render, and Vercel; setting their environment variables and secrets.
- Supplying connection strings, passwords, or any credential.
- Enrolling an authenticator app and confirming TOTP/recovery-code behaviour on a real device.
- Deployment, production migrations, DNS/custom domain setup.
- Backup configuration and the restore test on hosted data.
- Reviewing provider pricing, free-tier limits, and QuestPDF licensing terms.
- Installing or upgrading tools on the developer's Mac.
- Checking the app on physical phones/tablets.
