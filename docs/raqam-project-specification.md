# Raqam

## Personal Finance & Expense Tracker

### Product Requirements, Technical Architecture, Data Model, API Plan, Deployment Strategy, and Delivery Roadmap

**Project codename:** Raqam\
**Meaning:** "Raqam" (رقم) means amount or sum of money. It is short,
memorable, locally meaningful, and appropriate for a personal finance
product.\
**Document status:** Baseline project specification\
**Version:** 1.0\
**Last updated:** 10 November 2026

------------------------------------------------------------------------

# 1. Project Overview

Raqam is a personal finance web application for recording, organizing,
understanding, and planning an individual's money.

The application will provide a single place to track income, expenses,
transfers, account balances, budgets, recurring transactions, savings
goals, and money lent or borrowed. Users can enter transactions manually
or import bank statements in CSV format. Reports and exports will help
the user understand financial activity over time.

The first release is deliberately a **single-user, PKR-first modular
monolith**. It should be straightforward to develop, deploy, maintain,
and extend without prematurely introducing microservices or
infrastructure that the project does not need.

## 1.1 Product goals

-   Make it easy to record everyday income and expenses.
-   Maintain accurate balances across cash, bank, and digital-wallet
    accounts.
-   Distinguish transfers from actual income and expenses.
-   Support practical monthly and category-based budgeting.
-   Import CSV statements without creating duplicate transactions.
-   Show understandable summaries, trends, and reports.
-   Track savings goals and money lent to or borrowed from other people.
-   Keep the interface usable on desktop, tablet, and mobile.
-   Keep the application affordable to host without requiring a
    personally managed VPS.
-   Preserve user ownership and privacy of financial data.

## 1.2 Non-goals for the first release

The first release will not attempt to become a bank, accounting
platform, investment platform, or multi-user household finance suite.

Deferred items include: - Multiple currencies and foreign-exchange
conversion. - PDF bank-statement extraction. - Excel bank-statement
imports. - Receipt image attachments and OCR. - Automatic bank-account
integrations. - AI financial advice or AI-generated insights. -
Multi-user, family, or shared household accounts. - A native iOS or
Android application. - Complex accounting ledgers and tax filing.

These can be evaluated after the core product is reliable.

------------------------------------------------------------------------

# 2. Confirmed Product Decisions

  -----------------------------------------------------------------------
  Area                                Decision
  ----------------------------------- -----------------------------------
  Product                             Raqam

  Platform                            Responsive web application

  Intended use                        Personal, single-user

  Transaction entry                   Manual entry and CSV import

  Backend                             ASP.NET Core Web API, .NET 10

  Frontend                            React, TypeScript, Vite

  Styling                             Tailwind CSS

  Database                            PostgreSQL

  ORM                                 Entity Framework Core with Npgsql

  Authentication                      ASP.NET Core Identity

  Two-factor authentication           Authenticator-app TOTP and recovery
                                      codes

  Primary currency                    PKR

  Import format, initial release      CSV only

  Frontend hosting                    Vercel

  API hosting                         Render, using a Dockerfile

  Hosted database                     Neon PostgreSQL

  Source control                      GitHub

  Architecture                        Layered modular monolith

  Local container tooling             Podman is available and preferred
                                      over Docker where practical
  -----------------------------------------------------------------------

**Hosting note:** Free plans and service limits change. Treat free
hosting as a development/demo starting point, not a guarantee of
always-on production availability. Confirm current provider limits,
pricing, sleep behaviour, storage, backups, and connection limits before
launch.

------------------------------------------------------------------------

# 3. Scope and Functional Requirements

## 3.1 Dashboard

The dashboard is the application's financial overview.

It should show: - Total balance across active accounts. - Total income
for the selected period. - Total expenses for the selected period. - Net
cash flow for the selected period. - Savings progress. - Budget usage
and remaining budget. - Expense breakdown by category. - Recent
transactions. - Upcoming recurring transactions. - Outstanding money
lent and borrowed, shown separately from income and expenses.

Dashboard filters: - This month. - Previous month. - This year. - Custom
date range.

The dashboard must not count transfers as income or expenses. It must
also avoid treating debt proceeds, debt repayments, or virtual savings
allocations as ordinary income or expenses.

## 3.2 Transactions

Supported transaction types: 1. Income 2. Expense 3. Transfer

Transaction fields should include: - Amount. - Transaction date and
optional time. - Type. - Source account. - Destination account, for
transfers. - Category and optional subcategory, where applicable. -
Description or note. - Merchant or payee, optional. - Created/updated
timestamps. - Optional source reference, such as recurring transaction
or CSV import batch.

Required operations: - Create, view, edit, and delete transactions. -
Search by description or merchant. - Filter by date range, type,
account, and category. - Sort and paginate results. - View account
transaction history. - Validate account ownership and transaction rules.

Amounts must be stored as positive decimal values. Transaction type
determines the financial direction. Never use floating-point types for
money.

## 3.3 Accounts

Initial account types: - Cash. - Bank account. - Digital wallet. -
Savings account.

Account fields: - Name. - Account type. - Opening balance. - Current
balance, derived or maintained consistently. - Currency, fixed to PKR in
the first release. - Optional institution/provider label. -
Active/archived status. - Created/updated timestamps.

Required operations: - Create and edit accounts. - View account details
and transaction history. - Archive accounts without deleting historical
activity. - Transfer money between accounts. - Prevent transfers to the
same account. - Ensure transfers reduce the source and increase the
destination by the same amount.

Decide and document whether balances are calculated from the opening
balance plus ledger entries or maintained as cached values. The
transaction ledger remains the source of truth. If cached balances are
used, update them transactionally and provide reconciliation tests.

## 3.4 Categories and subcategories

Support: - Default categories. - User-created categories. - Separate
income and expense categories. - Parent categories and subcategories. -
Category colour/icon metadata, if useful for the interface. - Archive
rather than hard-delete when a category has historical usage.

Example expense categories: - Food. - Transport. - Housing. -
Utilities. - Shopping. - Health. - Education. - Entertainment. -
Subscriptions. - Other.

Example income categories: - Salary. - Freelance. - Business. - Gifts. -
Other income.

Transfers should not require an income or expense category.

## 3.5 Budgets

Support: - Overall monthly budget. - Category-specific monthly
budgets. - Budget amount. - Month and year. - Amount spent. - Amount
remaining. - Percentage used. - Progress indicator. - In-app alerts at
configurable thresholds.

Initial default alert thresholds: - 80% of budget used. - 100% of budget
used.

Budget calculations must include eligible expenses only. Transfers,
savings allocations, lending, and borrowing must not inflate ordinary
spending.

A budget should have a unique constraint for its owner, period, and
category (with a clearly defined representation for an overall budget).

## 3.6 CSV imports

CSV import workflow: 1. Upload a CSV file. 2. Select the account to
which the statement belongs. 3. Preview the file. 4. Map source columns
to Raqam fields. 5. Configure date and amount formats if required. 6.
Interpret debit/credit or signed amount columns. 7. Validate rows. 8.
Detect likely duplicates. 9. Allow the user to review and exclude
invalid or duplicate rows. 10. Confirm the import. 11. Create approved
transactions. 12. Keep an import history and result summary.

Import requirements: - Do not commit transactions merely because a file
was uploaded. - Use staging records so preview and confirmation are
separate operations. - Preserve useful source-row information for
troubleshooting. - Enforce file size and row-count limits. - Validate
file content rather than trusting its extension. - Do not execute
formulas or macros; CSV is plain text, but exported spreadsheet files
should guard against formula injection. - Make confirmation idempotent
so retrying a request does not import the same batch twice. - Provide a
clear summary of imported, skipped, duplicate, and invalid rows.

Duplicate detection must not rely only on date and amount. Use a
normalized fingerprint built from appropriate available fields, such as
account, date, amount, direction, normalized description, and source
reference. Treat it as a likely-duplicate signal and allow review where
ambiguity exists.

## 3.7 Analytics and reports

Initial reports: - Income versus expenses. - Daily, weekly, monthly, and
yearly summaries. - Spending by category. - Spending by account. -
Savings trend. - Monthly comparisons. - Budget versus actual spending. -
Transaction history for a selected period.

Reports must consistently exclude transfers from income/expense totals
and correctly classify debt and savings activity.

## 3.8 Recurring transactions

Examples: - Salary. - Rent. - Internet bill. - Subscriptions. - Regular
allowances.

Fields: - Name/description. - Type. - Amount. - Account. - Category, if
applicable. - Frequency. - Start date. - Optional end date. - Next
occurrence date. - Active/paused status. - Last generated occurrence or
idempotency marker.

Initial frequencies: - Daily. - Weekly. - Monthly.

Requirements: - Show upcoming recurring transactions. - Allow pause,
resume, edit, and cancel. - Generate due transactions safely. - Prevent
duplicate generation if a scheduled job runs more than once. - Define
how month-end dates are handled (for example, a monthly recurrence on
the 31st). - Do not silently generate historical transactions after long
downtime without a defined catch-up policy.

## 3.9 Savings goals

Fields: - Goal name. - Target amount. - Current saved amount or
contribution total. - Optional target date. - Status. - Notes. -
Contributions.

Requirements: - Create, edit, archive, and view goals. - Add and reverse
contributions. - Show progress and remaining amount. - Show contribution
history.

**Accounting rule:** A goal is initially a planning/allocation feature.
A contribution to a virtual goal is not an expense and does not itself
move money between bank accounts. If the user transfers money into a
separate savings account, record that as an account transfer. Do not
count the same money movement twice.

## 3.10 Money lent and borrowed

Track money lent to others and money borrowed from others.

Debt/receivable record fields: - Direction: lent or borrowed. - Person
or counterparty. - Original amount. - Date. - Optional due date. -
Notes. - Status. - Outstanding balance.

Repayment fields: - Related debt record. - Amount. - Date. - Account
involved. - Notes/reference.

Requirements: - Record partial and full repayments. - Show outstanding
balances. - Show due and overdue items. - Preserve repayment history. -
Validate that repayments do not exceed the outstanding amount unless an
explicit overpayment workflow is designed.

**Accounting rule:** - Money lent reduces available cash but creates a
receivable. It is not an ordinary expense. - Money borrowed increases
available cash but creates a liability. It is not ordinary income. -
Repayments reduce the receivable or liability. They must not be
double-counted as income or expenses. - Account movements and debt
records must be linked so a repayment cannot be recorded twice.

## 3.11 Notifications

Initial notifications: - Budget reached 80%. - Budget reached 100%. -
Recurring transaction upcoming. - Debt repayment due or overdue. -
Savings goal milestone, if implemented without excessive complexity.

Start with in-app notifications. Email or push notifications can be
considered later.

Allow users to configure thresholds and disable notification types.
Avoid generating duplicate notifications for the same event.

## 3.12 Exports

Supported export formats: - CSV. - Excel (XLSX). - PDF.

Initial exportable data: - Transactions. - Account history. - Budget
summaries. - Selected reports.

Requirements: - Respect date filters and selected accounts/categories. -
Use clear headings and currency formatting. - Prevent spreadsheet
formula injection in CSV/XLSX output. - Ensure exported information
belongs to the authenticated user. - Avoid exposing internal IDs unless
needed.

## 3.13 Backup and restore

Backup and restore are operational capabilities, not ordinary financial
records.

Requirements: - Provide a documented way to create a database backup. -
Store backups outside the live database. - Protect backups with access
controls and encryption at rest where supported. - Define retention and
deletion policies. - Test restoration periodically. - Verify backup
integrity before relying on it. - Require explicit confirmation for
restore operations. - Keep restore operations out of an ordinary public
API unless a carefully secured operator workflow is implemented.

A downloadable CSV export is useful but is not a complete database
backup. It does not preserve all application configuration,
relationships, authentication state, or import history.

## 3.14 Interface and accessibility

-   Responsive layout for desktop, tablet, and mobile.
-   Dark and light themes.
-   Clear empty, loading, validation, and error states.
-   Accessible labels and keyboard navigation.
-   Consistent date, number, and PKR currency formatting.
-   Confirm destructive actions.
-   Avoid overly dense dashboard layouts.
-   Make transaction entry fast and predictable.

------------------------------------------------------------------------

# 4. Business Rules and Financial Integrity

These rules are central to the application. A visually polished tracker
with incorrect balances is just a colourful spreadsheet with trust
issues.

1.  Store money using `numeric/decimal`, never `float` or `double`.
2.  Store amounts as positive values; use transaction type to express
    direction.
3.  Transfers are neither income nor expenses.
4.  Every account, category, transaction, budget, import, goal, debt,
    and notification must be scoped to the authenticated owner.
5.  Never trust a client-supplied user ID for ownership.
6.  Use database transactions for multi-record financial operations.
7.  Use optimistic concurrency or another explicit strategy to prevent
    conflicting edits.
8.  Use UTC for persisted timestamps; convert to the user's local
    timezone for display. A date-only transaction date should remain a
    date, not shift unexpectedly due to timezone conversion.
9.  Keep historical records when accounts or categories are archived.
10. Validate that source and destination accounts are distinct and
    belong to the owner.
11. Prevent duplicate recurring transaction generation.
12. Make import confirmation idempotent.
13. Avoid double-counting debt and savings activity.
14. Add database constraints and indexes in addition to application
    validation.
15. Log security-relevant events without logging passwords, tokens, or
    unnecessary financial details.
16. Use migrations and test them against a disposable/local database
    before applying them to hosted data.

------------------------------------------------------------------------

# 5. Technical Architecture

## 5.1 Architecture choice

Use a **layered modular monolith**.

The application has one deployable ASP.NET Core API and one PostgreSQL
database, with clear internal boundaries. This provides separation of
concerns without the operational overhead of microservices.

Do not split the MVP into microservices. There is no current scaling or
team-ownership requirement that justifies distributed transactions,
service discovery, message brokers, and extra deployments.

## 5.2 Technology stack

### Frontend

-   React.
-   TypeScript.
-   Vite.
-   Tailwind CSS.
-   React Router.
-   TanStack Query for server state.
-   React Hook Form for forms.
-   Zod for client-side schema validation.
-   Recharts for charts.
-   A small, consistent component system.

### Backend

-   ASP.NET Core Web API on .NET 10.
-   C#.
-   Entity Framework Core.
-   Npgsql PostgreSQL provider.
-   ASP.NET Core Identity.
-   TOTP authenticator-app two-factor authentication.
-   Recovery codes.
-   FluentValidation or equivalent application-level validation.
-   Swagger/OpenAPI for development and API documentation.

### Database and hosting

-   PostgreSQL.
-   Neon for hosted PostgreSQL.
-   Render for the Dockerized API.
-   Vercel for the frontend.
-   GitHub for source control and CI/CD.

### File/report libraries

Evaluate and pin supported versions when implementation begins: -
CsvHelper for CSV parsing. - ClosedXML for Excel generation. - QuestPDF
for PDF generation, after reviewing its current licensing terms and
deployment requirements.

Do not install every package at the beginning. Add dependencies when a
phase needs them.

## 5.3 Repository structure

Recommended structure:

``` text
Raqam/
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
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   └── deployment.md
├── docker-compose.yml
├── .gitignore
└── README.md
```

### Project responsibilities

**Raqam.Domain** - Core entities. - Enums. - Value objects. - Domain
rules. - No dependency on EF Core, HTTP, or UI.

**Raqam.Application** - Use cases and application services. - DTOs and
request/response contracts. - Validation. - Interfaces/abstractions for
persistence and external services. - Business orchestration.

**Raqam.Infrastructure** - EF Core DbContext and entity
configurations. - PostgreSQL persistence. - ASP.NET Core Identity
persistence. - Repository implementations only where useful. -
CSV/report infrastructure and other external integrations.

**Raqam.Api** - Controllers or minimal API endpoints (choose one
consistent approach; the initial project can use controllers). -
Authentication and authorization configuration. - Dependency injection
composition root. - Middleware, exception handling, OpenAPI. - API
request/response mapping.

**Frontend** - Pages and layouts. - Reusable UI components. - API
client. - Feature-based modules. - Form schemas. - Authentication
state. - Charts and reports.

## 5.4 Dependency direction

Expected dependency direction:

``` text
Raqam.Api ───────────────► Raqam.Application
    │                            ▲
    └────► Raqam.Infrastructure ─┘

Raqam.Application ───────► Raqam.Domain
Raqam.Infrastructure ────► Raqam.Application
Raqam.Infrastructure ────► Raqam.Domain
```

The Domain project should remain independent. Application contains use
cases. Infrastructure implements technical details. API is the entry
point.

------------------------------------------------------------------------

# 6. Database Design

Use PostgreSQL with UUID primary keys and `numeric(18,2)` for monetary
values. Configure all relationships, delete behaviours, indexes, and
constraints explicitly.

## 6.1 Authentication tables

Use ASP.NET Core Identity rather than creating a custom password table.

Identity will manage user accounts, password hashes, login tokens, roles
if needed, authenticator keys, and recovery codes through its supported
model.

Configure user IDs as UUID/GUID. Even though the app is initially
personal and single-user, all financial records should still carry an
owner ID. This prevents accidental cross-account access and keeps the
data model extensible.

## 6.2 Application tables

### Accounts

Suggested fields: - Id (UUID). - UserId (UUID). - Name. - AccountType. -
OpeningBalance (`numeric(18,2)`). - CurrencyCode (`PKR` initially). -
InstitutionName (nullable). - IsArchived. - CreatedAtUtc. -
UpdatedAtUtc.

### Categories

Suggested fields: - Id. - UserId. - Name. - Type (Income or Expense). -
ParentCategoryId (nullable, self-reference). - Colour (nullable). - Icon
(nullable). - IsArchived. - CreatedAtUtc. - UpdatedAtUtc.

### Transactions

Suggested fields: - Id. - UserId. - Type (Income, Expense, Transfer). -
Amount (`numeric(18,2)`). - TransactionDate. - SourceAccountId. -
DestinationAccountId (nullable; required for transfer). - CategoryId
(nullable for transfer). - Description. - Merchant (nullable). -
RecurringTransactionId (nullable). - ImportBatchId (nullable). -
ExternalReference (nullable). - CreatedAtUtc. - UpdatedAtUtc. -
Concurrency token/version if appropriate.

Rules: - Income: one account, income category. - Expense: one account,
expense category. - Transfer: source and destination accounts; no
income/expense category. - Transfer source and destination must
differ. - Validate account and category ownership.

### Budgets

Suggested fields: - Id. - UserId. - CategoryId (nullable for overall
budget). - Amount (`numeric(18,2)`). - Month. - Year. - CreatedAtUtc. -
UpdatedAtUtc.

### RecurringTransactions

Suggested fields: - Id. - UserId. - Name. - Type. - Amount. -
AccountId. - CategoryId (nullable where valid). - Frequency. -
StartDate. - EndDate (nullable). - NextOccurrenceDate. -
LastGeneratedOccurrence (nullable). - IsActive. - CreatedAtUtc. -
UpdatedAtUtc.

### SavingsGoals

Suggested fields: - Id. - UserId. - Name. - TargetAmount. - TargetDate
(nullable). - Notes (nullable). - Status. - CreatedAtUtc. -
UpdatedAtUtc.

### SavingsContributions

Suggested fields: - Id. - UserId. - SavingsGoalId. - Amount. -
ContributionDate. - Notes (nullable). - Optional linked
transfer/transaction reference if a real account movement is
represented. - CreatedAtUtc.

### Debts

Suggested fields: - Id. - UserId. - Direction (Lent or Borrowed). -
PersonName. - OriginalAmount. - TransactionDate. - DueDate (nullable). -
Notes (nullable). - Status. - CreatedAtUtc. - UpdatedAtUtc.

### DebtRepayments

Suggested fields: - Id. - UserId. - DebtId. - Amount. - RepaymentDate. -
AccountId. - LinkedTransactionId or equivalent movement reference. -
Notes (nullable). - CreatedAtUtc.

### ImportBatches

Suggested fields: - Id. - UserId. - AccountId. - OriginalFileName. -
FileHash. - Status (Uploaded, Previewed, Confirmed, Failed,
Cancelled). - TotalRows. - ImportedRows. - DuplicateRows. -
InvalidRows. - CreatedAtUtc. - ConfirmedAtUtc (nullable).

### ImportRows

Suggested fields: - Id. - ImportBatchId. - RowNumber. - RawRowData or
normalized source fields. - ParsedDate. - ParsedAmount. -
ParsedDirection. - ParsedDescription. - DuplicateFingerprint. -
ValidationStatus. - ValidationMessage. - CreatedTransactionId
(nullable).

### Notifications

Suggested fields: - Id. - UserId. - Type. - Title. - Message. -
RelatedEntityId (nullable). - IsRead. - CreatedAtUtc. - ReadAtUtc
(nullable). - DeduplicationKey.

### NotificationPreferences

Suggested fields: - Id. - UserId. - NotificationType. - IsEnabled. -
ThresholdValue (nullable). - CreatedAtUtc. - UpdatedAtUtc.

## 6.3 Database constraints and indexes

Add: - Foreign keys for all relationships. - Appropriate
cascade/restrict behaviours; do not cascade-delete financial history
casually. - Positive amount constraints. - Valid transaction-type
constraints. - Unique budget constraint for owner + period + category
(including an unambiguous overall-budget rule). - Unique or idempotency
constraints for recurring occurrences. - Unique notification
deduplication keys where appropriate. - Indexes on UserId,
TransactionDate, AccountId, CategoryId, ImportBatchId, and common filter
combinations. - Check constraints for transfer source/destination rules
where feasible.

Avoid overusing generic JSON columns for core financial data. JSON is
useful for preserving source CSV row details or flexible import
metadata, not as a substitute for a well-defined schema.

## 6.4 Balance and reporting strategy

Choose one canonical approach and test it thoroughly:

**Preferred initial approach:** calculate account balances from opening
balance and ledger movements, then optimize with a cached balance only
if measured performance requires it.

For a given account: - Income increases balance. - Expense decreases
balance. - Transfer out decreases balance. - Transfer in increases
balance. - Lending decreases cash balance but creates a receivable. -
Borrowing increases cash balance but creates a liability. - Repayments
move cash and reduce the corresponding receivable/liability.

A debt or savings record must not independently change account balance
unless it represents a real linked account movement. Avoid double-entry
through both a special record and a normal transaction without a clear
linkage and exclusion rule.

------------------------------------------------------------------------

# 7. API Design

Base route: `/api/v1`

Use consistent HTTP status codes, validation responses, pagination, and
error shapes. All endpoints returning or changing personal data must
enforce authenticated ownership.

## 7.1 Authentication

Potential endpoints: - `POST /auth/register` (optional; can be disabled
for a private single-user deployment). - `POST /auth/login`. -
`POST /auth/two-factor/verify`. - `POST /auth/logout`. -
`POST /auth/two-factor/enable`. - `POST /auth/two-factor/disable`. -
`POST /auth/two-factor/recovery-codes`. - `GET /auth/me`.

Use ASP.NET Core Identity. Decide between secure cookie authentication
and JWT based on the frontend/API deployment setup. For a browser-only
app, secure HttpOnly cookies are worth considering, but cross-origin
deployment requires deliberate CORS, SameSite, Secure, CSRF, and domain
configuration. Do not store long-lived access tokens in localStorage.

## 7.2 Dashboard

-   `GET /dashboard/summary?from=&to=`
-   `GET /dashboard/recent-transactions`
-   `GET /dashboard/budget-overview`

## 7.3 Accounts

-   `GET /accounts`
-   `POST /accounts`
-   `GET /accounts/{id}`
-   `PUT /accounts/{id}`
-   `POST /accounts/{id}/archive`
-   `GET /accounts/{id}/transactions`
-   `GET /accounts/{id}/balance`

Transfers should be created through the transaction workflow or a
dedicated transfer endpoint that uses the same domain rules.

## 7.4 Categories

-   `GET /categories`
-   `POST /categories`
-   `GET /categories/{id}`
-   `PUT /categories/{id}`
-   `POST /categories/{id}/archive`

## 7.5 Transactions

-   `GET /transactions`
-   `POST /transactions`
-   `GET /transactions/{id}`
-   `PUT /transactions/{id}`
-   `DELETE /transactions/{id}`

Support query parameters for date range, type, account, category, search
text, sort, page, and page size.

## 7.6 Budgets

-   `GET /budgets`
-   `POST /budgets`
-   `PUT /budgets/{id}`
-   `DELETE /budgets/{id}`
-   `GET /budgets/{id}/progress`

## 7.7 Imports

-   `POST /imports/preview`
-   `GET /imports`
-   `GET /imports/{id}`
-   `POST /imports/{id}/confirm`
-   `POST /imports/{id}/cancel`

Preview and confirm must be separate. Confirmation must be idempotent
and owner-checked.

## 7.8 Recurring transactions

-   `GET /recurring-transactions`
-   `POST /recurring-transactions`
-   `GET /recurring-transactions/{id}`
-   `PUT /recurring-transactions/{id}`
-   `POST /recurring-transactions/{id}/pause`
-   `POST /recurring-transactions/{id}/resume`
-   `POST /recurring-transactions/{id}/cancel`

## 7.9 Savings goals

-   `GET /savings-goals`
-   `POST /savings-goals`
-   `GET /savings-goals/{id}`
-   `PUT /savings-goals/{id}`
-   `POST /savings-goals/{id}/contributions`
-   `GET /savings-goals/{id}/contributions`

## 7.10 Debts

-   `GET /debts`
-   `POST /debts`
-   `GET /debts/{id}`
-   `PUT /debts/{id}`
-   `POST /debts/{id}/repayments`
-   `GET /debts/{id}/repayments`

## 7.11 Notifications

-   `GET /notifications`
-   `POST /notifications/{id}/read`
-   `POST /notifications/read-all`
-   `GET /notification-preferences`
-   `PUT /notification-preferences`

## 7.12 Reports and exports

-   `GET /reports/cash-flow`
-   `GET /reports/category-breakdown`
-   `GET /reports/monthly-summary`
-   `GET /reports/budget-performance`
-   `GET /exports/transactions?format=csv|xlsx|pdf`
-   `GET /exports/report?type=&format=`

## 7.13 Backups

Backups should initially be handled by provider backup facilities and
documented operator procedures. If an application-level backup interface
is later added, it must be strongly restricted, audited, and designed
separately from normal CRUD APIs. Do not expose an unrestricted restore
endpoint.

------------------------------------------------------------------------

# 8. Security and Privacy

Financial information is sensitive. Security is a baseline requirement,
not a final sprint decoration.

## 8.1 Authentication and account protection

-   ASP.NET Core Identity password hashing.
-   Strong password policy appropriate to a private finance application.
-   Authenticator-app TOTP.
-   Recovery codes stored/managed using Identity's supported mechanisms.
-   Rate limiting on login and 2FA endpoints.
-   Lockout or progressive delay for repeated failed attempts.
-   Secure logout and session invalidation.
-   Avoid exposing whether an email address exists where that would
    create account enumeration risk.

## 8.2 Authorization

-   Require authentication for all financial endpoints.
-   Derive UserId from the authenticated principal.
-   Never accept ownership solely from request payloads.
-   Apply ownership checks to reads, updates, deletes, exports, and file
    imports.
-   Test attempts to access another user's resource by changing IDs.

## 8.3 Web/API security

-   HTTPS only in hosted environments.
-   Explicit CORS allowlist for the production frontend.
-   Secure, HttpOnly, appropriately configured cookies if cookie auth is
    selected.
-   CSRF protection where cookie-based cross-site requests require it.
-   Input validation and output encoding.
-   Rate limiting.
-   Safe error handling; no stack traces in production.
-   Secrets in environment variables or a secret manager, never in Git.
-   Dependency updates and vulnerability checks.
-   Restrict upload size and validate CSV content.
-   Protect exports against spreadsheet formula injection.
-   Avoid logging passwords, authentication tokens, or unnecessary
    personal financial details.

## 8.4 Data protection

-   TLS in transit.
-   Provider-managed encryption at rest where available.
-   Encrypted and access-controlled backups.
-   Defined backup retention.
-   Tested restoration process.
-   Document account deletion and data export behaviour.
-   Keep development/test data separate from real financial data.

------------------------------------------------------------------------

# 9. Deployment Architecture

## 9.1 Proposed hosting

``` text
User's browser
     |
     v
Vercel
React + TypeScript frontend
     |
     | HTTPS API requests
     v
Render
Dockerized ASP.NET Core API
     |
     | TLS PostgreSQL connection
     v
Neon
Hosted PostgreSQL database
```

GitHub stores the source code and acts as the deployment source.

## 9.2 Frontend: Vercel

-   Deploy the React/Vite application from GitHub.
-   Configure the production API base URL as an environment variable.
-   Configure preview deployments separately.
-   Do not put database credentials or private API secrets in frontend
    environment variables.
-   Configure SPA fallback/rewrite behaviour if required by the chosen
    router.
-   Set the exact frontend origin in backend CORS configuration.

## 9.3 Backend: Render

Render will host the ASP.NET Core API as a Docker-based web service.

Requirements: - Add a production Dockerfile. - Bind Kestrel to the port
provided by the hosting environment. - Read configuration from
environment variables. - Use a health-check endpoint such as
`/health`. - Configure the Neon connection string as a secret
environment variable. - Configure allowed frontend origins. - Do not
bake secrets into the Docker image. - Apply database migrations through
a controlled deployment/release step, not blindly on every application
startup in a multi-instance production environment. - Configure
structured logs and production exception handling.

**Free-tier caveat:** A free service may sleep after inactivity, causing
cold starts. Verify current Render limits and whether a paid always-on
service is needed before relying on it for everyday access.

## 9.4 Database: Neon

-   Create a PostgreSQL project and database.
-   Use the provider's recommended connection string.
-   Keep credentials private.
-   Use TLS.
-   Use a separate development database/branch where practical.
-   Check connection limits and pooling guidance.
-   Configure backups/restore options and understand plan-specific
    retention.
-   Avoid running migrations from multiple API instances simultaneously.

**Free-tier caveat:** Verify current compute suspension, storage,
transfer, backup, and connection limits. A suspended database or
exhausted quota can affect availability.

## 9.5 Local development

The developer already has: - macOS 13.7.8 on a 2017 Intel MacBook Pro. -
.NET SDK 10.0.402. - PostgreSQL 17.10. - Podman 5.8.5. - Node.js 22.13.0
and npm 10.9.2 from the previously reported setup.

Do not reinstall these tools unless a compatibility check demonstrates a
need.

Local development options: 1. Run API, frontend, and PostgreSQL directly
on the Mac. 2. Use Podman Compose for PostgreSQL and optionally
containerized application services.

Prefer the simplest repeatable setup. Since Podman is already part of
the developer's learning/workflow, a local PostgreSQL container is a
reasonable option, but the application should not depend on
Podman-specific runtime behaviour.

Keep local `.env` files out of Git. Commit `.env.example` with
placeholder values only.

## 9.6 Environments

Maintain clear separation: - Local development. - Preview/staging. -
Production.

Do not point local development or preview deployments at the production
database. Use separate connection strings, secrets, and allowed origins.

## 9.7 Deployment checklist

Before production: - \[ \] Production frontend URL configured. - \[ \]
Production API URL configured. - \[ \] HTTPS working. - \[ \] CORS
restricted to intended origins. - \[ \] Database connection secured. -
\[ \] Secrets stored outside source control. - \[ \] Health endpoint
configured. - \[ \] Migrations reviewed and applied. - \[ \] Backup
policy documented. - \[ \] Restore process tested. - \[ \] Logging and
error handling configured. - \[ \] Authentication and 2FA tested. - \[
\] Owner isolation tested. - \[ \] CSV upload limits and validation
tested. - \[ \] No development credentials or sample data remain. - \[
\] Provider free-tier limitations reviewed.

------------------------------------------------------------------------

# 10. Testing Strategy

Testing should be added alongside features, not postponed until the end.

## 10.1 Backend tests

-   Domain unit tests for transaction rules.
-   Application service tests.
-   API integration tests.
-   PostgreSQL integration tests for constraints and queries.
-   Authentication and authorization tests.
-   Import parsing and duplicate detection tests.
-   Recurrence/idempotency tests.
-   Report calculation tests.
-   Migration tests.

## 10.2 Financial correctness scenarios

At minimum, verify: 1. Income increases the selected account balance. 2.
Expense decreases the selected account balance. 3. Transfer decreases
one account and increases another. 4. Transfer does not appear as income
or expense. 5. Editing a transaction correctly updates balances and
reports. 6. Deleting a transaction correctly reverses its effect. 7.
Lending is not counted as spending. 8. Borrowing is not counted as
income. 9. Repayment reduces the correct debt balance. 10. Savings goal
contribution does not double-count an account movement. 11. CSV
confirmation cannot create the same batch twice. 12. Recurring
generation cannot create the same occurrence twice. 13. A user cannot
access another user's account or transaction. 14. Budget progress
includes only eligible expenses.

## 10.3 Frontend tests

-   Component tests for forms and important UI states.
-   API error handling.
-   Authentication flows.
-   Transaction create/edit flows.
-   Responsive layout checks.
-   Theme persistence.
-   Import preview and confirmation UX.

## 10.4 End-to-end tests

Test the main journey: - Sign in. - Set up accounts. - Create
categories. - Add income and expense. - Make a transfer. - Set a
budget. - Import a CSV. - Review dashboard and reports. - Export data.

------------------------------------------------------------------------

# 11. Delivery Roadmap and Phases

Build in small, verifiable phases. Each phase should end with a working
result and a test/verification checkpoint.

## Phase 0 --- Repository and development environment

Tasks: - Confirm the current project folder and existing files before
changing anything. - Create the Raqam repository structure. - Create the
.NET solution and four projects. - Add project references in the correct
direction. - Create the React + TypeScript + Vite frontend. - Add
Tailwind CSS. - Add `.gitignore` and `.env.example`. - Confirm API and
frontend both run locally. - Add a basic README.

Exit criteria: - Solution builds. - API starts. - Frontend starts. - No
secrets are committed. - Repository structure is understood.

## Phase 1 --- Architecture foundation

Tasks: - Configure dependency injection. - Configure EF Core and
PostgreSQL. - Add environment-based configuration. - Add global
exception handling. - Add request validation. - Add OpenAPI/Swagger for
development. - Add health endpoint. - Establish logging. - Add initial
database migration.

Exit criteria: - API can connect to local PostgreSQL. - Health endpoint
responds. - Migrations apply cleanly. - A basic integration test passes.

## Phase 2 --- Authentication and security

Tasks: - Configure ASP.NET Core Identity. - Configure UUID user IDs. -
Implement login/logout. - Implement TOTP 2FA and recovery codes. -
Configure authorization policies. - Decide cookie versus JWT
architecture. - Configure CORS and CSRF strategy. - Add rate limiting. -
Add owner-scoping infrastructure.

Exit criteria: - User can authenticate. - 2FA works. - Protected
endpoints reject anonymous requests. - Ownership tests pass.

## Phase 3 --- Core financial domain and database

Tasks: - Implement Accounts. - Implement Categories and subcategories. -
Implement Transactions. - Implement Income, Expense, and Transfer domain
rules. - Implement balance calculation. - Add indexes, constraints, and
migrations. - Add domain and integration tests.

Exit criteria: - Accounts and categories can be managed. - Income,
expenses, and transfers work. - Balances reconcile. - Transfers are
excluded from income/expense totals.

## Phase 4 --- Core frontend

Tasks: - Build application shell and navigation. - Build sign-in and 2FA
screens. - Build dashboard layout. - Build account management. - Build
category management. - Build transaction list, filters, and forms. - Add
responsive and dark/light themes. - Add loading, empty, and error
states.

Exit criteria: - User can complete core financial tasks through the
browser. - UI works on desktop and mobile widths. - API validation
errors are shown clearly.

## Phase 5 --- Budgets and dashboard analytics

Tasks: - Implement overall and category budgets. - Implement budget
progress calculations. - Implement threshold notifications. - Implement
dashboard summaries. - Implement income/expense and category charts. -
Add period filters and monthly comparisons.

Exit criteria: - Budget calculations are accurate. - Dashboard totals
reconcile with transactions. - Transfers and debt/savings activity are
correctly excluded.

## Phase 6 --- CSV import

Tasks: - Build upload endpoint and UI. - Parse CSV safely. - Implement
column mapping. - Implement preview/staging. - Implement validation and
duplicate detection. - Implement user review and confirmation. -
Implement import history and summaries. - Add idempotency and file
limits.

Exit criteria: - A sample statement can be previewed and reviewed. -
Invalid rows are explained. - Duplicate rows are identified. -
Confirmation creates only approved transactions. - Retrying confirmation
does not duplicate records.

## Phase 7 --- Recurring transactions

Tasks: - Implement recurrence model. - Implement due-transaction
generation. - Define monthly edge cases. - Add pause/resume/cancel. -
Add idempotency protection. - Add upcoming list and notification
integration.

Exit criteria: - Due transactions generate correctly. - Re-running the
generator does not duplicate occurrences. - Paused/cancelled schedules
do not generate transactions.

## Phase 8 --- Savings goals and debts

Tasks: - Implement savings goals and contributions. - Implement
lent/borrowed records. - Implement repayments. - Link actual account
movements. - Add outstanding-balance calculations. - Add relevant
dashboard summaries.

Exit criteria: - Goals and debt balances are accurate. - No double
counting occurs. - Partial and full repayments work.

## Phase 9 --- Reports, exports, and notifications

Tasks: - Implement reports. - Implement CSV export. - Implement Excel
export. - Implement PDF export. - Complete in-app notifications. - Add
notification preferences. - Test spreadsheet formula-injection
protection.

Exit criteria: - Reports reconcile with source data. - Exports respect
filters and owner boundaries. - Notifications are deduplicated.

## Phase 10 --- Deployment and production hardening

Tasks: - Create production Dockerfile. - Deploy API to Render. -
Provision Neon PostgreSQL. - Deploy frontend to Vercel. - Configure
secrets and CORS. - Configure health checks and logs. - Apply production
migrations. - Configure backups. - Test restore procedure. - Run
security and end-to-end tests. - Review provider pricing and free-tier
limitations.

Exit criteria: - Production app is accessible over HTTPS. -
Authentication, 2FA, and core flows work. - Database backup and
restoration are verified. - No secrets are exposed. - Critical financial
correctness tests pass.

## Phase 11 --- Post-MVP improvements

Potential future work: - Multiple currencies. - PDF/Excel statement
imports. - Receipt attachments. - Financial calendar. - AI-assisted
categorization or insights. - Automated bank integrations where legally
and technically supported. - Multi-user or household support. - Native
mobile application. - More advanced forecasting and savings analysis.

------------------------------------------------------------------------

# 12. MVP Release Definition

The MVP should be considered complete when a user can:

1.  Sign in securely with 2FA.
2.  Create and manage cash, bank, and wallet accounts.
3.  Create categories and subcategories.
4.  Record income, expenses, and transfers.
5.  See accurate balances.
6.  View a dashboard and recent transactions.
7.  Set monthly budgets and see progress.
8.  Import a CSV statement through preview and confirmation.
9.  Review basic income/expense and category reports.
10. Export transaction data.
11. Use the app on mobile and desktop.
12. Use dark and light themes.
13. Recover from a database backup using a tested procedure.

Savings goals, debts, recurring transactions, PDF/Excel exports, and
more advanced notifications are approved product scope, but they can
follow the first usable release if implementation time needs to be
controlled. The roadmap above keeps them planned rather than quietly
forgotten.

------------------------------------------------------------------------

# 13. Development Workflow and Working Agreement

The project should be built as a learning-friendly engineering exercise,
not generated as a giant block of unexplained boilerplate.

Working rules: - Work in small steps, usually one or two terminal
commands at a time. - Explain what each command does and why it is
needed. - Ask for command output before proceeding when the next step
depends on it. - Inspect the existing folder before creating, deleting,
or restructuring files. - Do not overwrite an existing project without
checking its contents. - Diagnose errors before proposing broad
changes. - Avoid unnecessary package installations. - Prefer TypeScript
for frontend code. - Use C# for the backend. - Use PostgreSQL as the
database. - Use Podman where containers are useful; do not assume Docker
Desktop is installed. - Keep the architecture modular but avoid
premature microservices. - Add tests for financial rules as features are
implemented. - Keep development, preview, and production configuration
separate. - Never commit secrets or real financial data. - Use Git
commits at meaningful milestones. - Keep README and architecture notes
current. - Do not run destructive database commands against
production. - Do not run migrations automatically in every production
API instance. - Explain trade-offs when selecting libraries or hosting
services.

## 13.1 Suggested Git milestones

Examples: - `chore: initialize Raqam solution structure` -
`chore: configure frontend tooling` -
`feat: add identity authentication` - `feat: add account management` -
`feat: add transaction domain` - `feat: support account transfers` -
`feat: add monthly budgets` - `feat: add CSV import preview` -
`feat: add recurring transactions` -
`feat: add savings goals and debt tracking` -
`feat: add reports and exports` - `chore: prepare production deployment`

------------------------------------------------------------------------

# 14. Initial Setup Notes

The developer's previously reported local environment: - MacBook Pro
2017, Intel. - macOS 13.7.8. - .NET SDK 10.0.402. - Node.js 22.13.0. -
npm 10.9.2. - PostgreSQL 17.10. - Podman 5.8.5.

Versions may have changed; verify with commands before relying on them.
Do not reinstall working tools without a reason.

**Important first action:** Before creating the new Raqam structure,
inspect the current `ExpenseTracker` directory and any solution/projects
already created. Earlier setup may have started under the name
`ExpenseTracker`. Preserve useful work and migrate it deliberately
rather than deleting it.

Suggested initial inspection commands, run from the parent directory
where the project is located:

``` bash
pwd
ls -la
```

Then, if the project folder exists:

``` bash
find ExpenseTracker -maxdepth 3 -type f | sort
```

Review the output before deciding whether to rename, restructure, or
continue in place.

------------------------------------------------------------------------

# 15. Risks and Mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Incorrect account balances          Ledger-first design, decimal
                                      values, domain tests,
                                      reconciliation

  Transfers counted as                Dedicated transfer type and report
  spending/income                     exclusions

  Debt double-counted                 Link debt movements to account
                                      transactions and exclude from
                                      ordinary totals

  CSV duplicates                      Staging, fingerprints, review,
                                      idempotent confirmation

  Duplicate recurring transactions    Unique occurrence/idempotency key
                                      and transactional generation

  Lost financial data                 Provider backups, independent
                                      exports, tested restore procedure

  Free hosting sleeps or suspends     Understand plan limits; upgrade if
                                      reliable availability is required

  Exposed secrets                     Environment variables/secret
                                      manager, `.gitignore`, secret
                                      scanning

  Cross-origin authentication issues  Decide cookie/JWT strategy early;
                                      configure CORS, CSRF, SameSite,
                                      Secure

  Scope creep                         Keep deferred features out of MVP
                                      delivery gates

  Overengineering                     Modular monolith; introduce extra
                                      infrastructure only when justified

  Provider pricing changes            Recheck current pricing and limits
                                      before production launch
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 16. Open Technical Decisions

These decisions should be made at the relevant implementation phase
rather than guessed prematurely:

1.  **Authentication transport:** secure HttpOnly cookie versus JWT. For
    a browser-only application, evaluate cookie auth carefully,
    especially because Vercel and Render may use different domains.
2.  **Public registration:** likely disabled or restricted for a
    personal single-user app.
3.  **Balance implementation:** calculate from ledger initially; add
    cached balances only if needed.
4.  **Recurring scheduler:** select a reliable hosted scheduling
    mechanism or a small controlled background worker. Do not assume a
    sleeping free web service will run scheduled work on time.
5.  **Backup method:** choose provider backups, scheduled logical
    backups, or both based on the selected plans.
6.  **PDF generation:** verify current QuestPDF licensing and deployment
    requirements before adoption.
7.  **Email delivery:** decide whether account recovery or alerts
    require a transactional email provider.
8.  **Production domain:** select a custom domain only when ready; it is
    not required for local development.

------------------------------------------------------------------------

# 17. Final Product Summary

**Raqam** is a PKR-first personal finance tracker built with React,
TypeScript, ASP.NET Core, and PostgreSQL.

It will begin as a responsive single-user web app, with: - Manual and
CSV transaction tracking. - Multiple accounts. - Income, expenses, and
transfers. - Categories and budgets. - Dashboard and reports. -
Recurring transactions. - Savings goals. - Lent/borrowed money
tracking. - In-app notifications. - CSV, Excel, and PDF exports. -
Backup and restore procedures. - Secure login and authenticator-app 2FA.

The planned deployment is: - **Vercel:** frontend. - **Render:**
Dockerized ASP.NET Core API. - **Neon:** PostgreSQL. - **GitHub:**
source control and deployment integration.

The implementation will proceed in small phases, beginning by inspecting
the existing project folder and preserving any useful work. Financial
correctness, data ownership, security, and a reliable restore process
take priority over adding visual polish or speculative features.

**Guiding principle:** Build a trustworthy financial ledger first. The
dashboard, charts, budgets, and insights are only useful when the
underlying numbers are right.
