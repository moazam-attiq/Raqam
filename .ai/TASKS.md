# TASKS.md — Current milestone checklist

## M3 — Core financial domain and database

Source: spec §11 Phase 3, §3.2–§3.4, §4 (rules 1–10, 14), §6.2–§6.4, §7.3–§7.5,
§8.2, §10.1–§10.2. Goal: a correct ledger — accounts, categories, and
transactions (income, expense, transfer) whose balances reconcile, with
transfers excluded from income/expense totals.

Ledger-first balances (D006), positive decimal amounts (D005), and owner scoping
(D004) already apply. All Part 0 decisions (D021–D032) are made and recorded.

### Part 0 — Decisions

Made with the user and recorded in `DECISIONS.md`:

- [x] Default categories: per-user owned rows, seeded idempotently (D021)
- [x] Transaction date: plain date, no time-of-day (D022)
- [x] Transfers: one row, created through `/transactions` (D023)
- [x] Negative balances allowed; archived accounts/categories reject new
      activity (D024)

Confirmed by the user and recorded:

- [x] Persistence access from Application: narrow repository-style interfaces;
      no EF Core reference in Application (D025)
- [x] Owner scoping: explicit `UserId` filters, not EF global query filters;
      other users' resources return 404 (D026)
- [x] Optimistic concurrency with PostgreSQL `xmin`; a stale `PUT` returns 409
      (D027)
- [x] Categories: one level of subcategory, same type as parent, archiving a
      parent archives its children (D028)
- [x] Transactions hard-deleted; accounts and categories archived only (D029)
- [x] Amounts with more than 2 decimal places rejected, not rounded (D030)
- [x] Opening balance editable; currency fixed to `PKR` (D031)
- [x] `GET /accounts/{id}/balance` accepts an optional `asOf` date (D032)

### Part 1 — Domain (`Raqam.Domain`)

**Status (session 6):** written, and `dotnet build` passed on the Mac (user
confirmed). Behaviour is not exercised yet: the unit tests (Part 5) and the 400
mapping are tested later. Files:
`Raqam.Domain/Common/{DomainException,MoneyRules,Guard}.cs`,
`Accounts/{Account,AccountType}.cs`, `Categories/{Category,CategoryType}.cs`,
`Transactions/{Transaction,TransactionType}.cs`; `GlobalExceptionHandler` (Api)
now returns 400 for `DomainException`.

Choices made while writing it (not in the spec; change if you disagree):
a single `Transaction.Create` / `Update` pair covers all three types (D023), so
an edit may change the type; description is never null but may be empty; max
lengths are name 100, institution 100, description 500, merchant 200, colour
20, icon 50; an account or category already on a transaction may be archived and
the transaction still editable, only a *newly* referenced one must be active;
category type and parent are fixed after creation; `Transaction.SignedEffectOn`
is the one definition of balance direction for tests to check the SQL against;
each entity has a `uint Version` for the `xmin` token (D027).

- [x] Enums: `AccountType` (Cash, BankAccount, DigitalWallet, SavingsAccount),
      `CategoryType` (Income, Expense), `TransactionType` (Income, Expense,
      Transfer)
- [x] `Account`: Id, UserId, Name, AccountType, OpeningBalance, CurrencyCode
      (`PKR`), InstitutionName?, IsArchived, CreatedAtUtc, UpdatedAtUtc
- [x] `Category`: Id, UserId, Name, Type, ParentCategoryId?, Colour?, Icon?,
      IsArchived, CreatedAtUtc, UpdatedAtUtc
- [x] `Transaction`: Id, UserId, Type, Amount, TransactionDate (`DateOnly`),
      SourceAccountId, DestinationAccountId?, CategoryId?, Description,
      Merchant?, CreatedAtUtc, UpdatedAtUtc. The optional source-reference
      columns (`RecurringTransactionId`, `ImportBatchId`, `ExternalReference`)
      are **not** added now — M6/M7 add them with their own migrations
- [x] Domain rules enforced in the entities (factory/update methods), not only
      in validators: amount > 0; income = one account + income category;
      expense = one account + expense category; transfer = distinct source and
      destination, no category; archived account/category rejected for new
      activity (D024); subcategory rules (Part 0)
- [x] Domain exceptions that map to a clear `400`/`409` ProblemDetails via the
      existing `GlobalExceptionHandler`

### Part 2 — Persistence (`Raqam.Infrastructure`)

**Status (session 6):** configurations, `DbSet`s, migration
`20261111123050_AddCoreFinancialDomain` and the seeder are done and verified by
the user: migration applied to `raqam_dev`, `dotnet test` 7/7 green after the
seeder race fix (D034), and `psql` shows 10 Expense + 5 Income default
categories and a working `xmin` query. Same-owner enforcement uses composite
keys (D033). Fresh-database check (rule 16) also done: all three migrations
applied cleanly to an empty scratch database.

- [x] `DbSet`s and per-entity `IEntityTypeConfiguration` classes; UUID keys;
      `numeric(18,2)` for money; enums stored as strings; `date` for
      `TransactionDate`
- [x] Explicit relationships with `Restrict` delete behaviour (never cascade
      financial history); self-reference for category parent
- [x] Check constraints: `Amount > 0`; valid transaction type; transfer shape
      (transfer ⇒ destination present, category absent, source ≠ destination;
      non-transfer ⇒ destination absent, category present)
- [x] Indexes: `UserId` on each table; `(UserId, TransactionDate)`;
      `SourceAccountId`; `DestinationAccountId`; `CategoryId`; unique account
      name per user; unique category name per user + parent + type (NULL parent
      treated as equal)
- [x] DB-level same-owner enforcement for FKs through composite `(UserId, Id)`
      keys (chosen over application-only checks; record as a decision once the
      migration is applied and tested)
- [x] `UpdatedAtUtc` is set by the domain methods (no save hook needed);
      concurrency token configured as `xmin` (D027)
- [x] Migration `AddCoreFinancialDomain` created, reviewed, applied to the
      local `raqam_dev` database
- [x] Migration also applied to a fresh scratch database and dropped again
      (rule 16): created as `postgres` with `OWNER raqam_dev`, then
      `dotnet ef database update --connection ...` applied `InitialCreate`,
      `AddIdentity`, `AddCoreFinancialDomain` and printed `Done.` (user output).
      The scratch database is to be dropped by the user (`DROP DATABASE`).
- [x] Seeder: default expense and income categories created for the seeded user
      only when the user has none (D021); the category list is shown to the user
      before it is seeded

### Part 3 — Application (`Raqam.Application`)

**Status (session 6), slice 1 — accounts and categories:** built and tests
green (user-reported, "success" after `dotnet add ... FluentValidation --version
12.2.0`, `dotnet build`, `dotnet test`). Files: `Application/Common/{NotFoundException,
ConflictException,IUnitOfWork,MoneyValidation}.cs`, `Application/Accounts/*` and
`Application/Categories/*`, `Infrastructure/Persistence/Repositories/{Account,
Category}Repository.cs` and `UnitOfWork.cs`; wiring in `Program.cs` and
`DependencyInjection.cs`; `GlobalExceptionHandler` maps 404 and 409 (D035).

**Status (session 6), slice 2 — transactions, balance, ledger totals:** built and
tests green (user-reported, "success"; no counts shared). Files:
`Application/Common/PagedResult.cs`, `PositiveAmount` rule in `MoneyValidation.cs`,
`Application/Transactions/{TransactionContracts,TransactionValidators,
ITransactionRepository,TransactionService}.cs`, `Application/Ledger/{LedgerContracts,
LedgerService}.cs`, `Infrastructure/Persistence/Repositories/TransactionRepository.cs`;
registered in `Program.cs` and `DependencyInjection.cs`. Behaviour: D036. No test
exercises these services yet (Part 5), so the box ticks below mean "compiles and is
wired", with behaviour proven in Part 5/6.

- [x] Request/response contracts for accounts, categories, transactions
      (money as `decimal`, never float; `UserId` never accepted from a payload —
      rule 5)
- [x] FluentValidation validators for each request; move the validator scan so
      it also covers the Application assembly (D013 consequence)
- [x] Account use cases: create, edit, archive, get, list, account
      transaction history, balance
- [x] Category use cases: create, edit, archive, get, list (tree/flat shape
      chosen with the frontend in mind)
- [x] Transaction use cases: create, edit, delete, get, list with date-range /
      type / account / category / text-search filters, sort, and paging
- [x] Balance calculation: opening balance + income − expense − transfers out +
      transfers in, computed in the database in one query (no per-row loading),
      with the optional `asOf` date
- [x] Ledger totals query: income and expense totals for a date range that
      excludes transfers (needed to verify the exit criterion; endpoints and
      dashboard stay in M5)
- [x] Every read, update, and delete is filtered by `ICurrentUser`; another
      user's id returns 404, not 403 (no existence leak)
- [x] Multi-record changes (if any) run in one database transaction (rule 6);
      a transfer is a single row, so it needs none. The only multi-record change
      is archiving a parent category with its children: one `SaveChangesAsync`, so
      one database transaction (checked by reading `CategoryService.ArchiveAsync`;
      the outcome is covered by the archive-cascade test, atomic rollback is not
      tested separately)

### Part 4 — API (`Raqam.Api`)

**Status (session 6):** controllers built and verified over HTTP: `scripts/m3-smoke.sh`
re-run after the search-escape fix gave **56 passed, 0 failed** (user-reported).
OpenAPI document reviewed (all endpoints listed, output shared).

- [x] `AccountsController`: `GET/POST /accounts`, `GET/PUT /accounts/{id}`,
      `POST /accounts/{id}/archive`, `GET /accounts/{id}/transactions`,
      `GET /accounts/{id}/balance` (spec §7.3)
- [x] `CategoriesController`: `GET/POST /categories`, `GET/PUT
      /categories/{id}`, `POST /categories/{id}/archive` (spec §7.4)
- [x] `TransactionsController`: `GET/POST /transactions`, `GET/PUT/DELETE
      /transactions/{id}` with query parameters for date range, type, account,
      category, search, sort, page, page size (spec §7.5)
- [x] All routes under `api/v1`, covered by the existing authentication
      fallback policy and the CSRF filter (D018); stale `PUT` returns `409`
- [x] OpenAPI document reviewed in Development (`/openapi/v1.json`): lists the 7 account, 5 category and 5 transaction endpoints plus auth and 2FA

### Part 5 — Tests

**Status (session 6):** `Raqam.Domain.Tests` created by the user; first full run gave
117 passed, 22 failed, all `429` on login (xUnit runs `InitializeAsync` per test, so the
5-logins-a-minute limit was hit). Fixed by making the login limit configurable
(`RateLimiting:LoginPermitLimit`, default 5, D019 amendment) and giving the new
integration test classes an `ApiFactory` that raises it; `RateLimitingTests` keeps the
default. Re-run: **green** (user-reported "success"; counts not shared). Tests: domain in
`Raqam.Domain.Tests`; integration in `Raqam.Api.Tests` (`TestApiClient.cs`,
`OwnershipTests.cs`, `BalanceTests.cs`, `RulesAndConcurrencyTests.cs`,
`DatabaseConstraintTests.cs`). Each test creates its own throwaway user.

Domain unit tests (new `Raqam.Domain.Tests` project, added to `Raqam.sln`):

- [x] Each transaction rule in Part 1 has a passing and a failing case
- [x] Amount handling: zero, negative, more than 2 decimals, too large

Integration tests against local PostgreSQL (`Raqam.Api.Tests`, existing
pattern; tests create and clean up their own throwaway users):

- [x] Spec §10.2 scenarios 1–6: income raises a balance; expense lowers it; a
      transfer lowers one account and raises another by the same amount; a
      transfer is not income or expense; editing a transaction updates
      balances; deleting reverses its effect
- [x] Balances reconcile: opening balance + ledger = balance endpoint result
      after a mixed sequence of operations, including an `asOf` date
- [x] Ledger totals exclude transfers
- [x] Database constraints reject bad rows directly (zero/negative amount,
      same-account transfer, transfer with a category, income without a
      category, wrong-type category)
- [x] Archived account and archived category reject new transactions but keep
      history; history and balance of an archived account still readable
- [x] Stale-version `PUT` returns `409`
- [x] **Carried over from M2:** a request naming another user's id cannot act
      as that user — a payload-supplied `UserId` is ignored, and user B cannot
      read, edit, archive, or delete user A's accounts, categories, or
      transactions (spec §8.2, §10.2 item 13, rule 5)
- [x] Anonymous requests to the new endpoints return `401`
- [x] Full `dotnet build` and `dotnet test` green on the Mac (user shares
      output)

### Part 6 — Verification (exit criteria)

Evidence is user-run output: `scripts/m3-smoke.sh` 56 passed / 0 failed (HTTPS),
and `dotnet test` green (`Raqam.Api.Tests` 55 passed; 84 in `Raqam.Domain.Tests`
by subtraction from the earlier 139-test run).

- [x] Accounts and categories can be created, edited, archived, and listed
      through the API — smoke script (curl walkthrough) 56/56
- [x] Income, expense, and transfer can each be created, edited, and deleted —
      smoke script; `BalanceTests.Editing_and_deleting_a_transaction_changes_the_balance_straight_away`
- [x] Balances reconcile — `BalanceTests.Balance_matches_the_signed_effect_of_every_transaction_at_every_date`
      (3 accounts, 12 transactions, 6 `asOf` dates) plus the smoke script's
      balance and `asOf` checks
- [x] Transfers are excluded from income/expense totals —
      `BalanceTests.Ledger_totals_exclude_transfers` and
      `BalanceTests.A_transfer_shows_once_in_each_accounts_history_and_nets_to_zero`
- [x] The carried-over M2 ownership item is checked off here with test names:
      `OwnershipTests.Another_users_account_is_not_found_for_every_operation`,
      `...category_is_not_found_for_every_operation`,
      `...transaction_is_not_found_for_every_operation`,
      `A_transaction_cannot_reference_another_users_account_or_category`,
      `Lists_and_filters_never_include_another_users_records`,
      `A_user_id_in_the_payload_is_ignored`

### Part 7 — Documentation and close-out

- [x] `DECISIONS.md`: anything decided during implementation recorded (D021–D036;
      D019 amended for the configurable login limit)
- [x] `docs/architecture.md`: Domain, Application, Infrastructure and Api
      sections updated; M3 cross-cutting pieces (balance calculation, ownership,
      concurrency, constraints, errors) added
- [x] README: accounts / categories / transactions walkthrough, test projects,
      HTTPS profile
- [x] `PROGRESS.md` entry; `CONTEXT.md` and `BLOCKERS.md` refreshed; M3 closed in
      `ROADMAP.md` (Part 6 verified by shared output)
- [ ] Replace this file with the M4 checklist when M4 is opened (M4's open
      decisions are discussed with the user first)

### Process reminders

- The device bridge has silently failed to apply pushes before. After every
  push, re-stage the file and read its content before telling the user to
  build (see `PROGRESS.md`, session 5).
- Before editing any `.csproj`, `.sln`, or tool manifest the user also changes
  with `dotnet add` / `dotnet sln add`, stage and read the live file first.
- The AI has no shell on the Mac in this setup; the user runs `dotnet`
  commands and shares output (B004).
