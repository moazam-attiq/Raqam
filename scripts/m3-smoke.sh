#!/usr/bin/env bash
# M3 smoke test: exercises accounts, categories and transactions over HTTP.
#
# Prerequisites:
#   1. The API is running over HTTPS (the auth and CSRF cookies are Secure):
#        cd backend && dotnet run --project src/Raqam.Api --launch-profile https
#   2. RAQAM_EMAIL and RAQAM_PASSWORD are the seeded user's login. Do not type the password
#      on the command line where it ends up in history; read it from the prompt below.
#
# Usage (from the repo root):
#   RAQAM_EMAIL='you@example.com' bash scripts/m3-smoke.sh
#
# It creates two uniquely named accounts and a few transactions in the dev database, then
# archives the accounts. Accounts cannot be deleted (D029), so a run leaves them archived.
# Requires curl and python3 (both ship with macOS developer tools).

set -u

BASE="${RAQAM_BASE:-https://localhost:7271}"
EMAIL="${RAQAM_EMAIL:?Set RAQAM_EMAIL to the seeded user email}"
if [ -z "${RAQAM_PASSWORD:-}" ]; then
  read -r -s -p "Password for $EMAIL: " RAQAM_PASSWORD
  echo
fi

CJ="$(mktemp)"
OUT="$(mktemp)"
trap 'rm -f "$CJ" "$OUT"' EXIT

PASS=0
FAIL=0
STATUS=""
BODY=""
CSRF=""
RUN="$(date +%H%M%S)"

jget() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

check() { # label actual expected
  if [ "$2" = "$3" ]; then
    echo "  PASS  $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $1  (got '$2', expected '$3')"
    FAIL=$((FAIL + 1))
  fi
}

check_num() { # label actual expected
  if python3 -c "import sys; sys.exit(0 if abs(float('$2') - float('$3')) < 0.001 else 1)" 2>/dev/null; then
    echo "  PASS  $1  ($2)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $1  (got '$2', expected '$3')"
    FAIL=$((FAIL + 1))
  fi
}

fetch_csrf() {
  CSRF="$(curl -sk -b "$CJ" -c "$CJ" "$BASE/api/v1/auth/csrf-token" | jget "d['token']")"
}

req() { # method path [json-body]
  local method="$1" path="$2" data="${3:-}"
  local args=(-sk -X "$method" -b "$CJ" -c "$CJ" -H "X-CSRF-TOKEN: $CSRF" -o "$OUT" -w '%{http_code}')
  if [ -n "$data" ]; then
    args+=(-H 'Content-Type: application/json' -d "$data")
  fi
  STATUS="$(curl "${args[@]}" "$BASE$path")"
  BODY="$(cat "$OUT")"
}

echo "== Login"
fetch_csrf
LOGIN_BODY="$(python3 -c "import json,sys; print(json.dumps({'email': sys.argv[1], 'password': sys.argv[2]}))" "$EMAIL" "$RAQAM_PASSWORD")"
req POST /api/v1/auth/login "$LOGIN_BODY"
check "login succeeded" "$(echo "$BODY" | jget "d.get('succeeded')")" "True"
if [ "$(echo "$BODY" | jget "d.get('succeeded')")" != "True" ]; then
  echo "Login failed (body: $BODY). If requiresTwoFactor is true, disable 2FA for the seed user or log in by hand."
  exit 1
fi
fetch_csrf # the token is tied to the signed-in identity, so fetch a fresh one

echo "== Unauthenticated request is rejected"
STATUS_ANON="$(curl -sk -o /dev/null -w '%{http_code}' "$BASE/api/v1/accounts")"
check "GET /accounts without a cookie -> 401" "$STATUS_ANON" "401"

echo "== Categories (seeded defaults)"
req GET /api/v1/categories
check "GET /categories -> 200" "$STATUS" "200"
FOOD="$(echo "$BODY" | jget "[c for c in d if c['name']=='Food' and c['type']=='Expense'][0]['id']")"
SALARY="$(echo "$BODY" | jget "[c for c in d if c['name']=='Salary' and c['type']=='Income'][0]['id']")"
check "found the Food and Salary categories" "$([ -n "$FOOD" ] && [ -n "$SALARY" ] && echo yes)" "yes"
req GET "/api/v1/categories?type=Income"
check "income-only list has no Expense rows" "$(echo "$BODY" | jget "all(c['type']=='Income' for c in d)")" "True"

echo "== Categories: create, subcategory, version, archive cascade"
req POST /api/v1/categories "{\"name\":\"Smoke Cat $RUN\",\"type\":\"Expense\",\"colour\":\"#336699\",\"icon\":\"tag\"}"
check "create category -> 201" "$STATUS" "201"
CAT="$(echo "$BODY" | jget "d['id']")"
CAT_V1="$(echo "$BODY" | jget "d['version']")"
req POST /api/v1/categories "{\"name\":\"Smoke Cat $RUN\",\"type\":\"Expense\"}"
check "duplicate category name -> 409" "$STATUS" "409"
req POST /api/v1/categories "{\"name\":\"Smoke Sub $RUN\",\"type\":\"Expense\",\"parentCategoryId\":\"$CAT\"}"
check "create subcategory -> 201" "$STATUS" "201"
SUB="$(echo "$BODY" | jget "d['id']")"
req POST /api/v1/categories "{\"name\":\"Smoke Wrong $RUN\",\"type\":\"Income\",\"parentCategoryId\":\"$CAT\"}"
check "subcategory of a different type -> 400" "$STATUS" "400"
req POST /api/v1/categories "{\"name\":\"Smoke Deep $RUN\",\"type\":\"Expense\",\"parentCategoryId\":\"$SUB\"}"
check "subcategory of a subcategory -> 400" "$STATUS" "400"
req GET "/api/v1/categories/$CAT"
check "GET category -> 200" "$STATUS" "200"
req PUT "/api/v1/categories/$CAT" "{\"name\":\"Smoke Cat $RUN\",\"colour\":\"#112233\",\"icon\":\"tag\",\"version\":$CAT_V1}"
check "update category with current version -> 200" "$STATUS" "200"
req PUT "/api/v1/categories/$CAT" "{\"name\":\"Smoke Cat $RUN\",\"colour\":\"#445566\",\"icon\":\"tag\",\"version\":$CAT_V1}"
check "update category with stale version -> 409" "$STATUS" "409"
req POST "/api/v1/categories/$CAT/archive"
check "archive category -> 200" "$STATUS" "200"
req GET "/api/v1/categories/$SUB"
check "archiving the parent archived the subcategory" "$(echo "$BODY" | jget "d['isArchived']")" "True"

echo "== Accounts"
req POST /api/v1/accounts "{\"name\":\"Smoke Cash $RUN\",\"accountType\":\"Cash\",\"openingBalance\":1000}"
check "create Cash -> 201" "$STATUS" "201"
CASH="$(echo "$BODY" | jget "d['id']")"
CASH_V1="$(echo "$BODY" | jget "d['version']")"

req POST /api/v1/accounts "{\"name\":\"Smoke Bank $RUN\",\"accountType\":\"BankAccount\",\"openingBalance\":5000,\"institutionName\":\"Test Bank\"}"
check "create Bank -> 201" "$STATUS" "201"
BANK="$(echo "$BODY" | jget "d['id']")"

req POST /api/v1/accounts "{\"name\":\"Smoke Cash $RUN\",\"accountType\":\"Cash\",\"openingBalance\":0}"
check "duplicate name -> 409" "$STATUS" "409"

req POST /api/v1/accounts "{\"name\":\"Bad $RUN\",\"openingBalance\":10.123}"
check "missing type and 3 decimals -> 400" "$STATUS" "400"

req GET "/api/v1/accounts/$CASH"
check "GET account -> 200" "$STATUS" "200"

echo "== Optimistic concurrency"
req PUT "/api/v1/accounts/$CASH" "{\"name\":\"Smoke Cash $RUN\",\"accountType\":\"Cash\",\"openingBalance\":1000,\"institutionName\":\"Wallet\",\"version\":$CASH_V1}"
check "update with current version -> 200" "$STATUS" "200"
req PUT "/api/v1/accounts/$CASH" "{\"name\":\"Smoke Cash $RUN\",\"accountType\":\"Cash\",\"openingBalance\":1000,\"institutionName\":\"Stale\",\"version\":$CASH_V1}"
check "update with stale version -> 409" "$STATUS" "409"

echo "== Transactions"
req POST /api/v1/transactions "{\"type\":\"Income\",\"amount\":2000,\"transactionDate\":\"2026-11-01\",\"sourceAccountId\":\"$BANK\",\"categoryId\":\"$SALARY\",\"description\":\"Smoke salary\"}"
check "income -> 201" "$STATUS" "201"

req POST /api/v1/transactions "{\"type\":\"Expense\",\"amount\":150.50,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"$CASH\",\"categoryId\":\"$FOOD\",\"description\":\"Smoke lunch\",\"merchant\":\"Cafe 50%\"}"
check "expense -> 201" "$STATUS" "201"
EXPENSE="$(echo "$BODY" | jget "d['id']")"

req POST /api/v1/transactions "{\"type\":\"Transfer\",\"amount\":300,\"transactionDate\":\"2026-11-08\",\"sourceAccountId\":\"$BANK\",\"destinationAccountId\":\"$CASH\",\"description\":\"Smoke transfer\"}"
check "transfer -> 201" "$STATUS" "201"

echo "== Rules are enforced"
req POST /api/v1/transactions "{\"type\":\"Expense\",\"amount\":0,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"$CASH\",\"categoryId\":\"$FOOD\"}"
check "zero amount -> 400" "$STATUS" "400"
req POST /api/v1/transactions "{\"type\":\"Expense\",\"amount\":10.555,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"$CASH\",\"categoryId\":\"$FOOD\"}"
check "three decimals -> 400" "$STATUS" "400"
req POST /api/v1/transactions "{\"type\":\"Income\",\"amount\":10,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"$CASH\",\"categoryId\":\"$FOOD\"}"
check "income with an expense category -> 400" "$STATUS" "400"
req POST /api/v1/transactions "{\"type\":\"Transfer\",\"amount\":10,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"$CASH\",\"destinationAccountId\":\"$CASH\"}"
check "transfer to the same account -> 400" "$STATUS" "400"
req POST /api/v1/transactions "{\"type\":\"Transfer\",\"amount\":10,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"$CASH\",\"destinationAccountId\":\"$BANK\",\"categoryId\":\"$FOOD\"}"
check "transfer with a category -> 400" "$STATUS" "400"
req POST /api/v1/transactions "{\"type\":\"Expense\",\"amount\":10,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"00000000-0000-4000-8000-000000000001\",\"categoryId\":\"$FOOD\"}"
check "unknown account -> 404" "$STATUS" "404"
req GET "/api/v1/transactions/00000000-0000-4000-8000-000000000001"
check "unknown transaction -> 404" "$STATUS" "404"

echo "== Balances (opening + income - expense + in - out)"
req GET "/api/v1/accounts/$CASH/balance"
check_num "Cash now = 1000 - 150.50 + 300" "$(echo "$BODY" | jget "d['balance']")" "1149.50"
req GET "/api/v1/accounts/$BANK/balance"
check_num "Bank now = 5000 + 2000 - 300" "$(echo "$BODY" | jget "d['balance']")" "6700"
req GET "/api/v1/accounts/$CASH/balance?asOf=2026-11-06"
check_num "Cash as of 2026-11-06 (before the transfer) = 1000 - 150.50" "$(echo "$BODY" | jget "d['balance']")" "849.50"
req GET "/api/v1/accounts/$BANK/balance?asOf=2026-11-06"
check_num "Bank as of 2026-11-06 = 5000 + 2000" "$(echo "$BODY" | jget "d['balance']")" "7000"

echo "== Lists, filters, history"
req GET "/api/v1/accounts/$CASH/transactions"
check "Cash history has the expense and the transfer" "$(echo "$BODY" | jget "d['totalCount']")" "2"
req GET "/api/v1/transactions?accountId=$BANK&type=Transfer"
check "Bank transfers filter" "$(echo "$BODY" | jget "d['totalCount']")" "1"
req GET "/api/v1/transactions?accountId=$CASH&from=2026-11-02&to=2026-11-07"
check "Cash, date range 11-02..11-07 finds only the expense" "$(echo "$BODY" | jget "[t['description'] for t in d['items']]")" "['Smoke lunch']"
req GET "/api/v1/transactions?accountId=$CASH&search=lunch"
check "search 'lunch' finds the expense by description" "$(echo "$BODY" | jget "d['totalCount']")" "1"
req GET "/api/v1/transactions?accountId=$CASH&search=CAFE"
check "search 'CAFE' finds the expense by merchant, case-insensitive" "$(echo "$BODY" | jget "d['totalCount']")" "1"
req GET "/api/v1/transactions?accountId=$CASH&search=%25"
check "search for a literal '%' matches only the merchant 'Cafe 50%', not every row" "$(echo "$BODY" | jget "d['totalCount']")" "1"
req GET "/api/v1/transactions?accountId=$CASH&sort=AmountDesc"
check_num "sort by amount desc puts the 300 transfer first" "$(echo "$BODY" | jget "d['items'][0]['amount']")" "300"
req GET "/api/v1/transactions?pageSize=1&page=2&accountId=$CASH&sort=DateAsc"
check "paging: page 2 of size 1 has 1 item and 2 pages" "$(echo "$BODY" | jget "(len(d['items']), d['totalPages'])")" "(1, 2)"
req GET "/api/v1/transactions?pageSize=500"
check "page size 500 -> 400" "$STATUS" "400"
req GET "/api/v1/transactions?from=2026-12-01&to=2026-11-01"
check "to before from -> 400" "$STATUS" "400"

echo "== Edit and delete"
req PUT "/api/v1/transactions/$EXPENSE" "{\"type\":\"Expense\",\"amount\":200,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"$CASH\",\"categoryId\":\"$FOOD\",\"description\":\"Smoke lunch\",\"version\":0}"
check "update with a wrong version -> 409" "$STATUS" "409"
req GET "/api/v1/transactions/$EXPENSE"
EXPENSE_V="$(echo "$BODY" | jget "d['version']")"
req PUT "/api/v1/transactions/$EXPENSE" "{\"type\":\"Expense\",\"amount\":200,\"transactionDate\":\"2026-11-05\",\"sourceAccountId\":\"$CASH\",\"categoryId\":\"$FOOD\",\"description\":\"Smoke lunch\",\"version\":$EXPENSE_V}"
check "update with the current version -> 200" "$STATUS" "200"
req GET "/api/v1/accounts/$CASH/balance"
check_num "Cash after edit = 1000 - 200 + 300" "$(echo "$BODY" | jget "d['balance']")" "1100"
req DELETE "/api/v1/transactions/$EXPENSE"
check "delete -> 204" "$STATUS" "204"
req GET "/api/v1/accounts/$CASH/balance"
check_num "Cash after delete = 1000 + 300" "$(echo "$BODY" | jget "d['balance']")" "1300"

echo "== Archive"
req POST "/api/v1/accounts/$CASH/archive"
check "archive Cash -> 200" "$STATUS" "200"
req POST /api/v1/transactions "{\"type\":\"Expense\",\"amount\":5,\"transactionDate\":\"2026-11-09\",\"sourceAccountId\":\"$CASH\",\"categoryId\":\"$FOOD\"}"
check "new transaction on an archived account -> 400" "$STATUS" "400"
req GET "/api/v1/accounts"
check "archived account is hidden from the default list" "$(echo "$BODY" | jget "'$CASH' in [a['id'] for a in d]")" "False"
req GET "/api/v1/accounts?includeArchived=true"
check "archived account shows with includeArchived" "$(echo "$BODY" | jget "'$CASH' in [a['id'] for a in d]")" "True"
req POST "/api/v1/accounts/$BANK/archive"
check "archive Bank -> 200" "$STATUS" "200"

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
