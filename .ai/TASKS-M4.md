# TASKS-M4.md — The M4 checklist as it stood when M5 was opened (2026-11-20)

Archived copy. The M4 items still open are listed in `TASKS.md` under "M4 carry-over".

## M4 — Core frontend

Source: spec §11 Phase 4, §3.1 (layout only), §3.2–§3.4, §3.14, §5.2, §10.3.
Goal: the user can complete the core financial tasks in the browser — sign in
(with 2FA), manage accounts and categories, and create, edit, filter and delete
transactions — on desktop and mobile widths, with API validation errors shown
clearly.

Backend is complete (M3); this milestone changes no API behaviour except what a
frontend bug forces. Decisions D037–D040 apply. The frontend is a Vite + React 19
+ TypeScript + Tailwind 4 skeleton today (no router, no data fetching, no tests).
The AI writes files; the user runs `npm` commands and shares output (B004).

### Part 0 — Decisions

- [x] Dev API access through the Vite proxy (D037)
- [x] Radix UI primitives + Tailwind components (D038)
- [x] Vitest + Testing Library in M4 (D039)
- [x] Conventions: feature folders, TanStack Query, RHF + Zod, money/date/theme
      handling (D040)
- [x] D040 (AI-chosen defaults) accepted by the user with one change: dates use
      dayjs and the `18 May 2026` display format everywhere (D041)
- [x] Dates: dayjs, `D MMM YYYY` display, `YYYY-MM-DD` on the wire, calendar-popover
      date fields (D041)

### Part 1 — Foundation

Status: complete. User ran `npm run build`, `npm run lint` and `npm test` on their
machine: all passed (2026-11-20). Visual restyle to the brand (D042) is a follow-up on
this part; it is written, scratch-verified and waiting for the user's `npm install` and
`npm test` run, and their look at it in the browser.

- [x] Install dependencies (user runs): `react-router`, `@tanstack/react-query`,
      `react-hook-form`, `zod`, `@hookform/resolvers`, `dayjs`, `react-day-picker`; dev: `vitest`, `jsdom`,
      `@testing-library/react`, `@testing-library/user-event`,
      `@testing-library/jest-dom`. Radix packages are added by the slice that
      needs them (D038)
- [x] `vite.config.ts`: `/api` proxy to `https://localhost:7271` (D037) and the
      test configuration; `.env.example` updated to `/api/v1`; `npm test` script
- [x] API client in `src/lib`: base URL, credentials, CSRF header for unsafe
      verbs, ProblemDetails parsing into one error type (`400` fields, `404`,
      `409`, `401`, `429`, network failure); confirm the real error body shape
      against a live `400` response
- [x] Money and date helpers with tests: PKR format; dayjs date helper (parse and
      send `YYYY-MM-DD`, show `18 May 2026`, timestamps `D MMM YYYY, h:mm A`
      local, no UTC shift for plain dates) (D041)
- [x] Theme: system default, light/dark/system toggle, persisted (with a test)
- [ ] Brand pass (D042): lapis and gold tokens, wordmark, icons, restyled UI kit and shell
      (written; needs the user's `npm install`, `npm test` and a look in light and dark)
- [x] App shell: router, layout with navigation (sidebar on desktop, compact
      navigation on mobile), page placeholders, not-found page
- [x] `src/components/ui`: button, input, form field, card, badge, table, dialog,
      confirm dialog, spinner/skeleton, empty state, error state, toast, and the
      date field (button showing `18 May 2026` that opens a calendar popover; also
      accepts typing) (D041)
- [x] README: how to run the frontend against the API (`https` profile + proxy)

### Part 2 — Authentication screens

Status: written, 120 tests pass in the AI's scratch workspace (19 new). Items stay
unticked until the user runs the checks and signs in for real against the API.

- [ ] Sign-in form; `429` shown as "too many attempts"; wrong credentials shown
      without revealing which part was wrong
- [ ] 2FA step: authenticator code, and recovery code (routes are
      `/two-factor/verify` and `/two-factor/recovery-code`; README fixed)
- [ ] Session: `GET /auth/me`, route guard, sign-out, `401` returns to sign-in
- [ ] 2FA setup and disable screen (status, shared key / otpauth QR, recovery
      codes shown once) — deferred (D043): not needed for the exit criteria; build it
      with a settings page later. 2FA can still be enabled through the API.
- [ ] Tests: sign-in, 2FA, guard, `401` handling

### Part 3 — Accounts

Status: written, 139 tests pass in the AI's scratch workspace (19 new). Items stay
unticked until the user runs the checks and uses the screens against the real API.

- [ ] List with balance per account (from `/accounts/{id}/balance`), archived
      accounts hidden or labelled
- [ ] Create and edit dialog (name, type, opening balance, institution); `409`
      stale-version handling
- [ ] Archive with confirmation
- [ ] Account detail: balance, and its transaction history
- [ ] Tests: form validation, API error display

### Part 4 — Categories

Status: written, 162 tests pass in the AI's scratch workspace (23 new). Items stay unticked
until the user runs the checks and uses the screens against the real API. The accounts
dialog was also corrected (duplicate-name 409, D045), so re-check editing an account with a
name that already exists.

- [ ] Tree list (parents and subcategories, income and expense)
- [ ] Create and edit dialog (type and parent fixed after creation, D028 rules)
- [ ] Archive with confirmation (warns about subcategories)
- [ ] Tests

### Part 5 — Transactions

Status: written, 204 tests pass in the AI's scratch workspace (42 new). Items stay unticked
until the user runs the checks and records real transactions against the API. Also check
that the account balances move as expected after each one.

- [ ] List with filters (date range, type, account, category, search), sort and
      paging (D036), shown in the URL so a filtered view can be reloaded
- [ ] Create and edit form with type-dependent fields (income / expense / transfer),
      fast keyboard entry, remembered last account; `400` shown on the right
      fields; `409` handled
- [ ] Delete with confirmation
- [ ] Tests: create and edit flows, validation, API errors

### Part 6 — Dashboard layout

Status: written, 215 tests pass in the AI's scratch workspace (11 new). The item stays
unticked until the user runs the checks and sees it with real data.

- [ ] Dashboard page: account balances summary and recent transactions from
      existing endpoints; layout only, no analytics (M5)

### Part 7 — Quality pass

Status: audited and fixed in the AI's scratch workspace (D048); 219 tests pass, tsc, lint and
build clean. axe-core found no violations on any page, dialog or state in light and dark after
the fixes; no horizontal overflow at 390, 768, 1024 or 1440 px; the theme persists across a
reload and applies before first paint. This was a stubbed-API run in headless Chromium, so the
items stay unticked until the user sees them in their own browser with the real API.

- [ ] Loading, empty and error states on every list and form
- [ ] Responsive check at mobile, tablet and desktop widths
- [ ] Accessibility pass: labels, focus order, keyboard use, dialogs, contrast in
      both themes
- [ ] Theme persists across reloads

### Added after the walkthrough (D049, D050)

- [x] Backend no-overdraft rule: `dotnet test` green (user shared: 159 of 159)
- [ ] Future-dated transactions refused (D051): backend `FutureDateTests` and domain tests need
      `dotnet test`; frontend limit has tests
- [ ] 2FA screen (D052): turn on with a real authenticator app, recovery codes, turn off, then
      sign in with a code and with a recovery code
- [x] Frontend: available balance and over-amount blocking; negative opening balance refused
      (user shared: 246 tests pass)
- [ ] Default month filter, no future From/To, stronger today highlight

### Part 8 — Verification and close-out

- [x] `npm run build`, `npm run lint` and `npm test` green (user shared output: build OK, lint
      0/0, 219 tests; the later D049/D050 changes bring it to 246 in the AI's workspace and need
      a re-run on the user's machine)
- [ ] (Partial, per the user: sign-in, accounts, categories, income, expense, transfer work;
      2FA step, edit/delete, filter/search, validation error and phone width not reported;
      2FA setup has no screen yet.) Manual walkthrough in the browser (user, with the API running): sign in
      with 2FA, create accounts and categories, add income, expense and transfer,
      edit and delete, filter and search, check balances; at desktop and phone
      widths; a validation error from the API is visible
- [x] README and `docs/architecture.md` updated (frontend structure and
      conventions) — written 2026-11-20, read back from the device
- [ ] `DECISIONS.md` current; `PROGRESS.md` entry; close M4 in `ROADMAP.md` only
      after verification by output the user shared; replace this file with the
      M5 checklist when M5 is opened

### Process reminders

- The device bridge has silently failed to apply pushes before. After every
  push, re-stage the file and read its content before telling the user to
  build (see `PROGRESS.md`, session 5).
- Before editing any `.csproj`, `.sln`, or tool manifest the user also changes
  with `dotnet add` / `dotnet sln add`, stage and read the live file first.
- The AI has no shell on the Mac in this setup; the user runs `dotnet`
  commands and shares output (B004).
- The user runs `npm` commands and shares output; do not mark a frontend item
  done on the strength of code alone. Check `package.json` live before editing
  it (the user changes it with `npm install`).
