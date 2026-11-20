# TASKS.md — Current milestone checklist

## M5 — Budgets and dashboard analytics

Source: spec §11 Phase 5, §3.1, §3.5, §3.7 (income vs expenses, spending by category, monthly
comparison, budget vs actual), §3.11 (budget alerts only), §6 (Budgets), §7.2 and §7.6.
Goal: set monthly budgets (overall and per category), see progress with 80% and 100% alerts,
and a dashboard whose numbers reconcile with the transactions.

Opened 2026-11-20 on the user's instruction ("move to the next phase while I test") while M4's
walkthrough is still open, so M4 stays `[~]` in `ROADMAP.md`. Decision D053 applies. The AI writes
files; the user runs `dotnet` and `npm` and shares output. Backend code is written without a
compiler on the AI's side, so it counts as unverified until the user's `dotnet test` output.

### M4 carry-over (user)

The full M4 checklist is in `TASKS-M4.md`. Still open there:
- [x] 2FA turn-on with a real authenticator app and sign-in with it (D052): user reported it works
      (2026-11-20)
- [ ] Rest of the browser walkthrough with the real API at desktop and phone widths: edit and delete,
      filter and search, a visible API validation error, recovery-code sign-in
- [ ] D049 / D051 / D050 behaviour seen in the browser (no negative balance, no future date,
      this-month default list)
- [ ] Re-run after `npm install` (new `uqr` dependency): `npm test`, `npm run lint`, `npm run build`
- [ ] `dotnet test` including the D051 future-date tests (user said passing; no full passing output shared yet)
- [ ] Then close M4 in `ROADMAP.md`

### Part 0 — Decisions

- [x] Budget model, what counts as spending, alert scope (D053)
- [x] Dashboard endpoints: period summary, previous period, category rollup, monthly series (D054)
- [ ] Chart approach (D055, written when Part 4 starts)

### Part 1 — Budgets backend

Status: complete. The user applied the `AddBudgets` migration and ran `dotnet test` on 2026-11-20
and reported everything working (no output pasted after a first compile error in the constraint
tests, `TestApiClient` vs `TestDatabase`, which I fixed). Recorded as user-reported.

- [x] Domain: `Budget` (create and edit rules), `BudgetProgress` (spent, remaining, percent,
      status at 80% and 100%), `BudgetStatus`
- [x] Application: contracts, validators, `IBudgetRepository`, `BudgetService`; the expense-by-
      category aggregate on `ITransactionRepository`
- [x] Infrastructure: `BudgetConfiguration` (check constraints, composite owner foreign key,
      unique per owner, month and category with `NULLS NOT DISTINCT`), `BudgetRepository`
- [x] API: `BudgetsController` (list a month, create, get with progress, edit amount, delete)
- [x] Migration `AddBudgets` created and applied (user runs the two commands below)
- [x] Tests: domain (`BudgetTests`, `BudgetProgressTests`), API (`BudgetTests`), database
      constraints (`BudgetConstraintTests`); `dotnet test` green (user shares output)

Commands (from `backend/`):

```bash
dotnet ef migrations add AddBudgets --project src/Raqam.Infrastructure --startup-project src/Raqam.Api
dotnet ef database update --project src/Raqam.Infrastructure --startup-project src/Raqam.Api
dotnet test
```

### Part 2 — Dashboard backend

Status: written. The user said the tests passed, but the output they then pasted was a compile error
in `DashboardTests.cs` (a missing `using`, fixed twice: the first write did not reach the device). Not
verified until a passing `dotnet test` run is shared. No migration, no new table.

- [ ] `GET /dashboard/summary?from=&to=`: income, expense, net and count for the period, the same
      figures for the period just before it, and expense by top-level category; transfers never counted
- [ ] `GET /dashboard/monthly?months=N`: income and expense per month for the comparison chart
- [ ] Totals reconcile with the transaction list for the same filters (test)
- [ ] Tests, including transfers excluded and another user's data never counted

### Part 3 — Budgets frontend

Status: complete. Checked in the AI's workspace (305 frontend tests pass, lint and build clean, axe
clean in light and dark, no horizontal overflow at 390 and 768 px); the user reported it works in the
browser. The user's own `npm test` / `lint` / `build` output for it has not been shared.

- [x] `/budgets` page (`features/budgets/`): month switcher (kept in the address as `?month=2026-11`),
      overall and category budgets with progress bars and status, alerts at 80% and 100% in the page,
      empty, loading and error states, a "Budgets" link in the sidebar
- [x] Create, edit amount and delete dialogs (a duplicate and a stale edit are handled as elsewhere)
- [x] Budget progress refreshes after any transaction is added, edited or deleted
- [x] Tests (`budgets.test.tsx`, `budget-month.test.ts`) and an axe pass in both themes
- [x] Seen in the browser by the user with the real API: user reported the budgets page works
      (2026-11-20)

### Part 4 — Dashboard analytics frontend

- [ ] Period filter: this month, previous month, this year, custom range
- [ ] Income, expense and net cards with the change against the previous period
- [ ] Expense by category chart and monthly comparison chart (chart approach decided in D054)
- [ ] Budget usage and alerts on the dashboard
- [ ] Tests, axe pass, responsive check

### Part 5 — Verification and close-out

- [ ] Budget calculations checked by hand against known transactions (user, or recorded test)
- [ ] Dashboard totals reconcile with the transactions list for the same period (user)
- [ ] README, `docs/architecture.md`, `DECISIONS.md`, `PROGRESS.md` current; close M5 in
      `ROADMAP.md` only after verification by output the user shared

### Process reminders

- The device bridge has silently failed to apply pushes before. After every push, re-stage a
  file and read its content before telling the user to build.
- Before editing any `.csproj`, `.sln`, tool manifest or `package.json` the user also changes,
  stage and read the live file first.
- The AI has no shell on the Mac in this setup; the user runs `dotnet` and `npm` commands.
