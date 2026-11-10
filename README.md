# Raqam

Raqam (رقم, "amount") is a personal finance and expense tracker: a single-user,
PKR-first web application for tracking accounts, income, expenses, transfers,
budgets, and more.

Status: Phase 0 skeleton. No features are implemented yet.

- Specification: [docs/raqam-project-specification.md](docs/raqam-project-specification.md)
- Project memory and current state: [.ai/CONTEXT.md](.ai/CONTEXT.md)

## Structure

```text
backend/
  Raqam.sln
  src/
    Raqam.Domain/          entities and domain rules; depends on nothing
    Raqam.Application/     use cases and contracts; depends on Domain
    Raqam.Infrastructure/  persistence and integrations; depends on Application, Domain
    Raqam.Api/             ASP.NET Core entry point; depends on Application, Infrastructure
frontend/
  raqam-web/               React + TypeScript + Vite + Tailwind CSS
docs/                      specification and architecture notes
.ai/                       AI project memory
```

## Requirements

- .NET SDK 10
- Node.js 22.12 or newer, with npm
- PostgreSQL 17 (from Phase 1)

## Run the API

```bash
cd backend
dotnet build Raqam.sln
dotnet run --project src/Raqam.Api
```

The API listens on http://localhost:5196. Check it with:

```bash
curl http://localhost:5196/api/v1/ping
```

## Run the frontend

```bash
cd frontend/raqam-web
npm install
npm run dev
```

The dev server listens on http://localhost:5173.

Other scripts: `npm run build` (typecheck and production build), `npm run lint`.

## Configuration

Copy `.env.example` to `.env` (and `frontend/raqam-web/.env.example` to
`.env.local`) and fill in local values. Real `.env` files are ignored by Git;
never commit secrets or real financial data.
