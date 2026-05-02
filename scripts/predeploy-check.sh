#!/usr/bin/env bash
# predeploy-check — verifica que el working tree no rompa el deploy en Render.
#
# Funciona como:
#   1) Hook Stop de Claude Code (.claude/settings.json) — bloquea con exit 2 si hay riesgo.
#   2) Hook git pre-push (.husky/pre-push)             — bloquea el push.
#   3) Script manual (`npm run predeploy`)             — chequeo on-demand.
#
# Chequea:
#   1) Archivos untracked importados por código tracked (la trampa de PR #179 / monumentos).
#   2) `tsc && vite build` en frontend si hay cambios en frontend/ o data/.
#   3) `tsc` en backend si hay cambios en backend/ o data/ o prisma/.
#   4) `schema.prisma` modificado sin migración nueva.
#
# Escape hatches:
#   SKIP_PREDEPLOY_CHECK=1  saltarse todo (úsalo sólo si sabes lo que haces).

set -euo pipefail

# Re-entry guard: si Stop hook ya disparó este turno, no entres en loop.
if [ ! -t 0 ]; then
  HOOK_INPUT=$(cat || true)
  if echo "$HOOK_INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    exit 0
  fi
fi

if [ "${SKIP_PREDEPLOY_CHECK:-0}" = "1" ]; then
  exit 0
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$ROOT" ]; then
  exit 0
fi
cd "$ROOT"

red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green()  { printf '\033[32m%s\033[0m\n' "$*" >&2; }
yellow() { printf '\033[33m%s\033[0m\n' "$*" >&2; }

# ¿Qué se movió?
FRONTEND_CHANGED=$(git status --porcelain -- frontend 2>/dev/null || true)
BACKEND_CHANGED=$(git status --porcelain -- backend 2>/dev/null || true)
DATA_CHANGED=$(git status --porcelain -- data 2>/dev/null || true)
PRISMA_CHANGED=$(git status --porcelain -- backend/prisma 2>/dev/null || true)

# Working tree limpio en zonas relevantes → silencio total.
if [ -z "$FRONTEND_CHANGED$BACKEND_CHANGED$DATA_CHANGED" ]; then
  exit 0
fi

errors=0
LOG_DIR=${TMPDIR:-/tmp}

# ── 1) Untracked source: el bug-killer de este repo ────────────────────────────
# Estos paths son los que un push a master sí o sí debe llevar.
UNTRACKED=$(git ls-files --others --exclude-standard -- \
  frontend/src backend/src backend/prisma/migrations data 2>/dev/null || true)
if [ -n "$UNTRACKED" ]; then
  red "✗ Archivos untracked en directorios que sí se deployean:"
  echo "$UNTRACKED" | sed 's/^/    /' >&2
  red "  Si commiteas sin estos archivos, el build de Render falla."
  red "  Acción: 'git add' los que correspondan, o agrégalos a .gitignore."
  errors=$((errors+1))
fi

# ── 2) Build frontend ─────────────────────────────────────────────────────────
if [ -n "$FRONTEND_CHANGED$DATA_CHANGED" ]; then
  yellow "→ frontend: tsc && vite build"
  if ! (cd frontend && npm run build) >"$LOG_DIR/predeploy-frontend.log" 2>&1; then
    red "✗ frontend build falló (últimas 30 líneas, log completo: $LOG_DIR/predeploy-frontend.log):"
    tail -30 "$LOG_DIR/predeploy-frontend.log" >&2
    errors=$((errors+1))
  fi
fi

# ── 3) Build backend ──────────────────────────────────────────────────────────
if [ -n "$BACKEND_CHANGED$DATA_CHANGED$PRISMA_CHANGED" ]; then
  yellow "→ backend: tsc"
  if ! (cd backend && npm run build) >"$LOG_DIR/predeploy-backend.log" 2>&1; then
    red "✗ backend build falló (últimas 30 líneas, log completo: $LOG_DIR/predeploy-backend.log):"
    tail -30 "$LOG_DIR/predeploy-backend.log" >&2
    errors=$((errors+1))
  fi
fi

# ── 4) schema.prisma sin migración ────────────────────────────────────────────
if echo "$PRISMA_CHANGED" | grep -q 'schema\.prisma'; then
  if ! git status --porcelain -- backend/prisma/migrations 2>/dev/null | grep -q .; then
    red "✗ schema.prisma cambió pero no hay migración nueva en backend/prisma/migrations."
    red "  Acción: cd backend && npx prisma migrate dev --name <descripcion>"
    errors=$((errors+1))
  fi
fi

if [ "$errors" -gt 0 ]; then
  red "✗ predeploy: $errors bloqueador(es). Resuelve antes de declarar la tarea terminada."
  exit 2
fi

green "✓ predeploy: builds limpios, sin untracked, sin schema huérfano."
exit 0
