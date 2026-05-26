#!/usr/bin/env bash
# Daily improvement agent for GeoChallenge.
# Runs Claude Code headless against a structured audit prompt and publishes
# findings as a single GitHub issue per day.
#
# Modes:
#   ./run.sh              # normal: audit + create issue (if findings)
#   ./run.sh --dry-run    # audit but DO NOT create issue
#   ./run.sh --test-issue # audit + create issue prefixed [TEST]
#
# Invoked by ~/Library/LaunchAgents/com.geochallenge.daily-agent.plist.

set -uo pipefail

# launchd does not inherit user shell PATH — set it explicitly.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# If invoked from within an existing Claude Code session, the harness injects
# transient session credentials that are NOT valid for sub-processes. Unset
# them so the spawned `claude` falls back to the user's stored OAuth login.
unset ANTHROPIC_API_KEY ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN \
      CLAUDE_CODE_ENTRYPOINT CLAUDE_CODE_SESSION_ID CLAUDE_CODE_EXECPATH \
      CLAUDECODE CLAUDE_AGENT_SDK_VERSION CLAUDE_EFFORT

# ---- Paths -----------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATE="$(date +%F)"
RUN_DIR="$SCRIPT_DIR/runs/$DATE"
LOG_JSONL="$SCRIPT_DIR/runs/log.jsonl"

mkdir -p "$RUN_DIR" 2>/dev/null || {
  echo "ERROR: cannot create $RUN_DIR — likely macOS TCC blocking access." >&2
  echo "Fix: System Settings → Privacy & Security → Full Disk Access → add /bin/bash" >&2
  exit 77
}

# ---- Args ------------------------------------------------------------------
MODE="normal"
for arg in "$@"; do
  case "$arg" in
    --dry-run)    MODE="dry-run" ;;
    --test-issue) MODE="test-issue" ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 64 ;;
  esac
done

log() { echo "[$(date '+%H:%M:%S')] $*"; }
log_err() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; }

# Append a single-line JSON record to the run log.
log_run() {
  local status="$1" issue_url="${2:-}" findings_count="${3:-0}" critical="${4:-0}"
  local entry
  entry=$(jq -cn \
    --arg ts "$(date -u +%FT%TZ)" \
    --arg date "$DATE" \
    --arg mode "$MODE" \
    --arg status "$status" \
    --arg issue_url "$issue_url" \
    --argjson findings "$findings_count" \
    --argjson critical "$critical" \
    '{ts:$ts,date:$date,mode:$mode,status:$status,issue_url:$issue_url,findings:$findings,critical:$critical}')
  echo "$entry" >> "$LOG_JSONL"
}

# ---- Preflight -------------------------------------------------------------
require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_err "Missing required command: $1"
    log_run "preflight_failed_$1" "" 0 0
    exit 1
  fi
}
require_cmd claude
require_cmd gh
require_cmd jq
require_cmd git
require_cmd curl

if ! gh auth status >/dev/null 2>&1; then
  log_err "gh CLI is not authenticated. Run 'gh auth login' and retry."
  log_run "gh_auth_failed" "" 0 0
  exit 1
fi

log "Repo: $REPO_ROOT"
log "Run dir: $RUN_DIR"
log "Mode: $MODE"

# ---- Snapshot context ------------------------------------------------------
cd "$REPO_ROOT"

# Best-effort fetch + rebase. Never fails the run — local state takes priority.
if git rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
else
  CURRENT_BRANCH="(detached)"
fi

git fetch origin master --quiet 2>/dev/null || log "git fetch failed (continuing)"

{
  echo "# Context snapshot — $DATE"
  echo
  echo "**Branch**: $CURRENT_BRANCH"
  echo
  echo "## Last 24h of commits on this branch"
  echo
  echo '```'
  git log --since="24 hours ago" --pretty=format:'%h %ad %s' --date=short 2>/dev/null || echo "(no commits)"
  echo
  echo '```'
  echo
  echo "## Working tree status"
  echo
  echo '```'
  git status --short 2>/dev/null || echo "(unable to read status)"
  echo '```'
  echo
  echo "## Already-open daily-improvement issues (do not duplicate these)"
  echo
  echo '```'
  gh issue list --label daily-improvement --state open --limit 20 \
    --json number,title,createdAt --jq '.[] | "#\(.number) \(.createdAt[:10]) — \(.title)"' \
    2>/dev/null || echo "(could not query gh)"
  echo '```'
} > "$RUN_DIR/context.md"

# ---- Render prompt ---------------------------------------------------------
PROMPT_FILE="$SCRIPT_DIR/prompt.md"
RENDERED_PROMPT="$RUN_DIR/prompt-rendered.md"
sed "s|{{RUN_DIR}}|$RUN_DIR|g" "$PROMPT_FILE" > "$RENDERED_PROMPT"

# ---- Invoke Claude ---------------------------------------------------------
log "Invoking Claude (this typically takes 1-3 minutes)..."

# Tools whitelist:
#   Read, Grep, Glob — repo inspection
#   WebFetch, WebSearch — external context
#   Bash(curl:*) — URL HEAD checks
#   Write — the prompt restricts writes to RUN_DIR
ALLOWED_TOOLS="Read Grep Glob WebFetch WebSearch Bash(curl:*) Write"

CLAUDE_OUTPUT="$RUN_DIR/claude-output.json"
CLAUDE_STDERR="$RUN_DIR/claude-stderr.log"

set +e
claude -p \
  --output-format json \
  --max-budget-usd 3 \
  --permission-mode acceptEdits \
  --allowed-tools $ALLOWED_TOOLS \
  --add-dir "$RUN_DIR" \
  --model sonnet \
  < "$RENDERED_PROMPT" \
  > "$CLAUDE_OUTPUT" 2> "$CLAUDE_STDERR"
CLAUDE_EXIT=$?
set -e

if [ "$CLAUDE_EXIT" -ne 0 ]; then
  # Detect the most common headless failure: stale OAuth token.
  if jq -e 'select(.api_error_status == 401)' "$CLAUDE_OUTPUT" >/dev/null 2>&1; then
    log_err "Claude returned 401 (auth). OAuth token does not work in headless mode."
    log_err "Fix: run 'claude setup-token' once to generate a long-lived token,"
    log_err "then 'launchctl unload && launchctl load' the LaunchAgent."
    log_run "claude_auth_401" "" 0 0
  else
    log_err "Claude exited with code $CLAUDE_EXIT. See $CLAUDE_STDERR"
    log_run "claude_failed" "" 0 0
  fi
  exit 1
fi

# ---- Parse findings --------------------------------------------------------
FINDINGS_JSON="$RUN_DIR/findings.json"
ISSUE_BODY="$RUN_DIR/issue-body.md"

if [ ! -f "$FINDINGS_JSON" ]; then
  log_err "Claude did not produce findings.json. Inspect $CLAUDE_OUTPUT."
  log_run "no_findings_file" "" 0 0
  exit 1
fi

if ! jq empty "$FINDINGS_JSON" 2>/dev/null; then
  log_err "findings.json is not valid JSON. See $FINDINGS_JSON"
  log_run "invalid_findings_json" "" 0 0
  exit 1
fi

FINDINGS_COUNT="$(jq '.findings | length' "$FINDINGS_JSON")"
CRITICAL_COUNT="$(jq '[.findings[] | select(.severity == "critical")] | length' "$FINDINGS_JSON")"
WARNING_COUNT="$(jq '[.findings[] | select(.severity == "warning")] | length' "$FINDINGS_JSON")"
SUGGESTION_COUNT="$(jq '[.findings[] | select(.severity == "suggestion")] | length' "$FINDINGS_JSON")"

log "Findings: $FINDINGS_COUNT (critical=$CRITICAL_COUNT, warning=$WARNING_COUNT, suggestion=$SUGGESTION_COUNT)"

# ---- Decide whether to open an issue ---------------------------------------
should_open_issue() {
  if [ "$FINDINGS_COUNT" -eq 0 ]; then
    return 1
  fi
  # If only suggestions, require at least 2 to be worth an issue.
  if [ "$CRITICAL_COUNT" -eq 0 ] && [ "$WARNING_COUNT" -eq 0 ] && [ "$SUGGESTION_COUNT" -lt 2 ]; then
    return 1
  fi
  return 0
}

if ! should_open_issue; then
  log "No actionable findings today. Skipping issue creation."
  log_run "no_issue_needed" "" "$FINDINGS_COUNT" "$CRITICAL_COUNT"
  exit 0
fi

if [ ! -f "$ISSUE_BODY" ]; then
  log_err "Findings present but issue-body.md missing. See $RUN_DIR"
  log_run "missing_issue_body" "" "$FINDINGS_COUNT" "$CRITICAL_COUNT"
  exit 1
fi

# ---- Dedupe ----------------------------------------------------------------
EXISTING_ISSUE_URL=""
if [ "$MODE" != "test-issue" ]; then
  EXISTING_ISSUE_URL="$(gh issue list \
    --label daily-improvement \
    --state open \
    --search "Daily Improvements $DATE in:title" \
    --json url,title \
    --jq ".[] | select(.title | contains(\"Daily Improvements $DATE\")) | .url" \
    2>/dev/null | head -1)"
fi

if [ -n "$EXISTING_ISSUE_URL" ]; then
  log "Already an open issue for $DATE: $EXISTING_ISSUE_URL"
  log_run "issue_already_exists" "$EXISTING_ISSUE_URL" "$FINDINGS_COUNT" "$CRITICAL_COUNT"
  exit 0
fi

# ---- Dry run short-circuit -------------------------------------------------
if [ "$MODE" = "dry-run" ]; then
  log "DRY RUN — would create issue with:"
  log "  Title: Daily Improvements — $DATE"
  log "  Body:  $ISSUE_BODY"
  log "  Findings: $FINDINGS_COUNT"
  log_run "dry_run_ok" "" "$FINDINGS_COUNT" "$CRITICAL_COUNT"
  exit 0
fi

# ---- Ensure labels exist (best-effort) -------------------------------------
ensure_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" --color "$color" --description "$desc" >/dev/null 2>&1 || true
}
ensure_label "daily-improvement" "0E8A16" "Daily auditor digest"
ensure_label "severity:critical"  "B60205" "Daily auditor: critical"
ensure_label "severity:warning"   "D93F0B" "Daily auditor: warning"
ensure_label "severity:suggestion" "FBCA04" "Daily auditor: suggestion"
ensure_label "test"               "C5DEF5" "Test artifact"

# ---- Build label list ------------------------------------------------------
LABELS="daily-improvement"
[ "$CRITICAL_COUNT"   -gt 0 ] && LABELS="$LABELS,severity:critical"
[ "$WARNING_COUNT"    -gt 0 ] && LABELS="$LABELS,severity:warning"
[ "$SUGGESTION_COUNT" -gt 0 ] && LABELS="$LABELS,severity:suggestion"

TITLE="Daily Improvements — $DATE"
if [ "$MODE" = "test-issue" ]; then
  TITLE="[TEST] $TITLE"
  LABELS="$LABELS,test"
fi

# ---- Create issue ----------------------------------------------------------
log "Creating GitHub issue..."
ISSUE_URL=""
set +e
ISSUE_URL="$(gh issue create \
  --title "$TITLE" \
  --label "$LABELS" \
  --body-file "$ISSUE_BODY" 2>"$RUN_DIR/gh-stderr.log")"
GH_EXIT=$?
set -e

if [ "$GH_EXIT" -ne 0 ] || [ -z "$ISSUE_URL" ]; then
  log_err "gh issue create failed. See $RUN_DIR/gh-stderr.log"
  log_run "gh_create_failed" "" "$FINDINGS_COUNT" "$CRITICAL_COUNT"
  exit 1
fi

log "Issue created: $ISSUE_URL"
log_run "ok" "$ISSUE_URL" "$FINDINGS_COUNT" "$CRITICAL_COUNT"
exit 0
