# TASKS.md — Current milestone checklist

## M1 — Architecture foundation

Source: spec §11 Phase 1. The AI cannot restore NuGet packages or reach the
Mac's shell (BLOCKERS B004): the AI writes code and commands, the user runs
them on the Mac and shares the output. Add only the packages this phase needs.

### Part 1 — Setup (user, on the Mac)

- [x] Local PostgreSQL: the installed PostgreSQL 17.10 on the Mac (D011)
- [x] Local role and database `raqam_dev` created; user showed a successful connection as `raqam_dev`
- [x] `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 (Infrastructure) and `Microsoft.EntityFrameworkCore.Design` 10.0.14 (Api) added on the Mac
- [ ] OpenAPI package (Api)
- [x] `dotnet-ef` installed as a local tool via `dotnet new tool-manifest` + `dotnet tool install dotnet-ef`

### Part 2 — Implementation

- [x] `RaqamDbContext` in Infrastructure (no entities yet)
- [x] `AddInfrastructure` extension, composed in `Program.cs`. `AddApplication` is added when Application has something to register
- [x] Connection string from configuration (`ConnectionStrings:Default`), supplied locally through .NET user-secrets (D011), never committed
- [x] Global exception handling (`GlobalExceptionHandler`, ProblemDetails) — built on the Mac
- [ ] Request validation approach wired in (FluentValidation or equivalent — record the choice in `DECISIONS.md`)
- [x] OpenAPI enabled in Development via built-in `Microsoft.AspNetCore.OpenApi` (`AddOpenApi`/`MapOpenApi`) — `GET /openapi/v1.json` returns 200 (user showed output, 2026-11-10)
- [x] `/health` endpoint with a database check (`DatabaseHealthCheck` in Api); placeholder `PingController` removal requested, not confirmed
- [ ] Logging configuration (structured console logging)
- [x] Initial EF Core migration `InitialCreate` created and applied to `raqam_dev` (empty — no entities yet)
- [ ] Test project with one integration test (health endpoint)

### Part 3 — Verification

- [ ] `dotnet build backend/Raqam.sln` clean
- [x] API connects to local PostgreSQL (user showed output, 2026-11-10)
- [x] `GET /health` responds healthy — `200 OK`, body `Healthy` (user showed output, 2026-11-10)
- [x] Migration applied cleanly; `__EFMigrationsHistory` created (user ran `dotnet ef database update`, 2026-11-10)
- [ ] `dotnet test backend/Raqam.sln` passes
- [ ] No connection string or secret in `git status` / committed files

### Part 4 — Documentation

- [ ] README run instructions updated (database setup, migrations, tests)
- [ ] `docs/architecture.md` started if useful
- [ ] `DECISIONS.md` updated for choices made here (validation library, OpenAPI package, how local secrets are supplied)
- [ ] `PROGRESS.md` entry; close M1 in `ROADMAP.md` only when every Part 3 item is confirmed; replace this file with the M2 checklist
