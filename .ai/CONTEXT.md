# CONTEXT.md — Read this first when resuming

## Project summary

Raqam is a single-user, PKR-first personal finance web app: accounts,
income/expense/transfer transactions, categories, budgets, CSV import,
dashboard and reports, recurring transactions, savings goals, lent/borrowed
tracking, in-app notifications, CSV/XLSX/PDF exports, and backup/restore
procedures. Planned as a layered modular monolith: ASP.NET Core (.NET 10) API,
PostgreSQL, React + TypeScript + Vite + Tailwind frontend, hosted on
Render / Neon / Vercel.

**State as of 2026-11-10 (session 2):** Phase 0 skeleton. `backend/Raqam.sln`
with four projects, `frontend/raqam-web` (Vite + React + TypeScript + Tailwind),
`.gitignore`, `.env.example`, and `README.md` exist. No product feature exists.
The skeleton was built and started in the AI's Linux workspace, not yet on the
developer's Mac. Git is not known to be initialized; nothing has been committed.

## How to determine current state

Read in this order:

1. `.ai/PROJECT.md` — what Raqam is, scope, business rules, architecture.
2. `.ai/ROADMAP.md` — milestones and which one is active.
3. `.ai/TASKS.md` — the checklist for the active milestone.
4. `.ai/PROGRESS.md` — what actually happened, newest first.
5. `.ai/BLOCKERS.md` — what is blocked or needs the user.
6. `.ai/DECISIONS.md` — decisions that must not be silently reversed.

For requirement detail, read `docs/raqam-project-specification.md`. It is the
authoritative scope; the `.ai/` files summarize it and track state against it.

Then verify against reality before trusting any of it: list the repository,
check `git status` and `git log`, and confirm that what `.ai/` says exists
actually exists.

## Current milestone

The active milestone is the one marked `[~]` in `ROADMAP.md` and named under
"Current milestone" at the bottom of that file. `TASKS.md` must describe the
same milestone. If they disagree, stop and reconcile them using `PROGRESS.md`
and the repository before doing anything else.

## Session continuation rules

- Continue the active milestone. Do not start a later milestone or unrelated work.
- Do not exceed the scope in `PROJECT.md`. Deferred items need explicit user approval.
- Read `BLOCKERS.md` before starting; do not work around a blocker that needs the user.
- Read `DECISIONS.md` before proposing any architectural change. Changes are made by appending a new decision that supersedes the old one, never by editing history.
- Open technical decisions (table in `PROJECT.md`) are made at their phase, with the user, and then recorded.
- Verify before declaring anything complete. Code existing is not verification. A milestone becomes `[x]` only when its exit criteria were actually checked.
- Record manual actions as done only after the user confirms them.
- At the end of every session: update `TASKS.md`, add a `PROGRESS.md` entry, and update `ROADMAP.md` / `BLOCKERS.md` / `DECISIONS.md` if they changed.

## Working agreement (spec §13 — how the user wants the work done)

Raqam is a learning-friendly engineering exercise, not a block of generated
boilerplate.

- Work in small steps, usually one or two terminal commands at a time.
- Explain what each command does and why it is needed.
- Ask for command output before proceeding when the next step depends on it.
- Inspect the existing folder before creating, deleting, or restructuring files; never overwrite an existing project without checking its contents.
- Diagnose errors before proposing broad changes.
- Avoid unnecessary package installations; add a dependency only when its phase needs it.
- Explain trade-offs when selecting libraries or hosting services.
- Make Git commits at meaningful milestones (examples in spec §13.1, e.g. `chore: initialize Raqam solution structure`).
- Keep README and architecture notes current.

## Important project conventions

These come from the specification. Only the package boundaries, the controller style (D010), and the `/api/v1` route prefix are embodied in code so far.

- **Languages:** C# backend, TypeScript frontend.
- **Package boundaries:** Domain depends on nothing; Application depends on Domain; Infrastructure depends on Application and Domain; Api depends on Application and Infrastructure.
- **Money:** `decimal` in C#, `numeric(18,2)` in PostgreSQL, always positive; type gives direction. Never `float`/`double`.
- **IDs:** UUID/GUID primary keys, including Identity user IDs.
- **Ownership:** every financial record has a `UserId`, derived from the authenticated principal, never from the request payload.
- **Time:** timestamps persisted in UTC with a `...Utc` suffix (`CreatedAtUtc`, `UpdatedAtUtc`); transaction dates are date-only and must not shift.
- **Deletion:** archive accounts and categories that have history; do not cascade-delete financial history.
- **Balances:** computed from opening balance plus ledger movements (D006).
- **API:** controllers, not minimal APIs (D010); base route `/api/v1`; consistent status codes, validation responses, pagination, and error shapes.
- **Totals:** transfers, debt proceeds/repayments, and virtual savings allocations never count as income or expense in dashboards, budgets, or reports.
- **Configuration:** environment variables; `.env` files stay out of Git; commit `.env.example` with placeholders only. Local, preview, and production never share a database.
- **Migrations:** applied through a controlled step, tested locally first, not run automatically on every production startup.
- **Local ports:** API `http://localhost:5196` (launchSettings), frontend dev server `http://localhost:5173`.
- **Frontend tooling:** Tailwind CSS 4 through the `@tailwindcss/vite` plugin and `@import "tailwindcss"` in `src/index.css` (no `tailwind.config.js`); lint is `oxlint`.
- **Containers:** Podman locally; do not assume Docker Desktop.
- **Environment:** developer machine is a 2017 Intel MacBook Pro on macOS 13.7.8 (as reported in the spec; tool versions unverified — see `BLOCKERS.md` B002). Do not reinstall working tools without a demonstrated need.
