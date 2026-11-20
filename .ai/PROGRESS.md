# PROGRESS.md — Session log

Reverse chronological. Record what actually happened; never rewrite earlier
entries.

## 2026-11-20 — Session 7 (continued): User confirmations

User reported (no output pasted): 2FA works with a real authenticator app; the budgets page works in the browser. Recorded in
`TASKS.md`. Correction: the user also said `dotnet test` passed, but the next output they shared was a
compile error in `DashboardTests.cs`; the fix was committed twice (the first did not land on the device,
caught by reading the file back). The backend test run is therefore unverified. M4 stays `[~]`: edit/delete, filter/search, phone-width and recovery-code checks are not yet
reported. The user is committing M4 fixes, M5 Parts 1–3 on a branch to merge into main.

## 2026-11-20 — Session 7 (continued): Budgets page written

User ran `dotnet test` on the dashboard backend, which first failed to compile on a missing `using` in
`DashboardTests.cs` (my omission, fixed); no passing output pasted yet.

M5 Part 3 written: `features/budgets/` (API hooks, `BudgetsPage`, `BudgetFormDialog`, month helpers),
`/budgets` route and a sidebar link, and the transaction mutations now also refresh budget queries.
Checked in the AI's workspace only: 305 frontend tests, lint and build clean, axe clean in light and
dark for the list, both dialogs and the delete confirmation, no overflow at 390 and 768 px. The month
is in the address (`?month=2026-11`); alerts are computed from the server's status (D053), with no
notification inbox. Needs the user: `npm test`, `npm run lint`, `npm run build`, and a look in the
browser.

**Next:** Part 4, the dashboard analytics (period filter, income/expense/net with change, category and
monthly charts, budget alerts).

## 2026-11-20 — Session 7 (continued): Budgets confirmed, dashboard backend written

User reported the budgets migration applied and "everything working" after one test compile error
(my mistake: `SqlStateAsync` and `WithDbAsync` are on `TestDatabase`, not `TestApiClient`; fixed). No
test output was pasted after the fix, so M5 Part 1 is recorded as user-reported.

M5 Part 2 written, not compiled: `GET /dashboard/summary` (period, previous period of equal length,
expense by top-level category) and `GET /dashboard/monthly` (N calendar months, zero-filled), service,
validators, controller, a monthly-totals aggregate on `ITransactionRepository`, and `DashboardTests`
(previous-period window edges, subcategory rollup, transfers excluded, archived category, other users,
agreement with the transaction list, validation, year boundary). Decision D054. No migration.
Needs the user: `dotnet test`.

**Next:** Part 3, the Budgets page (frontend).

## 2026-11-20 — Session 7 (continued): M5 opened, budgets backend written

User said the rest is being tested on their side and to move to the next phase. Done first:
README and `docs/architecture.md` now describe the frontend, the no-overdraft rule (D049) and the
no-future-date rule (D051); `npm install` is needed for `uqr`. M4 stays `[~]` (browser
walkthrough open); M5 is `[~]`. `TASKS.md` is now the M5 checklist; the M4 one is kept as
`TASKS-M4.md` with the open items listed.

M5 Part 1 (budgets backend) written, not compiled: `Budget`, `BudgetProgress` (80% and 100%),
service, repository, controller, an expense-by-category aggregate, the entity configuration with
a `NULLS NOT DISTINCT` unique index and check constraints, and tests (domain, API, database
constraints). Decisions in D053, including a scope reduction: alerts are shown as status, with
no stored notification inbox. Needs the user: `dotnet ef migrations add AddBudgets`, `dotnet ef
database update`, `dotnet test` (commands in `TASKS.md`). The test client's cleanup now deletes
budgets before categories, so run the migration before any test run.

**Next:** user runs the migration and `dotnet test`; then Part 2 (dashboard summary and monthly
endpoints) and the frontend parts.

## 2026-11-20 — Session 7 (continued): Test results, no future dates, 2FA screen

User ran `dotnet test` and `npm test`, `npm run lint`, `npm run build` and shared the output: backend
159 of 159 passed (this includes the D049 no-overdraft tests), frontend 19 files / 246 tests
passed, lint 0 and 0, build OK.

Then asked for 2FA to be in scope and for future-dated transactions to be blocked, and said to
move on while they test.
- **Future dates (D051).** Server rule in `Transaction.Apply` (UTC today + 1 day), form limit and
  message, 3 domain tests, 3 API tests (`FutureDateTests`), 2 frontend tests. Backend not run yet.
- **2FA screen (D052).** `/security` page: turn on with QR and key, code check, recovery codes
  shown once, turn off with confirmation; `uqr` added for the QR. 10 tests; axe clean; QR decoded
  back to the exact link in a real browser. Frontend: 259 tests in the AI's workspace.

**Next:** user runs `npm install` (new dependency), `dotnet test`, `npm test`, and tries 2FA with
a real authenticator app, then signs out and in with a code and with a recovery code.

## 2026-11-20 — Session 7 (continued): Part 8 walkthrough feedback, no-overdraft, month filter

User ran `npm install`, build, lint and test and shared the output: install up to date, build OK
(chunk over 500 kB warning only), lint 0 warnings and 0 errors, vitest 18 files / 219 tests all
passed. Walkthrough, as the user reported it: sign-in works but 2FA was never enabled or
exercised (there is no 2FA setup screen, deferred in D043); creating accounts and categories
works; income, expense and transfer work. Edit, delete, filter and search, a visible API
validation error and phone width were not reported.

New requirements from the user, done:
- **No negative balances (D049).** Backend `BalanceGuard`, opening balance >= 0, new
  `OverdraftTests`, and updated existing tests that relied on overdraft. Frontend: account form
  rejects a negative opening balance; transaction form shows the available balance and blocks a
  larger expense or transfer. **Backend is not compiled or run yet.**
- **Month filter and date limits (D050).** Default 1st of this month to today; From/To cannot be
  in the future; today is highlighted more.
Frontend: 246 tests pass in the AI's workspace; tsc, lint and build clean.

**Next:** user runs `dotnet test` and `npm test` and shares the output; decide on the 2FA screen,
on blocking future-dated transactions, and on when to do debts (M8) relative to M5.

## 2026-11-20 — Session 7 (continued): Part 7 quality pass

User said to continue. Built the app and ran axe-core in headless Chromium against stubbed API
responses: every page and dialog in light and dark, then every page in its loading, empty and
server-error state, then widths 390 / 768 / 1024 / 1440, theme persistence across a reload,
and keyboard use. Found and fixed six things (D048): focus was lost to the page top when a
dialog closed; at tablet width the transactions table hid Amount and the row buttons; a hidden
table header made the page scroll sideways; sign-in's brand panel was outside a landmark;
loading placeholders were not announced; the account page had no title when it failed.
After the fixes axe reports nothing in any of those runs. Added 4 tests (focus restore: opened
by a button, by a confirm, mounted open with an autofocus field, opener removed; plus a heading
assertion).
219 tests pass in the AI's scratch workspace; tsc, lint and build are clean. Not run on the
user's machine, no real API call from the UI yet, and no screen reader was used.

**Next:** Part 8 needs the user: `npm install`, then `npm run build && npm run lint && npm test`
and `npm run dev` with the API running, sign in, and go through the walkthrough in TASKS.
Their output is what ticks Parts 2 to 7 and lets M4 close.

## 2026-11-20 — Session 7 (continued): Part 6 written, dashboard layout

User said to continue. Checked the backend first: there is no totals or reports endpoint, and
the checklist says layout only, so the dashboard uses what exists: account balances and the
transaction list. Written: total balance card, accounts list, the latest 8 transactions, a
quick "New transaction" button, and a section-by-section loading, empty and error state. The
total is summed in whole paise and left out (with a note) if any balance failed to load,
rather than showing a partial figure. Two helpers were shared with the transactions page
(row text, signed amount). Recorded as D047.
215 tests pass in the AI's scratch workspace (11 new); tsc, lint and build are clean;
screenshots in light, dark and phone width reviewed. Not run on the user's machine, and no
real API call from the UI yet.

**Next:** the user runs `npm test` and `npm run dev` and looks at the dashboard with real data.
Then Part 7 (quality pass: loading/empty/error states, responsive and accessibility checks,
theme persistence) and Part 8 (verification and close-out), which need the user's real output.

## 2026-11-20 — Session 7 (continued): Part 5 written, transactions screens

User said to move on. Read the real controller, validators, service, domain rules and the
repository's search before writing, so the form follows the API: income and expense need a
matching category, a transfer needs two different accounts and no category, a new transaction
may not use an archived account or category but an existing one may keep it, and the list
filters are from, to, type, account, category, search, sort and page.

Written: transactions list with filters, sort and paging kept in the address; create and edit
dialog with type-dependent fields, "Save and add another", last-used account remembered, and
`400` and `409` handling; delete with confirmation; helpers for filter parsing and category
options; tests. Screenshots showed the phone layout hiding the row buttons and filling the
screen with filters, so the mobile columns were reworked and the filters fold behind a button;
table cells now use less side padding on small screens (also affects the accounts tables).
204 tests pass in the AI's scratch workspace (42 new this part); tsc, lint and build are clean;
screenshots in light, dark and phone width reviewed. Not run on the user's machine, and no
real API call from the UI yet. Recorded as D046.

**Next:** the user runs `npm test` and `npm run dev` and records a few real transactions
(an expense, an income, a transfer), then checks the account balances; then Part 6 (dashboard).

## 2026-11-20 — Session 7 (continued): Part 4 written, categories screens; accounts 409 fix

User said to move on. Read the real category contracts, validators, service, domain rules and
the exception handler before writing. Found that the API answers a duplicate name with 409,
the same status as a stale version, with no code to tell them apart, and that account names
are unique too. That showed a bug in the Part 3 accounts dialog: a duplicate name on an edit
would have offered "Load latest", which replaces what was typed, and its test had used an
invented 400. Both fixed with one shared check (refetch and compare the version), recorded
in D045 as a correction to D044.

Written: categories tree with an Expenses/Income switch, create and edit dialog (colour
swatches, parent choice, subcategory with fixed parent), archive confirmation that warns
about subcategories, the tree helper, and tests. 162 tests pass in the AI's scratch workspace
(23 new, plus 2 changed in accounts); tsc, lint and build are clean; screenshots in light,
dark and phone width reviewed. Not run on the user's machine, and no real API call from the
UI yet.

**Next:** the user runs `npm test` and `npm run dev` and tries accounts and categories against
the real API; then Part 5 (transactions).

## 2026-11-20 — Session 7 (continued): Part 3 written, accounts screens

User said to move on after the navbar and toast change. Read the real account contracts
(controller, request and response records, validators, service, balance, the 409 body)
before writing the screens. Written: accounts list with balances, create and edit dialog
with 409 "Load latest" recovery, archive with confirmation, account detail with balance
breakdown and paged history, plus shared `Select` and `Pagination` and the transaction
types. Recorded as D044. 139 tests pass in the AI's scratch workspace (19 new); tsc, lint
and build are clean; screenshots of list, detail, form in light, dark and phone width were
reviewed, which found and fixed clipped columns on a phone. Not run on the user's machine
yet, and no real API call has been made from the UI.

**Next:** the user runs `npm install`, `npm test` and `npm run dev` and looks at the
accounts pages against the real API; then Part 4 (categories).

## 2026-11-20 — Session 7 (continued): navbar and dynaura toasts

User asked for toasts from `dynaura` and the theme toggle in a navbar (laptop and mobile).
Checked that `dynaura` exists on npm (Dynamic Island style toasts, React supported, zero
dependencies) and read its documentation before using it. `ToastProvider` now mounts its
`Toaster` and `notify` calls `dynaura.success`, `.error` or `.info`; theme colours are CSS
variables. The shell gained a top navbar (theme toggle, email, Sign out); the sidebar is
navigation only; the mobile top bar carries the toggle. Recorded as D042 amendment 2.
Scratch checks pass again (120 tests, lint, build); screenshots reviewed. Not yet run on the
user's machine.

## 2026-11-20 — Session 7 (continued): Part 2 written, authentication screens

**Read first:** the real auth controllers and contracts. Sign-in answers 200 with
`succeeded`, `requiresTwoFactor` and `lockedOut` even for a wrong password; the 2FA routes
are `verify` and `recovery-code`. Recorded in D043.

**Written (frontend/raqam-web/src):** `features/auth/` (`auth-api`, `session`, `RequireAuth`,
`AuthLayout`, `SignInPage` with password, authenticator-code and recovery-code steps),
global 401 handling in `lib/query-client.ts`, routes in `App.tsx`, sign-out and the signed-in
email in the shell, test helpers `test/api-mock.ts` and `test/render-app.tsx`, and 19 new tests
(guard, sign-in outcomes, 2FA, sign-out, 401). `App.test.tsx` now signs a user in first.

**Checked in the AI's scratch workspace:** typecheck, lint, build, and 120 tests (in three
timezones). Screenshots reviewed for sign-in (light, dark, mobile), the code step and the
signed-in shell. Not yet run on the user's machine, and never against the real API.

**Deferred:** the 2FA setup and disable screen (D043).

**Not done:** the user's `npm test`, and a real sign-in with `npm run dev` and the API on
the https profile.

**Next:** user verifies sign-in for real; then Part 3 (accounts).

## 2026-11-20 — Session 7: Part 1 verified; brand pass written (D042)

**Verified by the user:** `npm run build`, `npm run lint` and `npm test` all passed on
their machine after the Radix install. Part 1 items ticked in `TASKS.md`.

**Design request:** the user did not like the look and asked for brand consistency and
better light and dark modes. Recorded as D042: lapis and gold palette as CSS variables with
semantic Tailwind names (no `dark:` variants in components), a lapis sidebar in both themes
with a gold current-page marker, IBM Plex Sans with tabular figures, the Arabic wordmark
رقم in Reem Kufi, flat outlined cards, shadows only on overlays, a new favicon.

**What changed (frontend/raqam-web):** `src/index.css` (tokens, fonts, focus ring, `num`
utility), `src/components/layout/` (new `Wordmark`, `AppShell`, `PageHeader`,
`NotFoundPage`), `ThemeToggle`, and the UI kit (`Button`, `Input`, `Card`, `Badge`, `Table`,
`Spinner`, `EmptyState`, `ErrorState`, `FormField`, `Dialog`, `ConfirmDialog`,
`DateField`, `ToastProvider`), `public/favicon.svg`, `package.json` (two font packages).

**Checked in the AI's scratch workspace:** typecheck, lint, production build and all 101
tests pass; screenshots reviewed in light, dark, mobile, dialog and calendar states. All
text pairs meet 4.5:1. Not yet run on the user's machine.

**Icons (same session):** the user asked for icons on buttons. Added `lucide-react`; nav
items, menu button, theme toggle, calendar, toast dismiss and Try again now have icons, and a
new `IconButton` is ready for row actions. Scratch checks pass again (101 tests, build, lint).

**Not done:** the user's `npm install`, `npm test` and a browser look at the new design;
Parts 2-8.

**Next:** adjust the design if the user wants changes, then Part 2 (sign-in, 2FA, guard).

## 2026-11-11 — Session 6 (continued): M4 Part 1 foundation written

**What was written (frontend/raqam-web):** Vite proxy and Vitest config, `@` alias,
`.env.example` → `/api/v1`, theme bootstrap in `index.html`; `src/lib` (API client with
lazy CSRF and one retry, `ApiError` mapping, PKR money helpers, dayjs date helpers per
D041, theme, query client); UI kit in `src/components/ui` (Radix dialog, alert dialog,
popover; date field with typed input and calendar); theme provider and toggle; app shell
with sidebar, mobile menu and skip link; placeholder pages; routes. 49 files, with tests.

**Verification so far:** pushed through the bridge and re-read back, 49/49 byte-identical.
In the AI's own scratch workspace: typecheck, lint, production build and 101 Vitest tests
passed (also under 5 timezones). Not yet run on the user's machine.

**Found:** the real recovery-code route is `/two-factor/recovery-code`; the README had
`redeem-recovery-code`. Fixed. README "Run the frontend" now covers the https profile,
proxy, `.env.local` and test scripts.

**Not done:** user's `npm run build`, `npm run lint`, `npm test` output; a browser check
of the shell, theme and proxy/cookie flow; Parts 2–8.

**Next:** user installs the Radix packages (done per the user) and runs the checks; then
Part 2 (sign-in, 2FA, guard).

## 2026-11-11 — Session 6 (continued): date format decision (D041)

The user answered the D040 check-in with one change: use dayjs, and show dates as
`18 May 2026` everywhere. Recorded as D041 (appended, D040 left as written). Reading
taken: display format only; the API and URL parameters keep `YYYY-MM-DD`. Because the
native date input cannot show that format, date fields become a button with a calendar
popover (`react-day-picker`); flagged to the user as an added dependency. D040 is
otherwise treated as accepted. `TASKS.md` Part 0 and Part 1 updated; the install
command gained `dayjs` and `react-day-picker`.

**Not done:** still no frontend code; dependencies not yet installed.

## 2026-11-11 — Session 6 (continued): M4 opened

**Discussed with the user (recommended option unless noted):** dev API access through
the Vite proxy (D037); Radix UI primitives + Tailwind for components (D038, the user
chose this over the recommended hand-built set); Vitest + Testing Library in M4 (D039).
The AI also set frontend conventions (D040: feature folders, TanStack Query, RHF + Zod,
money as strings, dates as `YYYY-MM-DD`, theme via system/toggle, confirmed destructive
actions, dashboard layout only) and asked the user to confirm or change them.

**What was written:** D037–D040 in `DECISIONS.md`; `TASKS.md` replaced with the M4
checklist (Parts 0–8); `ROADMAP.md` M4 `[~]`; `CONTEXT.md` state line.

**Found while reading:** the README says the recovery-code route is
`/two-factor/redeem-recovery-code`, but the OpenAPI document lists
`POST /api/v1/auth/two-factor/recovery-code`. One is wrong; added to Part 2 to confirm
against the controller and fix. The frontend `.env.example` still points at
`http://localhost:5196/api/v1`; it changes with Part 1 (D037).

**Not done:** no frontend code yet; dependencies not installed.

**Next:** the user confirms D040 (or changes it); then Part 1 — the user installs the
dependencies and the AI writes the proxy config, API client, helpers, theme, shell and
base components.

## 2026-11-11 — Session 6 (continued): M3 closed

**Verification (user-run, output shared):** `dotnet test` on `Raqam.Api.Tests`: 55
passed, 0 failed ("Test Run Successful"); with the earlier 139-test run (117 passed
+ 22 rate-limit failures, now fixed) that puts `Raqam.Domain.Tests` at 84 passing.
`/openapi/v1.json` lists every M3 endpoint (accounts incl. `/transactions` and
`/balance`, categories, transactions) alongside auth and 2FA. Earlier in the session:
`scripts/m3-smoke.sh` 56 passed, 0 failed over HTTPS; migration applied to dev and to
an empty scratch database.

**What was written:** Part 6 ticked with test names against each exit criterion;
Part 4 OpenAPI item and Part 3 multi-record item ticked (the only multi-record change
is the parent-category archive, one `SaveChangesAsync`); README (status, test
projects, HTTPS profile, accounts / categories / transactions section with a curl
walkthrough and rules); `docs/architecture.md` (all four projects, M3 cross-cutting
pieces); `CONTEXT.md` state refreshed (it still described session 2); `BLOCKERS.md`
known bugs line; `ROADMAP.md` M3 `[x]` with evidence and current-milestone text.

**Not done / caveats:** the README curl walkthrough is written from the contracts and
the verified smoke script but was not run line by line. The `dotnet test` counts for
the Domain project are derived, not read from output. The M4 checklist is not drafted;
M4 is not opened. Optional: `DROP DATABASE raqam_scratch;` as `postgres` (not reported
back).

**Next:** discuss M4 (core frontend) decisions with the user, record them, then replace
`TASKS.md` with the M4 checklist.

## 2026-11-11 — Session 6 (continued): Part 5 tests green

**What happened:** user created `Raqam.Domain.Tests` and ran `dotnet test`: 117 passed,
22 failed. Every failure was `429 Too Many Requests` in `InitializeAsync`: xUnit creates
a new class instance per test, so each test signed in again and passed the login limit
(5 a minute, D019). My earlier assumption that `InitializeAsync` ran once per class was
wrong. Fix: `Program.cs` reads `RateLimiting:LoginPermitLimit` (default 5, so production
is unchanged); `ApiFactory` (in `TestApiClient.cs`) sets it to 100000 and is the fixture
for `OwnershipTests`, `BalanceTests`, `RulesAndConcurrencyTests` and
`DatabaseConstraintTests`; `RateLimitingTests` still uses the default factory. All six
files pushed and verified with `cmp`.

**Verification:** user re-ran `dotnet test` and reported "success" (green; counts not
shared). Part 5 ticked on that basis, and the Part 3 ownership item (covered by
`OwnershipTests`).

**Not done:** OpenAPI review (Part 4); Part 3 item on multi-record changes in one
transaction (parent-category archive cascades to children; not yet confirmed);
Part 6 walkthrough; Part 7 docs and closing M3.

**Next:** Part 6 (map the exit criteria to the smoke test and tests by name, review
`/openapi/v1.json`), then Part 7.

## 2026-11-11 — Session 6 (continued): Part 5 tests written (unbuilt)

**What was written:**
- `Raqam.Domain.Tests` (new project, files only): `MoneyRulesTests`, `AccountTests`,
  `CategoryTests`, `TransactionTests`. Every transaction rule has a passing and a failing
  case: the three shapes, matching category type, destination rules, same-account
  transfer, amount (zero, negative, 3 decimals, beyond `numeric(18,2)`, boundaries),
  same-owner "not found" messages, archived references (new vs already attached), update
  incl. type change and a failed update leaving the entity unchanged, text limits, and
  `SignedEffectOn` for income, expense and both ends of a transfer.
- `Raqam.Api.Tests`: `TestApiClient` (throwaway signed-in user with cookie and CSRF
  token, typed helpers, cleanup in FK-safe order, `SqlStateAsync`); `OwnershipTests`
  (Alice and Bob: 404 for every operation on accounts, categories and transactions,
  cross-user references in transactions rejected, lists and filters never leak, a
  payload `userId` is ignored and the stored owner is the caller);
  `BalanceTests` (SQL balance equals `Σ SignedEffectOn` for 3 accounts across 12
  transactions at 6 `asOf` dates incl. components and the transfers-net-to-zero
  invariant; ledger totals exclude transfers; edit/type-change/move/delete update the
  balance; archived account keeps history); `RulesAndConcurrencyTests` (401 when
  anonymous, stale-version 409 for accounts, transactions and categories, duplicate
  names 409, invalid amounts and 11 rule violations 400, 404 for missing references,
  subcategory rules and archive cascade, literal `%` and `_` search, parent-category
  filter includes children, type/date/sort/paging, invalid list queries 400);
  `DatabaseConstraintTests` (check constraints for amount, type and shape; same-owner
  foreign keys for account, category and parent; Restrict on delete; unique names for
  accounts and categories incl. NULLS NOT DISTINCT; `xmin` changes on update).

**Verification:** none yet; the AI workspace cannot compile or run tests.

**Not done:** creating the `Raqam.Domain.Tests` project and building; the run; OpenAPI
review; Part 6 (exit-criteria walkthrough) and Part 7 (docs).

**Next:** user creates the project (commands in TASKS Part 5), runs `dotnet build` and
`dotnet test`, shares output; fix any failures; tick Part 5.

## 2026-11-11 — Session 6 (continued): smoke test 56/56; Part 4 verified

**What changed:** after restarting the API with the explicit `ILIKE` escape, the user
re-ran `scripts/m3-smoke.sh`: **56 passed, 0 failed** (reported as a count; the full
output was not shared). That includes the literal-`%` search, description and
merchant search, and the categories section (create, duplicate 409, subcategory
rules, stale-version 409, archive cascade). Part 4 controller items and the
`api/v1` / CSRF / 409 item are ticked. The exact cause of the earlier empty `%` search
was never isolated; the explicit escape character fixed it.

**Not done:** OpenAPI document review; Part 5 tests (domain unit tests, DB
constraint tests, cross-user ownership, SQL balance vs `SignedEffectOn`, ledger
totals excluding transfers); Part 6/7.

**Next:** Part 5.

## 2026-11-11 — Session 6 (continued): first smoke run 43/44; search escape fixed

**What happened:** the user ran `scripts/m3-smoke.sh` against the running API:
**43 passed, 1 failed**. Passing: login and CSRF flow, 401 when anonymous, account
create / duplicate 409 / validation 400, stale-version 409 on accounts and
transactions, income / expense / transfer creation, every rule rejection, 404 for
unknown ids, balances (Cash 1149.50, Bank 6700, `asOf` 849.50 and 7000, and after
edit and delete 1100 and 1300), history, type / date / account filters, sort,
paging, bad page size and date range, archive behaviour.

**Failure:** `search=%` (a literal percent sign, scoped to the Cash account) returned
0 rows; the expense has the merchant "Cafe 50%", so 1 was expected. Cause not
confirmed. Likely suspect: the implicit `ILIKE` escape. Change: `TransactionRepository`
now passes the escape character explicitly (`ILike(..., pattern, "\\")`, i.e.
`ESCAPE '\'`). The script also got two checks that tell the cases apart
(`search=lunch` for description, `search=CAFE` for merchant and case-insensitivity),
and a categories section: create, duplicate 409, subcategory under a parent, wrong
type 400, a third level 400, stale-version 409, and archive cascade.

**Verification:** the 43 passes are user output. The fix and the new checks are
pushed, **not run**.

**Not done:** the re-run; OpenAPI review; Part 5 tests.

**Next:** user restarts the API and re-runs the script; if the `%` check still fails
the new description / merchant lines show whether search itself or the escape is at
fault.

## 2026-11-11 — Session 6 (continued): controllers build; smoke script written

**What changed:** the user reported the build with the three controllers as
successful (no output shared). Wrote `scripts/m3-smoke.sh`: it logs in as the seeded
user over HTTPS (the cookies are `Secure`, so `https://localhost:7271` with
`curl -k`), fetches the CSRF token again after login, then checks ~50 things:
401 when anonymous; seeded categories; create/duplicate/validation on accounts;
409 on a stale account and transaction version; income, expense and transfer
creation; the type rules (zero and 3-decimal amounts, wrong category type,
transfer to the same account, transfer with a category, unknown account/transaction
-> 400/404); balances including `asOf`; account history, filters, a literal-`%`
search, sort and paging; edit, delete and the balance following them; archive.
It leaves two archived accounts in the dev database per run (accounts are never
deleted, D029).

**Verification:** syntax-checked with `bash -n` only; **not run**. Part 4 items stay
unticked until the user runs it and shares the output.

**Not done:** the smoke run; OpenAPI review; cross-user (404) check, which needs a
second user and belongs in the Part 5 tests; totals-excluding-transfers check
(no endpoint yet, M5), also Part 5.

**Next:** user starts the API with `--launch-profile https` and runs the script;
then Part 5 tests.

## 2026-11-11 — Session 6 (continued): slice 2 built; Part 4 controllers written

**What changed:** the user reported `dotnet build` and `dotnet test` as "success"
for slice 2 (no counts shared), so Part 3 compiles and is wired. Ticked the
Part 3 items that are about code existing (contracts, validators, use cases,
balance, totals); the ownership and rule behaviour still needs Part 5 tests.
The fresh-database migration check was also finished (see below).

Wrote Part 4: `AccountsController` (list, create, get, update, archive,
`/transactions` history, `/balance?asOf=`), `CategoriesController` (list with
`includeArchived` and `type`, create, get, update, archive) and
`TransactionsController` (list with filters, create, get, update, delete), all
under `api/v1`, thin wrappers over the services. Auth comes from the existing
fallback policy and CSRF from the global filter.

**Verification:** Part 3 build user-reported. Controllers are pushed but
**unbuilt**; no HTTP call has been made yet.

**Not done:** build of the controllers; OpenAPI review; tests (Part 5); curl
walkthrough (Part 6).

**Next:** user builds, then runs a first curl smoke test (login, CSRF token,
create account, create transaction, balance); then Part 5 tests.

## 2026-11-11 — Session 6 (continued): slice 1 built; Part 3 slice 2 written

**What changed:** the user reported the `dotnet add` FluentValidation, build and
test commands as successful (no counts shared), so slice 1 is built. The
fresh-scratch-database migration check failed for environment reasons, not code:
`raqam_dev` cannot create databases (`permission denied to create database`), and
the connection string used the literal placeholder `<your dev password>`
(`28P01`). Re-run with the admin role `postgres` creating the database
`OWNER raqam_dev`: `dotnet ef database update` then applied `InitialCreate`,
`AddIdentity` and `AddCoreFinancialDomain` to the empty database and printed
`Done.` (user output; the one `fail` line is EF's expected first query for the
not-yet-existing `__EFMigrationsHistory` table). Rule 16 is therefore met. The
`\dt` listing and the drop were not reported back.

Wrote slice 2: transaction contracts, validators (new `PositiveAmount` rule),
`ITransactionRepository`, `TransactionService` (list with filters, sort and
paging; account history; get; create; update with version; hard delete),
`LedgerService` (account balance with optional `asOf`; income/expense totals
excluding transfers), and `TransactionRepository` (owner-scoped; balance and
totals are one aggregate query each). Registered in `Program.cs` and
`DependencyInjection.cs`. Recorded D036.

**Verification:** slice 1 user-confirmed. Slice 2 is pushed but **unbuilt**; the AI
workspace cannot compile.

**Not done:** build of slice 2; controllers (Part 4); tests (Part 5), including
the check that the SQL balance agrees with `Transaction.SignedEffectOn`.

**Next:** user runs `dotnet build Raqam.sln` and `dotnet test`; then Part 4
controllers.

## 2026-11-11 — Session 6 (continued): Part 2 verified; Part 3 slice 1 written

**What changed:** the user re-ran the build and `dotnet test` (7/7 passing,
user-reported) and the `psql` check: 10 Expense and 5 Income categories, and
`SELECT xmin FROM "Accounts"` ran without error (0 rows, no accounts yet). Part 2
is therefore verified, except the fresh-database migration check (rule 16),
which stays open. Recorded D033 (composite-key same-owner enforcement), D034
(advisory lock for seeding), D035 (Application layer structure).

Started Part 3 with accounts and categories: `NotFoundException`,
`ConflictException`, `IUnitOfWork`, `MoneyValidation`; per feature the request
and response records, FluentValidation validators, a repository interface and a
service; Infrastructure repositories and `UnitOfWork` (translates concurrency
and unique-index failures to 409); registration in `Program.cs` and
`DependencyInjection.cs`; string enums in JSON; 404 and 409 mapping in
`GlobalExceptionHandler`.

**Verification:** Part 2 items are user-confirmed via shared output. Part 3
files are pushed but **unbuilt**; the AI workspace cannot compile.

**Not done:** adding the `FluentValidation` package to `Raqam.Application`
(user command); building; transaction use cases, balance, ledger totals;
controllers (Part 4); tests (Part 5).

**Next:** user adds the package and builds; then Part 3 slice 2 (transactions).

## 2026-11-11 — Session 6 (continued): first test run found a seeder race; fixed

**What happened:** the user applied the migration (the seeder queried the new
tables without error, so it applied) and ran `dotnet test`: 4 of 7 passed, 3
(`CsrfTests`, `TwoFactorTests`, `AuthorizationTests`) failed at host startup with
`40P01: deadlock detected` inside `DatabaseSeeder.SeedDefaultCategoriesAsync`.
Cause: xUnit starts several `WebApplicationFactory` hosts in parallel, each runs
the seeder, and they all inserted the default categories at once. The earlier
`catch (DbUpdateException)` did not help because the non-retrying Npgsql
execution strategy wraps the failure in an `InvalidOperationException`. This was
the race the AI had anticipated but guarded against too narrowly.

**Fix:** category seeding now takes a PostgreSQL advisory lock
(`pg_advisory_lock`) on a connection held open for the check-then-insert, and
releases it afterwards, so only one host seeds and the rest see the categories.
The catch block was removed. Pushed and read back identical (first push did not
land; second did).

**Verification:** the failure and the 4 passing tests are from the user's shared
test output. The fix is not yet built or tested.

**Next:** user rebuilds and re-runs `dotnet test` and the `psql` category check;
then D033 and Part 3.

## 2026-11-11 — Session 6 (continued): migration created and reviewed; seeder written

**What changed:** the user built and ran `dotnet ef migrations add
AddCoreFinancialDomain` (reported success; output not shared). The AI read the
generated migration: tables Accounts, Categories, Transactions with the planned
check constraints, `(UserId, Id)` unique keys, composite foreign keys (all
`Restrict`), unique name indexes, and the owner-scoped indexes. Nothing
unexpected; `xmin` is the row-version marker only. Default category list
confirmed (spec §3.4 examples; the user said "you decide"). `DatabaseSeeder`
now also creates default categories for the configured seed user when that user
has none (D021); it is restricted to that one user so test throwaway users never
get categories (their deletion would fail on the `Restrict` foreign keys).

**Mistake and correction:** the first push of `DatabaseSeeder.cs` left the Mac
with a half-edited copy (it called `SeedDefaultCategoriesAsync`, which was not in
the file) — a different silent-push failure from the usual "old content stays".
Found by comparing byte counts and content on read-back, re-pushed, and
verified identical. Never built in that state.

**Verification:** migration file read and reviewed by the AI; seeder verified
identical on the Mac after the re-push. **Not built** (seeder), **not applied**
(migration), no tests run.

**Not done:** apply the migration to `raqam_dev`; confirm `xmin` works and no
extra column exists; build and start the API to see the seeder create
categories; apply to a fresh database (rule 16); record the composite-key
decision (D033); Parts 3–7.

**Next:** user runs the apply and build commands in the session reply and shares
output; then Part 3 (Application layer).

## 2026-11-11 — Session 6 (continued): Part 1 built; Part 2 EF configuration written

**What changed:** the user ran `dotnet build` and reported success, so the Part 1
domain code compiles (build output itself not shared). Part 1 checkboxes ticked.
Started Part 2: `AccountConfiguration`, `CategoryConfiguration`,
`TransactionConfiguration` (tables, string enums, `numeric(18,2)`, `xmin`
concurrency via `IsRowVersion()`, check constraints for positive amounts, valid
types, and transfer/non-transfer shape; unique account name per owner; unique
category name per owner + parent + type with NULLS NOT DISTINCT; `(UserId,
TransactionDate)` index; all foreign keys `Restrict`) and three `DbSet`s on
`RaqamDbContext`. Same-owner enforcement is a database rule: composite
`(UserId, Id)` alternate keys on Accounts and Categories, referenced by
composite foreign keys from Transactions and from subcategory to parent.

**Verification:** the Part 1 build is user-confirmed. The Part 2 files are
unbuilt and have no migration; the AI cannot compile or run EF here.

**Not done:** build of Part 2; migration `AddCoreFinancialDomain` (created and
reviewed before applying); seeder (waiting on the default category list);
everything in Parts 3–7. Test cleanup note for Part 5: foreign keys to the user
are `Restrict`, so tests that create a throwaway user and data must delete the
data before the user.

**Next:** user builds, creates the migration, shares the output; the AI reviews
the generated migration (no stray `Version` column, constraints present) before
it is applied.

## 2026-11-11 — Session 6 (continued): M3 Part 1 domain code written, unbuilt

**What changed:** wrote the domain layer in `Raqam.Domain`: `Common/`
(`DomainException`, `MoneyRules`, `Guard`), `Accounts/` (`Account`,
`AccountType`), `Categories/` (`Category`, `CategoryType`), `Transactions/`
(`Transaction`, `TransactionType`). Rules enforced in the entities: positive
amounts with at most 2 decimals (D030); income/expense need a category of the
matching type; transfers need a distinct destination and no category; owner
checks on every referenced account and category (cross-user ids give the same
"not found" message as a missing one); newly referenced archived accounts or
categories are rejected (D024); one-level subcategories of the same type
(D028). `GlobalExceptionHandler` now maps `DomainException` to a 400
ProblemDetails. The choices that go beyond the spec are listed in `TASKS.md`
Part 1.

**Verification:** all ten files were pushed to the Mac and read back identical
to what was written. **Not built, not tested**: the AI workspace has no .NET SDK
and cannot reach the installer, so the code has never been compiled.

**Not done:** `dotnet build` on the Mac; Part 1 checkboxes stay unchecked until
it passes; domain unit tests (Part 5); everything in Parts 2–7.

**Next:** user runs `dotnet build backend/Raqam.sln` and shares the output; fix
any compile errors; then Part 2 (EF configuration, migration, seeder).

## 2026-11-11 — Session 6 (continued): remaining M3 Part 0 defaults confirmed

**What changed:** the user confirmed all eight proposed defaults unchanged.
Recorded as D025 (repository-style persistence interfaces), D026 (explicit
owner filters, 404 for others' resources), D027 (`xmin` concurrency, 409 on
stale `PUT`), D028 (one-level subcategories), D029 (transactions hard-deleted;
accounts/categories archived only), D030 (reject extra decimals), D031
(editable opening balance, PKR fixed), D032 (`asOf` balance). `TASKS.md` Part 0
is fully checked; `ROADMAP.md` current-milestone note updated.

**Verification:** documentation only; no code, build, or test.

**Next:** start `TASKS.md` Part 1 (domain entities and rules), then Part 2
(EF configuration and migration), with the user running `dotnet` commands.

## 2026-11-11 — Session 6: M3 opened; Part 0 decisions made, checklist written

**Context:** M2 closed at the end of session 5 with one verification item
(cross-user-id ownership test) carried forward because no owner-scoped entity
existed yet. This session opened M3.

**What changed:**

- Read `ROADMAP.md`, `PROGRESS.md`, `TASKS.md`, `DECISIONS.md`, `BLOCKERS.md`,
  `CONTEXT.md`, `docs/architecture.md`, and spec §3.2–§3.4, §4, §6.2–§6.4,
  §7.3–§7.5, §8.2, §10, §11 Phase 3, §16.
- Discussed four open M3 decisions with the user; all four were answered with
  the recommended option and recorded: D021 (default categories are per-user
  owned rows), D022 (transaction date is a plain date), D023 (transfers are one
  row created through `/transactions`), D024 (negative balances allowed;
  archived accounts/categories reject new activity).
- `TASKS.md` replaced with the M3 checklist (Parts 0–7), including the
  carried-over ownership test. Eight further defaults (persistence access
  pattern, owner-scoping style, `xmin` concurrency, one-level subcategories,
  hard-delete of transactions, decimal-place handling, editable opening balance,
  `asOf` on balance) are listed as **proposed, not yet confirmed**, and are not
  recorded as decisions.
- `ROADMAP.md`: M3 marked `[~]`; "Current milestone" note updated.

**Verification:**

- Nothing in the application changed; no build or test was run. The AI had no
  shell on the Mac this session, so `git status` / `git log` were not checked
  and the repository was not compared with what `.ai/` describes beyond the
  files read.
- Not verified: that the pushed `.ai/` files landed on disk (to be re-staged
  and read back after the push).

**Not done:** confirmation of the proposed defaults; any M3 code.

**Next:** the user confirms or changes the proposed defaults in `TASKS.md`
Part 0; record them as D025+; then start Part 1 (domain entities and rules)
and Part 2 (EF configuration and migration), with the user running `dotnet`
commands.

## 2026-11-11 — Session 5: Identity auth verified; owner-scoping, CSRF, rate limiting, and TOTP 2FA built

**Context:** Continuing M2. Previous session left `AuthController`
(login/logout/me) and the authorization fallback policy written but not yet
run.

**What changed:**

- `AddIdentity` migration created and applied; `AspNetUsers`/`AspNetRoles`/
  etc. confirmed on the Mac via `psql \dt` (8 Identity tables present).
- Seed user created via `DatabaseSeeder` reading `SeedUser:Email`/
  `SeedUser:Password` from user-secrets (public registration stays off, D017).
  One failed attempt hit Identity's password policy (12+ chars, mixed case,
  symbol) — not a bug; user retried with a compliant password.
- Login flow verified end-to-end on the Mac via curl: `POST /auth/login` sets
  the auth cookie, `GET /auth/me` returns the signed-in user using that
  cookie. This also confirms the global fallback authorization policy and the
  cookie auth transport (D016) are working together as intended.
- Owner-scoping infrastructure added: `ICurrentUser` (`Raqam.Application.Common`)
  and its implementation `CurrentUser` (`Raqam.Api.Services`, via
  `IHttpContextAccessor` + `ClaimTypes.NameIdentifier`), registered in
  `Program.cs` (`AddHttpContextAccessor` + `AddScoped<ICurrentUser, CurrentUser>`).
  Build and tests pass (no entities exist yet to call it from — real exercise
  comes in M3 when owner-scoped records are introduced).
- CSRF protection added (D018): ASP.NET Core antiforgery, double-submit header.
  `GET /auth/csrf-token` issues the token; `POST /auth/login` is exempted
  since no session exists yet to validate against. Two problems along the
  way, both fixed: (1) a namespace mistake —
  `AutoValidateAntiforgeryTokenAttribute`/`IgnoreAntiforgeryTokenAttribute`
  are in `Microsoft.AspNetCore.Mvc`, not `.Mvc.ViewFeatures` as first
  guessed; (2) a deeper problem — even with the right namespace,
  `AutoValidateAntiforgeryTokenAttribute` failed at request time
  (`No service for type ...AutoValidateAntiforgeryTokenAuthorizationFilter
  has been registered`) because that attribute needs MVC view-engine DI
  registrations that only `AddControllersWithViews`/`AddMvc` set up, which
  this API-only project (`AddControllers`) doesn't have. Replaced with a
  project-written `CsrfFilter` (`Raqam.Api.Validation`) that calls
  `IAntiforgery.ValidateRequestAsync` directly, and a `[SkipCsrfValidation]`
  marker attribute replacing `[IgnoreAntiforgeryToken]`. Build and tests pass
  after the fix.
- Rate limiting added (D019) on `POST /auth/login`: built-in
  `Microsoft.AspNetCore.RateLimiting`, fixed-window limiter keyed by client
  IP, 5 attempts/minute, `429` beyond that. Build and tests pass.
- Three automated tests added, closing out most of M2 Part 2 verification:
  `AuthorizationTests.Me_WithoutAuthentication_ReturnsUnauthorized` (401),
  `RateLimitingTests.Login_SixthAttemptWithinAMinute_ReturnsTooManyRequests`
  (429, D019), and `CsrfTests` (`Logout_WithoutCsrfToken_IsRejected` /
  `Logout_WithValidCsrfToken_Succeeds`, D018). `CsrfTests` creates and
  deletes its own throwaway user via `UserManager` rather than using the
  real seed credentials, which live only in the user's secrets. Only two
  Part 2 items remain, both genuinely blocked rather than skipped: 2FA
  verification (2FA isn't built) and the cross-user-id test (needs an
  owner-scoped entity from M3).
- TOTP 2FA added (D020), the last deferred M2 Part 1 item: a new
  `TwoFactorController` (`api/v1/auth/two-factor`) with `Status`, `Setup`,
  `Enable`, `Disable`, `Verify`, and `RedeemRecoveryCode`, built entirely on
  Identity's own `UserManager`/`SignInManager` TOTP and recovery-code
  mechanisms (no hand-rolled crypto). `Setup` returns the shared key plus an
  `otpauth://` URI for the frontend to render as a QR code. `Enable` issues 10
  recovery codes. `Verify`/`RedeemRecoveryCode` are `[AllowAnonymous]`,
  `[SkipCsrfValidation]`, and share the `"login"` rate-limit policy (D019),
  since they complete a login rather than acting on an existing session. Six
  new contract records added under `Contracts/Auth/`.
- Two automated tests added in `TwoFactorTests.cs`, closing the remaining
  2FA item in M2 Part 2: `EnableAndDisable_RoundTrip_UpdatesStatus` and
  `Login_WithTwoFactorEnabled_RequiresVerifyToCompleteSignIn` (full login →
  2FA-required → verify → authenticated flow). Both create and delete their
  own throwaway test user via `UserManager`, reimplementing RFC 6238 TOTP
  code generation and RFC 4648 Base32 decoding directly in the test (Identity's
  own `Rfc6238AuthenticationService` is internal). Build and tests pass, all 7
  green. Only one M2 Part 2 item remains, and it's genuinely blocked rather
  than skipped: the cross-user-id test, which needs an owner-scoped entity
  from M3.
- Process note: pushing a file to the Mac via the device bridge repeatedly
  reported success while the old content stayed on disk (silent push
  failure, same class of issue as earlier sessions, but far more frequent
  this session — happened on `Program.cs`, `AuthController.cs`, and
  `.ai/TASKS.md`/`.ai/DECISIONS.md` multiple times each). Standing practice
  going forward: after every push, re-stage the file and read its actual
  content (not just byte count/mtime, which can also look changed without
  the real content landing) before relying on it or telling the user to
  build; retry (plain, then `force: true`) until a content read confirms
  the push actually landed.

**Verification:**

- User-confirmed via shared output: Identity tables exist; seed user created;
  login → `/auth/me` round-trip succeeds with the cookie; `dotnet build` +
  `dotnet test` pass after owner-scoping, after CSRF, after rate limiting,
  and after TOTP 2FA (four separate confirmed build/test cycles, the last
  with all 7 tests green including the two new 2FA tests).

- README updated with an Authentication section: seed-user setup, the
  CSRF/login/me curl flow, and a full 2FA enrollment walkthrough
  (`setup` → authenticator app → `enable` → recovery codes), plus the shared
  login/2FA rate limit. M2 Part 3 documentation is now complete: all of
  D016–D020 were recorded as each decision was made, and this entry closes
  out the session log.
- M2 marked `[x]` in `ROADMAP.md`. The only item from its original
  verification list not actually run — "ownership tests pass" — is recorded
  there as carried forward to M3 rather than outstanding M2 work, since
  there is no owner-scoped entity yet to test against.

**Not done:** nothing further within M2's own scope. M3 has not been
started: `TASKS.md` still holds the M2 checklist and needs replacing with
the M3 checklist (including the carried-forward ownership test) before M3
work begins.

**Next:** open M3 — read spec §11 Phase 3, discuss any open M3 decisions
with the user, and replace `TASKS.md` with the M3 checklist (Accounts,
Categories, Transactions, balance calculation, the ownership test carried
over from M2).

## 2026-11-10 — Session 3: M0 closed, M1 opened

**Context:** The user reported that everything was good on the Mac and that
the project is pushed to GitHub.

**What changed:**

- M0 marked `[x]`; M1 marked `[~]`. `TASKS.md` replaced with the M1 checklist.
- B002 and B003 moved to Resolved.
- No application code changed.

**M0 task summary (archived from `TASKS.md`):** folder inspected; nothing to
migrate from `ExpenseTracker`; solution with four projects and references;
Vite + React + TypeScript + Tailwind frontend; `.gitignore`, `.env.example`,
README; build, API start, frontend build/lint/start verified in the AI
workspace; Mac verification and Git push confirmed by the user.

**Verification:**

- User-confirmed: the M0 checks pass on the Mac; repository pushed to GitHub.
- Verified by the AI: a `.git` directory exists in the project folder.
- Not seen by the AI: command output, tool versions, the commit history, the
  remote URL.

**Later in the same session (M1 started):**

- User ran on the Mac (output shown to the AI): added
  `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 to Infrastructure and
  `Microsoft.EntityFrameworkCore.Design` 10.0.14 to Api, no warnings. The
  output shows .NET SDK 10.0.402 and PostgreSQL 17.10.
- User created the local role and database `raqam_dev` and showed a successful
  connection as `raqam_dev`. The local admin user is `postgres`
  (password-authenticated).
- AI wrote, unbuilt: `Infrastructure/Persistence/RaqamDbContext.cs`,
  `Infrastructure/DependencyInjection.cs` (`AddInfrastructure`),
  `Api/HealthChecks/DatabaseHealthCheck.cs`, and a new `Api/Program.cs` mapping
  `/health`. These could not be compiled in the AI workspace (B004).

- User set the connection string with user-secrets, built, ran the API, and
  showed `curl -i http://localhost:5196/health` returning `200 OK` with body
  `Healthy`. This verifies the AI-written code compiles and reaches the
  database on the Mac. The build output itself was not shown.

**Not done:** confirmation that `PingController` was deleted; initial
migration; exception handling; validation; OpenAPI; logging; test project.

**Next:** install `dotnet-ef` as a local tool, create and apply the initial
migration.

## 2026-11-10 — Session 2: Phase 0 skeleton scaffolded

**Context:** The user confirmed there is nothing to migrate from any earlier
`ExpenseTracker` work and asked to scaffold from scratch and start building
per the plan. The AI had no shell on the developer's Mac, so the skeleton was
generated and checked in the AI's Linux workspace and the files were copied
into the project folder.

**What changed:**

- `backend/Raqam.sln` (classic `.sln` format) with `Raqam.Domain`,
  `Raqam.Application`, `Raqam.Infrastructure`, `Raqam.Api`, all `net10.0`, and
  project references in the specified direction. No NuGet packages.
- `Raqam.Api`: `AddControllers` / `MapControllers`, one placeholder
  `PingController` at `GET /api/v1/ping`, `launchBrowser` turned off.
  Controllers chosen over minimal APIs (D010).
- `frontend/raqam-web`: Vite `react-ts` template (React 19, TypeScript 7,
  Vite 8, oxlint), Tailwind CSS 4 via `@tailwindcss/vite`, starter demo content
  replaced by a placeholder Raqam page.
- Root `.gitignore`, `.env.example`, `README.md`; frontend `.env.example`.
- B001 resolved (user-confirmed). B004 opened (AI workspace limits).

**Verification (AI workspace only: Ubuntu, .NET SDK 10.0.114, Node 22.23.4):**

- Tested: `dotnet build Raqam.sln` — 0 warnings, 0 errors.
- Tested: API started; `GET /api/v1/ping` returned HTTP 200 with
  `{"service":"Raqam.Api","status":"ok"}`.
- Tested: `npm run build` and `npm run lint` clean; dev server returned
  HTTP 200; Tailwind utility classes present in the built CSS.
- Not tested: anything on the developer's Mac (macOS, SDK 10.0.402 reported).
  The page was not viewed in a browser.
- User-confirmed: nothing to migrate from `ExpenseTracker`.

**Not done:** tool-version check on the Mac (B002); `git init` and first
commits (B003); M0 is therefore still in progress. M1 was not started: it needs
NuGet packages and a local PostgreSQL, which the AI workspace cannot reach
(B004).

**Next:** the user runs the "On the developer's Mac" checks in `TASKS.md` and
initializes Git. Once confirmed, close M0 and begin M1 (EF Core + Npgsql,
configuration, exception handling, `/health`, first migration) with the user
running `dotnet` commands locally.

## 2026-11-10 — Session 1: Project memory initialized

**Context:** First AI session on Raqam. The user supplied the baseline project
specification (v1.0, dated 10 November 2026) and asked for the `.ai/`
project-memory system. No prior `.ai/` existed.

**What changed:**

- Read the full specification.
- Inspected the Raqam project folder through the desktop bridge: a recursive
  listing returned no entries. There was no code, solution, frontend, README,
  package manifest, test, or documentation to inspect.
- Created `.ai/` with `PROJECT.md`, `CONTEXT.md`, `ROADMAP.md`, `TASKS.md`,
  `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`.
- Saved an unmodified copy of the specification to
  `docs/raqam-project-specification.md` so future sessions can read the
  authoritative scope from inside the repository.
- Recorded the specification's confirmed decisions as D001–D008, and the
  project-memory layout as D009.

**Verification:**

- Implemented: nothing (no application code written, by instruction).
- Tested: nothing. No build, test, or run command was executed; none exists.
- Verified: the folder listing was empty.
- Not verified: whether `.git` exists (the listing may omit hidden entries);
  the tool versions reported in the specification; the existence or location
  of the earlier `ExpenseTracker` directory.
- User-confirmed: nothing beyond the specification's contents.

**Not done:** every M0 task except the first inspection item. No commands were
run on the user's machine.

**Next:** continue M0 at `TASKS.md` Part 1 — confirm the folder state with
`pwd` / `ls -la`, resolve B001 (`ExpenseTracker`) and B002 (tool versions)
with the user, then scaffold.


## 2026-11-10 — Session 3 (continued): exception handling and OpenAPI written

**Context:** Continuing M1 Part 2 after the initial migration was applied and
verified.

**What changed:**

- AI wrote, unbuilt: `Api/ErrorHandling/GlobalExceptionHandler.cs`
  (`IExceptionHandler` implementation returning ProblemDetails; includes the
  exception detail only when `IHostEnvironment.IsDevelopment()`).
- `Api/Program.cs` updated to register `AddExceptionHandler<GlobalExceptionHandler>()`,
  `AddProblemDetails()`, `UseExceptionHandler()`, and `AddOpenApi()` /
  `MapOpenApi()` (Development only). D012 records the OpenAPI package choice.
- None of this has been built on the Mac yet; `Microsoft.AspNetCore.OpenApi`
  is not yet added as a package reference.

**Verification:** Not yet attempted. Not implemented, tested, or user-confirmed.

**Not done:** adding the `Microsoft.AspNetCore.OpenApi` package; building;
checking `/openapi/v1.json`; triggering an exception to confirm the
ProblemDetails shape; request validation; logging; test project.

**Next:** user adds the OpenAPI package, builds, and checks the new
endpoints.


## 2026-11-11 — Session 4: request validation, logging, and a test project

**Context:** Continuing M1 Part 2 after the previous session's exception
handling and OpenAPI work was verified and ready to commit.

**What changed:**

- AI wrote, unbuilt: `Api/Validation/ValidationFilter.cs`; `Program.cs`
  updated to wire it in, configure console logging by environment, and expose
  `public partial class Program` for test discoverability; new test project
  `backend/tests/Raqam.Api.Tests` with one integration test
  (`HealthEndpointTests`) against the real local database; `Raqam.Api.csproj`
  updated with `FluentValidation.DependencyInjectionExtensions` and an
  `InternalsVisibleTo` entry for the test project.
- D013 (validation approach) and D014 (logging approach) recorded.
- None of this has been built, and the test project has not been added to
  `Raqam.sln` yet.

**Verification:** Not yet attempted on the Mac.

**Not done:** adding the FluentValidation package and restoring; adding the
test project to the solution; running `dotnet test`; README and
`docs/architecture.md` updates; the commit from the previous session (unclear
whether it happened).

**Next:** user adds the FluentValidation package, adds the test project to
the solution, builds, and runs the tests.


## 2026-11-11 — Session 4 (continued): EF Core version pin, and a sync mistake

**Context:** Fixing the MSB3277 version-conflict warning from the previous
build.

**What changed:** added an explicit `Microsoft.EntityFrameworkCore` 10.0.14
`PackageReference` to `Raqam.Infrastructure.csproj` (D015).

**Mistake and correction (important for future sessions):** the AI's local
copy of `Raqam.Infrastructure.csproj` had drifted from the real file — it
never reflected the `Npgsql.EntityFrameworkCore.PostgreSQL` package the user
had added directly on the Mac with `dotnet add`. Editing the stale local copy
and pushing it overwrote the real file, deleting that package reference and
breaking the build (32 compile errors — EF Core types not found). This was
caught by re-staging and reading the device file immediately after, and fixed
by writing the full corrected content (both package references) back. The
first corrective push also silently failed to take effect (device reported
"written" but the file was unchanged); a second push with `force: true`
worked, verified by re-staging before telling the user to rebuild.

**Lesson recorded:** before editing any `.csproj`, `.sln`, or tool-manifest
file that the user also edits directly (via `dotnet add`/`dotnet tool
install`/`dotnet sln add`), stage and read the live file on the Mac first —
never assume the AI's local copy is current. After pushing such a file back,
re-stage it to confirm the write actually landed before telling the user to
build.

**Verification:** user ran `dotnet build Raqam.sln` and reported success —
MSB3277 is gone.

**Not done:** README and `docs/architecture.md` updates; confirming no
secrets are in `git status`; a Session 3/4 commit and push (unclear whether
one has happened since the "everything is good" push in Session 3).

**Next:** update README's run instructions (database setup, user-secrets,
migrations, tests), consider a short `docs/architecture.md`, confirm `git
status` is clean of secrets, then close M1 Part 3/4 and open M2.


## 2026-11-11 — Session 4 (continued): M1 closed, M2 opened

**What changed:** README updated with database setup, user-secrets,
migration, and test-run instructions; `docs/architecture.md` created
summarizing the project split and M1's cross-cutting pieces. User confirmed
`git status` has no secrets staged. M1 marked `[x]` in `ROADMAP.md`; M2
marked `[~]`. `TASKS.md` replaced with the M2 checklist (ASP.NET Core
Identity, TOTP 2FA, owner scoping, CORS/CSRF, rate limiting).

**M1 summary:** EF Core + Npgsql configured against the Mac's local
PostgreSQL (D011); initial (empty) migration applied; `/health` with a real
database check; global exception handling returning ProblemDetails;
FluentValidation wired through a custom filter (D013, no validators yet);
environment-based console logging (D014); OpenAPI document in Development
(D012); an integration test project exercising `/health` against the real
database; an EF Core package-version conflict found and fixed (D015). One
process note: an AI edit briefly broke `Raqam.Infrastructure.csproj` by
editing a stale local copy; caught and corrected within the session (see the
mistake entry above). Controllers over minimal APIs (D010) carried over from
M0.

**Verification:** all user-confirmed via shared command output — build,
`/health`, `/openapi/v1.json`, `dotnet test` (1/1 passing), and `git status`.

**Not done:** anything in M2. The two open decisions (auth transport, public
registration) have not been discussed with the user yet.

**Next:** discuss and record the M2 Part 0 decisions, then add ASP.NET Core
Identity.
