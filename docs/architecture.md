# Architecture

Raqam is a layered modular monolith (spec §5): one ASP.NET Core API, one
PostgreSQL database, no microservices. This file tracks what each project is
responsible for and what actually exists so far; `.ai/PROJECT.md` has the full
rationale and the business rules this architecture exists to serve.

## Projects

```text
Raqam.Api ───────────────► Raqam.Application
    │                            ▲
    └────► Raqam.Infrastructure ─┘

Raqam.Application ───────► Raqam.Domain
Raqam.Infrastructure ────► Raqam.Application
Raqam.Infrastructure ────► Raqam.Domain
```

- **Raqam.Domain** — entities, enums, value objects, domain rules. No
  dependency on EF Core, HTTP, or UI. Empty so far; gains entities in M3.
- **Raqam.Application** — use cases, DTOs/contracts, validation rules,
  persistence abstractions. Empty so far.
- **Raqam.Infrastructure** — EF Core (`RaqamDbContext`), PostgreSQL via
  Npgsql, migrations. Registered through `AddInfrastructure` in
  `DependencyInjection.cs`.
- **Raqam.Api** — composition root, controllers, middleware. Registers
  exception handling, request validation, health checks, and OpenAPI.

## Cross-cutting pieces (M1)

- **Database access:** `RaqamDbContext` (Infrastructure), connection string
  from `ConnectionStrings:Default`, supplied locally via .NET user-secrets
  (D011) and in hosted environments via the `ConnectionStrings__Default`
  environment variable.
- **Error handling:** `GlobalExceptionHandler` (Api) converts any unhandled
  exception to a `ProblemDetails` response; the exception detail is included
  only in Development.
- **Validation:** FluentValidation, applied through a custom `ValidationFilter`
  action filter rather than an automatic-integration package (D013). No
  validators exist yet — there are no request DTOs until M3.
- **Logging:** built-in console providers, single-line in Development, JSON
  lines once hosted (D014). No third-party logging package.
- **API documentation:** the built-in `Microsoft.AspNetCore.OpenApi` package
  (D012), Development only, served at `/openapi/v1.json`.
- **Health check:** `GET /health` (Api), including `DatabaseHealthCheck`,
  which calls `CanConnectAsync` against the real database.

## Why this split

The dependency direction keeps business rules (Domain, Application) free of
persistence and web-framework details, so the financial rules in spec §4 can
be unit-tested without a database and without HTTP. Infrastructure and Api
are the only projects allowed to know about EF Core or ASP.NET Core.

See `.ai/DECISIONS.md` for the reasoning behind each specific choice (D001
onward) and `.ai/ROADMAP.md` for what each milestone adds here.
