# BLOCKERS.md — Open blockers and manual actions

Live list. Remove/close an item only once actually resolved and confirmed
by the user; note the resolution date instead of deleting history for
anything non-trivial.

## Open now

### B004 — AI workspace cannot restore NuGet packages or reach the Mac's shell

- **Type:** AI limitation.
- **What is blocked:** the AI building or testing anything that needs a NuGet
  package (EF Core, Npgsql, Identity, test frameworks) or a running PostgreSQL,
  which is all of M1 onward on the backend.
- **Why:** in sessions 1–2 the AI's cloud workspace could install the .NET SDK
  and npm packages but `api.nuget.org` was unreachable, and no shell on the
  developer's Mac was available (files could only be listed and copied).
- **Next action:** from M1, the user runs `dotnet` commands on the Mac and
  shares output, per the working agreement in `CONTEXT.md`.
- **Workaround:** the AI writes code and exact commands; the user builds and
  tests locally. Frontend work can still be built and linted by the AI.
- **Resolved when:** a session has a working shell on the Mac or NuGet access.

## Upcoming manual actions (not blocking yet)

| Needed by | Action | Owner |
|---|---|---|
| M1 | Provide local PostgreSQL access (native or Podman) and credentials via `.env` | User |
| M2 | Decide auth transport (cookie vs JWT) and public registration | User, with AI analysis |
| M2 | Enroll an authenticator app; confirm TOTP and recovery codes work | User |
| M6 | Provide a representative, sanitized sample bank CSV | User |
| M7 | Decide scheduler mechanism, month-end rule, catch-up policy | User, with AI analysis |
| M9 | Review QuestPDF licensing terms | User |
| M10 | Create Neon, Render, and Vercel projects; set secrets, CORS origins, env vars | User |
| M10 | Configure backups and perform the restore test | User |
| M10 | Review provider pricing and free-tier limits | User |

## Known bugs

None known. Only skeleton code exists.

## Resolved

### B001 — Earlier `ExpenseTracker` work not located or inspected

- **Resolved:** 2026-11-10 (session 2), user-confirmed.
- **What was done:** the user stated there is nothing to migrate and asked to
  scaffold from scratch. No `ExpenseTracker` directory was inspected by the AI.
- **Context:** spec §14 required inspecting any earlier `ExpenseTracker` setup
  before creating the Raqam structure.

### B002 — Local toolchain versions unverified

- **Resolved:** 2026-11-10 (session 3), user-confirmed.
- **What was done:** the user ran the M0 checks on the Mac and reported
  "everything is good". The exact tool versions and command output were not
  shared, so the versions in the specification remain the only record.
- **Context:** the skeleton was generated with .NET SDK 10.0.114 on Linux; the
  Mac was reported to have 10.0.402.

### B003 — Git repository and GitHub remote state unknown

- **Resolved:** 2026-11-10 (session 3), user-confirmed.
- **What was done:** the user initialized Git and pushed to GitHub. A `.git`
  directory is present in the project folder. The remote URL is not recorded
  here.
