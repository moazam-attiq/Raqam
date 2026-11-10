# TASKS.md — Current milestone checklist

## M0 — Repository and development environment

Source: spec §11 Phase 0 and §14. "AI workspace" below means the AI's Linux
cloud environment (.NET SDK 10.0.114, Node 22.23.4), not the developer's Mac.

### Part 1 — Inspection

- [x] Inspect the Raqam project folder — empty on 2026-11-10
- [x] Earlier `ExpenseTracker` work — user confirmed there is nothing to migrate (2026-11-10)
- [ ] Verify tool versions on the Mac: `dotnet --version`, `node --version`, `npm --version`, `psql --version`, `podman --version` (BLOCKERS B002)

### Part 2 — Implementation

- [x] `.gitignore` covering .NET, Node, `.env`, and macOS files
- [x] `backend/Raqam.sln`
- [x] `Raqam.Domain`, `Raqam.Application`, `Raqam.Infrastructure` (class libraries), `Raqam.Api` (ASP.NET Core, controllers — D010)
- [x] All four projects added to the solution
- [x] Project references: Application → Domain; Infrastructure → Application, Domain; Api → Application, Infrastructure
- [x] `frontend/raqam-web` with Vite (React + TypeScript)
- [x] Tailwind CSS added to the frontend
- [x] `.env.example` (root and frontend) with placeholder values only
- [x] Basic `README.md`
- [ ] `git init` on the Mac (BLOCKERS B003)

### Part 3 — Verification

In the AI workspace (done, session 2):

- [x] `dotnet build backend/Raqam.sln` — 0 warnings, 0 errors
- [x] API starts; `GET http://localhost:5196/api/v1/ping` returned HTTP 200
- [x] `npm run build` and `npm run lint` clean
- [x] Frontend dev server answered HTTP 200 on port 5173
- [x] Tailwind utilities present in the built CSS
- [x] Domain project has no project or package references

On the developer's Mac (pending, user):

- [ ] `cd backend && dotnet build Raqam.sln`
- [ ] `dotnet run --project src/Raqam.Api`, then `curl http://localhost:5196/api/v1/ping`
- [ ] `cd frontend/raqam-web && npm install && npm run build`
- [ ] `npm run dev`, open http://localhost:5173, see the centred "Raqam" heading styled by Tailwind
- [ ] `git status` shows no `.env`, `node_modules`, `bin`, or `obj` entries

### Part 4 — Documentation

- [x] `PROJECT.md` Definition of Done and repository structure updated to what exists
- [ ] First commits: `chore: initialize Raqam solution structure`, `chore: configure frontend tooling`
- [ ] When every Mac item above is confirmed by the user: add a `PROGRESS.md` entry, mark M0 `[x]` in `ROADMAP.md`, resolve B002/B003, and replace this file with the M1 checklist
