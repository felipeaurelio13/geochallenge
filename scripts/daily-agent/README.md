# Daily Improvement Agent

Auditor diario de GeoChallenge. Corre vía `launchd` cada mañana a las **09:00
hora local**, audita el proyecto en dos dimensiones (datos del juego + best
practices externas), y abre **una sola GitHub Issue** con los findings.

Si no hay nada accionable, no abre issue. Si ya hay una issue abierta para hoy,
no la duplica.

## Estructura

```
scripts/daily-agent/
├── run.sh          # entry point (lo que dispara launchd)
├── prompt.md       # prompt estructurado del auditor
├── README.md       # este archivo
├── .gitignore      # ignora runs/ (logs locales)
└── runs/           # artifacts por día (no commiteado)
    ├── log.jsonl   # 1 línea JSON por corrida
    ├── launchd.log # stdout del cron
    ├── launchd.err.log
    └── YYYY-MM-DD/
        ├── context.md          # snapshot git que vio el auditor
        ├── prompt-rendered.md  # prompt con RUN_DIR resuelto
        ├── findings.json       # output estructurado del auditor
        ├── issue-body.md       # markdown que se postea como issue
        ├── claude-output.json  # respuesta cruda de claude -p
        └── claude-stderr.log
```

## Activación inicial (una sola vez)

Hay dos prerequisitos macOS-específicos antes de activar el cron.

### Paso 0 — Token de larga duración para Claude headless

El login OAuth de `claude.ai` (lo que usás interactivamente) **no funciona en
modo headless** — el token no se refresca sin UI y vas a ver
`api_error_status: 401` en `runs/$(date +%F)/claude-output.json`.

Solución: una sola vez, generar un token de larga duración:

```bash
claude setup-token
# seguir las instrucciones interactivas (browser → autorizar → pegar código)
```

Esto guarda credenciales que `claude -p` puede usar sin refresh interactivo.

### Paso 1 — Otorgar Full Disk Access a `/bin/bash`

1. Abrir **System Settings → Privacy & Security → Full Disk Access**
2. Click en `+` (puede pedir Touch ID / password de admin)
3. Cmd+Shift+G y pegar: `/bin/bash`
4. "Open" → activar el toggle de `bash` en la lista
5. (También podés agregar `/bin/zsh` por las dudas)

Esto se hace una sola vez por máquina. No requiere reinicio.

### Paso 2 — Cargar el LaunchAgent

```bash
launchctl load ~/Library/LaunchAgents/com.geochallenge.daily-agent.plist
launchctl list | grep geochallenge
# Debería mostrar:  -  0  com.geochallenge.daily-agent
# Si aparece exit code 126 → falta el Paso 1.
```

### Paso 3 — Smoke test inmediato

```bash
launchctl start com.geochallenge.daily-agent
sleep 90  # darle tiempo a claude
cat scripts/daily-agent/runs/launchd.log
cat scripts/daily-agent/runs/launchd.err.log
tail -1 scripts/daily-agent/runs/log.jsonl | jq .
```

## Pausar el cron (sin borrarlo)

```bash
launchctl unload ~/Library/LaunchAgents/com.geochallenge.daily-agent.plist
```

Para reactivar: `launchctl load ...` de nuevo.

## Forzar una corrida inmediata (ignora el schedule)

```bash
launchctl start com.geochallenge.daily-agent
# logs en runs/launchd.log y runs/launchd.err.log
```

## Correr a mano (sin pasar por launchd)

```bash
# Dry-run: audita pero NO crea issue. Inspeccioná runs/$(date +%F)/
./scripts/daily-agent/run.sh --dry-run

# Test-issue: crea una issue real con prefijo [TEST] y label `test`.
# Útil para validar permisos de gh y formato.
./scripts/daily-agent/run.sh --test-issue

# Producción (lo que corre el cron):
./scripts/daily-agent/run.sh
```

## Inspeccionar la última corrida

```bash
# Resumen de las últimas 7 corridas:
tail -7 scripts/daily-agent/runs/log.jsonl | jq .

# Findings del día:
jq . scripts/daily-agent/runs/$(date +%F)/findings.json

# Markdown que se posteó (o se hubiera posteado):
cat scripts/daily-agent/runs/$(date +%F)/issue-body.md

# Issues abiertas:
gh issue list --label daily-improvement
```

## Cuando algo falla

1. Revisar `runs/launchd.err.log` (errores del cron) o el último entry en `log.jsonl`.
2. Si `status` es `claude_failed` → ver `runs/$(date +%F)/claude-stderr.log`.
3. Si `status` es `gh_create_failed` → ver `runs/$(date +%F)/gh-stderr.log`.
   Probable causa: `gh auth status` expirado → `gh auth refresh`.
4. Si `status` es `preflight_failed_*` → falta `claude`, `gh`, `jq`, `git` o `curl` en el PATH del launchd. Editar `EnvironmentVariables.PATH` en el plist.

## Budget guard

`run.sh` invoca `claude -p --max-budget-usd 3` como límite duro por corrida.
Si los costos reales son consistentemente bajos (esperable: ~$0.10-0.50), se
puede bajar a `--max-budget-usd 1`. Si Claude se queda corto y aborta antes de
terminar, subir a 5.

Tokens por corrida: revisable en `runs/$(date +%F)/claude-output.json` (campo
`usage`).

## Dimensiones cubiertas

| Dimensión | Cómo | Estado |
|---|---|---|
| **Datos del juego** | Sample de monumentos (HEAD a Wikimedia), capitals cross-checked vs web, integridad estructural, propuestas de nuevos monumentos | Día 1 ✅ |
| **Best practices externas** | Changelogs de React/Prisma/Node/Socket.IO, OWASP top 10 actualizado, mapeo al stack | Día 1 ✅ |
| Security & deps | `npm audit`, drift de tipos Frontend↔Zod | Fase 2 (semana 3+) |
| i18n consistencia | Diff es.json ↔ en.json, strings hardcoded | Fase 2 |
| Auto-PR para low-risk | Findings con `auto_pr_safe: true` | Fase 3 (mes 2+) |
| UX/visual + a11y | Playwright + Claude visual eval | Fase 4 |

## Cambiar el horario

Editar `/Users/felipelorca/Library/LaunchAgents/com.geochallenge.daily-agent.plist`,
modificar `StartCalendarInterval.Hour` / `Minute`, luego:

```bash
launchctl unload ~/Library/LaunchAgents/com.geochallenge.daily-agent.plist
launchctl load   ~/Library/LaunchAgents/com.geochallenge.daily-agent.plist
```

## Deshabilitar permanentemente

```bash
launchctl unload ~/Library/LaunchAgents/com.geochallenge.daily-agent.plist
rm ~/Library/LaunchAgents/com.geochallenge.daily-agent.plist
```

`scripts/daily-agent/` puede quedarse en el repo — sin el plist no se dispara
nada automáticamente, y `--dry-run` sigue disponible para corridas manuales.
