#!/usr/bin/env bash
# Pre-flight collectors for the daily improvement agent.
# Produces machine-readable inputs that Claude reads as context, so we don't
# burn API budget on work that bash + jq + ripgrep can do in seconds.
#
# Called by run.sh after the context snapshot, before the Claude invocation.
# All output goes under "$RUN_DIR/inputs/". Each collector writes a JSON file
# with a `status` field ("ok" / "error" / "skipped") so the auditor can decide
# whether to use it.
#
# Usage: collectors.sh <REPO_ROOT> <RUN_DIR>

set -uo pipefail

REPO_ROOT="${1:?REPO_ROOT required}"
RUN_DIR="${2:?RUN_DIR required}"
INPUTS_DIR="$RUN_DIR/inputs"

mkdir -p "$INPUTS_DIR"

clog() { echo "[collector] $*"; }

# ---------------------------------------------------------------------------
# Collector 1 — npm audit (frontend + backend)
# ---------------------------------------------------------------------------
# `npm audit --json` exits non-zero when vulns exist. We swallow the exit code
# and just keep the JSON.
collect_npm_audit() {
  local proj="$1"
  local out="$INPUTS_DIR/npm-audit-$proj.json"
  if [ ! -f "$REPO_ROOT/$proj/package-lock.json" ]; then
    jq -n --arg proj "$proj" '{status:"skipped",reason:"no package-lock.json",project:$proj}' > "$out"
    return
  fi
  clog "npm audit ($proj)..."
  local raw
  raw=$(cd "$REPO_ROOT/$proj" && npm audit --json 2>/dev/null || true)
  if [ -z "$raw" ] || ! echo "$raw" | jq empty 2>/dev/null; then
    jq -n --arg proj "$proj" '{status:"error",reason:"npm audit produced invalid output",project:$proj}' > "$out"
    return
  fi
  # Slim the output: keep only summary + per-package list of top severities.
  # The raw audit can be 100KB+; we want < 5KB to fit Claude context cheaply.
  echo "$raw" | jq --arg proj "$proj" '{
    status: "ok",
    project: $proj,
    vulnerabilities_summary: .metadata.vulnerabilities,
    total_dependencies: .metadata.totalDependencies,
    high_or_critical: [
      .vulnerabilities // {} | to_entries[] |
      select(.value.severity == "high" or .value.severity == "critical") |
      {name: .key, severity: .value.severity, via: ([.value.via[]? | if type == "object" then .title else . end] | unique), fix_available: (.value.fixAvailable // false)}
    ] | sort_by(.severity, .name)
  }' > "$out"
}

# ---------------------------------------------------------------------------
# Collector 2 — i18n drift (keys in es.json missing in en.json and vice versa)
# ---------------------------------------------------------------------------
collect_i18n_drift() {
  local out="$INPUTS_DIR/i18n-drift.json"
  local es="$REPO_ROOT/frontend/src/i18n/es.json"
  local en="$REPO_ROOT/frontend/src/i18n/en.json"
  if [ ! -f "$es" ] || [ ! -f "$en" ]; then
    jq -n '{status:"skipped",reason:"missing es.json or en.json"}' > "$out"
    return
  fi
  clog "i18n drift..."
  # Flatten nested keys with jq into "a.b.c" form, diff the two key sets.
  local tmp; tmp=$(mktemp -d)
  jq -r 'paths(scalars) | map(if type == "number" then tostring else . end) | join(".")' "$es" 2>/dev/null | sort -u > "$tmp/es"
  jq -r 'paths(scalars) | map(if type == "number" then tostring else . end) | join(".")' "$en" 2>/dev/null | sort -u > "$tmp/en"
  comm -23 "$tmp/es" "$tmp/en" > "$tmp/missing_in_en"
  comm -13 "$tmp/es" "$tmp/en" > "$tmp/missing_in_es"
  # Convert plain-text lists (one key per line) to JSON arrays. Empty input → [].
  jq -R . < "$tmp/missing_in_en" | jq -s . > "$tmp/missing_in_en.json"
  jq -R . < "$tmp/missing_in_es" | jq -s . > "$tmp/missing_in_es.json"
  jq -n \
    --argjson total_es "$(wc -l < "$tmp/es" | tr -d ' ')" \
    --argjson total_en "$(wc -l < "$tmp/en" | tr -d ' ')" \
    --slurpfile missing_in_en "$tmp/missing_in_en.json" \
    --slurpfile missing_in_es "$tmp/missing_in_es.json" \
    '{
      status: "ok",
      total_keys_es: $total_es,
      total_keys_en: $total_en,
      missing_in_en: ($missing_in_en[0] // []),
      missing_in_es: ($missing_in_es[0] // []),
      missing_in_en_count: (($missing_in_en[0] // []) | length),
      missing_in_es_count: (($missing_in_es[0] // []) | length)
    }' > "$out"
  rm -rf "$tmp"
}

# ---------------------------------------------------------------------------
# Collector 3 — old TODO/FIXME/XXX comments
# ---------------------------------------------------------------------------
# Uses git blame to age each TODO. Anything older than 90 days is "stale".
collect_old_todos() {
  local out="$INPUTS_DIR/old-todos.json"
  clog "old TODOs..."
  local cutoff_days=90
  local cutoff_epoch
  cutoff_epoch=$(date -v-${cutoff_days}d +%s 2>/dev/null || date -d "${cutoff_days} days ago" +%s 2>/dev/null || echo 0)

  cd "$REPO_ROOT"
  # Find TODO/FIXME/XXX in tracked source files only (skip node_modules, dist).
  local matches
  matches=$(git grep -nIE '(TODO|FIXME|XXX)[(:[:space:]]' \
    -- 'frontend/src/**/*.{ts,tsx,js,jsx,css,scss}' \
       'backend/src/**/*.ts' \
       'scripts/**/*.sh' \
    2>/dev/null | head -100)

  if [ -z "$matches" ]; then
    jq -n '{status:"ok",total:0,stale:[]}' > "$out"
    return
  fi

  # For each match, get the commit timestamp of that line.
  local entries="[]"
  while IFS= read -r line; do
    local file lineno content
    file="${line%%:*}"
    local rest="${line#*:}"
    lineno="${rest%%:*}"
    content="${rest#*:}"
    # Skip if file no longer exists.
    [ -f "$file" ] || continue
    local ts
    ts=$(git log -1 --pretty=format:'%ct' -L "${lineno},${lineno}:${file}" 2>/dev/null | head -1)
    [ -z "$ts" ] && continue
    if [ "$ts" -lt "$cutoff_epoch" ]; then
      local age_days
      age_days=$(( ($(date +%s) - ts) / 86400 ))
      local entry
      entry=$(jq -cn \
        --arg file "$file" \
        --arg line "$lineno" \
        --arg content "$(echo "$content" | tr -d '\r' | cut -c1-120)" \
        --arg age "$age_days" \
        '{file:$file,line:($line|tonumber),content:$content,age_days:($age|tonumber)}')
      entries=$(echo "$entries" | jq --argjson e "$entry" '. + [$e]')
    fi
  done <<< "$matches"

  echo "$entries" | jq --arg cutoff "$cutoff_days" '{
    status: "ok",
    cutoff_days: ($cutoff | tonumber),
    stale: sort_by(-.age_days) | .[:20],
    total: length
  }' > "$out"
}

# ---------------------------------------------------------------------------
# Collector 4 — dep version drift snapshot
# ---------------------------------------------------------------------------
# Just snapshots the installed versions so the auditor doesn't have to read
# both package.json files separately.
collect_dep_versions() {
  local out="$INPUTS_DIR/dep-versions.json"
  clog "dep versions..."
  local fe be
  fe=$(jq '{name, version, dependencies, devDependencies}' "$REPO_ROOT/frontend/package.json" 2>/dev/null || echo 'null')
  be=$(jq '{name, version, dependencies, devDependencies}' "$REPO_ROOT/backend/package.json" 2>/dev/null || echo 'null')
  jq -n --argjson fe "$fe" --argjson be "$be" '{status:"ok",frontend:$fe,backend:$be}' > "$out"
}

# ---------------------------------------------------------------------------
# Collector 5 — index of inputs (so the prompt can enumerate available files)
# ---------------------------------------------------------------------------
write_index() {
  local out="$INPUTS_DIR/INDEX.json"
  cd "$INPUTS_DIR"
  ls -1 *.json 2>/dev/null | grep -v '^INDEX.json$' | jq -R . | jq -s '{files: ., generated_at: now | todate}' > "$out"
}

# ---------------------------------------------------------------------------
# Run all collectors. Each is wrapped so a failure doesn't kill the others.
# ---------------------------------------------------------------------------
run_safe() {
  local name="$1"; shift
  set +e
  "$@"
  local rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    clog "WARN: $name failed with rc=$rc"
  fi
}

run_safe "npm audit (frontend)" collect_npm_audit frontend
run_safe "npm audit (backend)"  collect_npm_audit backend
run_safe "i18n drift"           collect_i18n_drift
run_safe "old todos"            collect_old_todos
run_safe "dep versions"         collect_dep_versions
write_index

clog "done. $(ls -1 "$INPUTS_DIR" | wc -l | tr -d ' ') files in $INPUTS_DIR"
