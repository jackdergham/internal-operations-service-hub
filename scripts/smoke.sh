#!/usr/bin/env bash
#
# Final smoke test. Verifies that a running instance is genuinely usable, not
# merely responding to a health check: it walks the critical journey end to end
# and asserts on the observed results.
#
# Usage:
#   scripts/smoke.sh                                  # defaults to local backend
#   BASE_URL=https://ops.example.com scripts/smoke.sh # deployed target
#
# Exits 0 only when every check passes. Any failure exits non-zero, so this can
# be wired into a release gate rather than being a claim someone has to trust.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SMOKE_PREFIX="smoke-$(date +%s)-$$"

pass_count=0
fail_count=0

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
info()  { printf '\033[2m%s\033[0m\n' "$1"; }

# check <description> <expected-status> <curl args...>
# Passes when the response code equals the expected status.
check() {
  local description="$1" expected="$2"
  shift 2
  local body status
  body="$(curl -sS -w $'\n%{http_code}' "$@" 2>/dev/null)" || {
    red "FAIL  ${description} (request failed)"
    fail_count=$((fail_count + 1))
    return 0
  }
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"
  if [ "$status" = "$expected" ]; then
    green "PASS  ${description} (${status})"
    pass_count=$((pass_count + 1))
  else
    red "FAIL  ${description} (expected ${expected}, got ${status})"
    printf '      %s\n' "${body:0:200}"
    fail_count=$((fail_count + 1))
  fi
}

# assert_contains <description> <needle> <haystack>
assert_contains() {
  if printf '%s' "$3" | grep -qF -- "$2"; then
    green "PASS  $1"
    pass_count=$((pass_count + 1))
  else
    red "FAIL  $1 (missing '$2')"
    printf '      %s\n' "${3:0:200}"
    fail_count=$((fail_count + 1))
  fi
}

info "Smoke testing ${BASE_URL}"

# --- Health ------------------------------------------------------------------
# Liveness must stay 200 even when the database is down; readiness is the one
# that reports dependency failure. Checking both is what distinguishes "the
# process is up" from "the service is usable".
check "liveness" 200 "${BASE_URL}/health"
health="$(curl -sS "${BASE_URL}/health" 2>/dev/null || true)"
assert_contains "liveness reports ok" '"status":"ok"' "${health}"

check "readiness" 200 "${BASE_URL}/health/ready"
ready="$(curl -sS "${BASE_URL}/health/ready" 2>/dev/null || true)"
assert_contains "readiness reports database ok" '"status":"ready"' "${ready}"

# --- Frontend ----------------------------------------------------------------
# Only meaningful against a single-service deployment that serves the app.
root_body="$(curl -sS "${BASE_URL}/" 2>/dev/null || true)"
if printf '%s' "${root_body}" | grep -qi '<div id="root">'; then
  green "PASS  frontend served at /"
  pass_count=$((pass_count + 1))
else
  info "SKIP  frontend not served at / (API-only deployment)"
fi

# --- Critical journey: submit -> approve -> fulfill -> close -----------------
submit_body="$(curl -sS -X POST "${BASE_URL}/requests" \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: employee-1' \
  -d "{\"requesterId\":\"employee-1\",\"requestTypeId\":\"new-laptop\",\"description\":\"Smoke test request for the critical journey.\",\"formData\":{},\"idempotencyKey\":\"${SMOKE_PREFIX}\"}" \
  2>/dev/null || true)"

request_id="$(printf '%s' "${submit_body}" | sed -n 's/.*"id":"\(REQ-[A-Z0-9]*\)".*/\1/p' | head -1)"
if [ -n "${request_id}" ]; then
  green "PASS  request submitted (${request_id})"
  pass_count=$((pass_count + 1))
  assert_contains "submitted request is pending approval" '"status":"Pending Approval"' "${submit_body}"
else
  red "FAIL  could not submit a request"
  printf '      %s\n' "${submit_body:0:200}"
  fail_count=$((fail_count + 1))
  printf '\n%s\n' "Journey stopped: approval cannot proceed without a request."
  printf '%s\n' "${pass_count} passed, ${fail_count} failed"
  exit 1
fi

# Approve as the employee's manager. employee-1 routes to manager-1.
queue="$(curl -sS "${BASE_URL}/routing-decisions/queue" -H 'x-actor-id: manager-1' 2>/dev/null || true)"
decision_id="$(printf '%s' "${queue}" | sed -n "s/.*\"decisionId\":\"\([^\"]*\)\",\"stepId\":\"\([^\"]*\)\",\"requestId\":\"${request_id}\".*/\1/p" | head -1)"
step_id="$(printf '%s' "${queue}" | sed -n "s/.*\"decisionId\":\"\([^\"]*\)\",\"stepId\":\"\([^\"]*\)\",\"requestId\":\"${request_id}\".*/\2/p" | head -1)"

if [ -n "${decision_id}" ] && [ -n "${step_id}" ]; then
  green "PASS  request appears in the approver queue"
  pass_count=$((pass_count + 1))

  approve_body="$(curl -sS -X POST \
    "${BASE_URL}/routing-decisions/${decision_id}/steps/${step_id}/decision" \
    -H 'Content-Type: application/json' \
    -H 'x-actor-id: manager-1' \
    -d '{"decision":"approve"}' 2>/dev/null || true)"
  assert_contains "approval moves decision to ReadyForQueue" '"status":"ReadyForQueue"' "${approve_body}"

  # Fulfil and close, proving the request reaches a terminal state.
  check "fulfillment resolve" 201 -X POST "${BASE_URL}/fulfillment/${request_id}/resolve" -H 'x-actor-id: fulfiller-it-1'
  check "fulfillment close"   201 -X POST "${BASE_URL}/fulfillment/${request_id}/close"   -H 'x-actor-id: fulfiller-it-1'

  closed="$(curl -sS "${BASE_URL}/requests/${request_id}/audit" -H 'x-actor-id: admin-1' 2>/dev/null || true)"
  assert_contains "request reached Closed" '"status":"Closed"' "${closed}"
else
  red "FAIL  request did not appear in manager-1's queue"
  printf '      %s\n' "${queue:0:200}"
  fail_count=$((fail_count + 1))
fi

# --- Authorization boundary --------------------------------------------------
# The journey above used employee-1 submitting for themselves. Submitting for
# another employee must be refused, so a green run also demonstrates the
# boundary still holds.
check "cross-actor submission denied" 403 -X POST "${BASE_URL}/requests" \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: employee-2' \
  -d '{"requesterId":"employee-1","requestTypeId":"new-laptop","description":"Smoke test cross-actor attempt.","formData":{}}'

# --- Result ------------------------------------------------------------------
printf '\n'
if [ "${fail_count}" -eq 0 ]; then
  green "SMOKE PASSED: ${pass_count} checks against ${BASE_URL}"
  exit 0
fi
red "SMOKE FAILED: ${fail_count} failed, ${pass_count} passed against ${BASE_URL}"
exit 1
