# BLOCKERS.md — Open blockers and manual actions

Live list. Remove/close an item only once actually resolved and confirmed
by the user; note the resolution date instead of deleting history for
anything non-trivial.

## Open now

### B002 — Local toolchain versions unverified

- **Type:** User action (commands must run on the developer's Mac).
- **What is blocked:** closing M0 (its exit criteria must hold on the
  developer's machine).
- **Why:** the specification reports .NET SDK 10.0.402, Node.js 22.13.0,
  npm 10.9.2, PostgreSQL 17.10, Podman 5.8.5 on macOS 13.7.8 (2017 Intel
  MacBook Pro) and itself says versions may have changed.
- **Update (session 2):** the skeleton was generated with .NET SDK 10.0.114
  and Node 22.23.4 in the AI's Linux workspace, a different SDK feature band
  from the reported 10.0.402. Projects target `net10.0` with no `global.json`,
  so this should not matter, but it is unconfirmed until built on the Mac.
  The frontend's Vite 8 needs a recent Node 22; the reported 22.13.0 is
  expected to satisfy it, unconfirmed.
- **Next action:** run `dotnet --version`, `node --version`, `npm --version`,
  `psql --version`, `podman --version` and share the output.
- **Workaround:** none needed.
- **Resolved when:** actual versions and the results of `dotnet build`,
  `dotnet run`, `npm install`, `npm run build`, and `npm run dev` on the Mac
  are recorded in `PROGRESS.md`. Do not reinstall anything unless a
  compatibility problem is demonstrated.

### B003 — Git repository and GitHub remote state unknown

- **Type:** User action.
- **What is blocked:** commits and, later, deployments (Vercel and Render
  deploy from GitHub).
- **Why:** it was not verified whether the Raqam folder is a Git repository,
  and no GitHub repository is known to exist.
- **Next action:** check for `.git` (`ls -la`); `git init` if absent; the user
  creates the GitHub repository and adds the remote when ready.
- **Workaround:** local work can proceed with a local repository only.
- **Resolved when:** the user confirms the remote exists and the first push
  succeeded.


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
