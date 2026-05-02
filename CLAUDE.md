# GeoChallenge

## Deploy

**Antes de cualquier push a `master`, correr `npm run build` en `frontend/` y `backend/`.**
Render builds en cada push y un fail rompe deploy. Ver [DEPLOY.md](DEPLOY.md) para el checklist completo y los anti-patrones recurrentes (cleanups que rompen consumidores, Prisma client stale, etc.).

## Definition of done (obligatorio para agentes)

Cualquier tarea que toque `frontend/`, `backend/`, `data/` o `backend/prisma/` no se considera terminada hasta que `npm run predeploy` pase con `✓ predeploy: builds limpios`.

El script ([scripts/predeploy-check.sh](scripts/predeploy-check.sh)) verifica los tres errores que históricamente rompen Render:

1. **Untracked source importado por código tracked** — la trampa de PR #179 y del trabajo de monumentos. `tsc` local pasa porque el archivo existe en disco; Render falla porque nunca llegó al remote.
2. **Type errors** — `tsc && vite build` en frontend, `tsc` en backend. Sólo corre lo que cambió.
3. **`schema.prisma` sin migración** — Prisma client se desincroniza del esquema deployado.

Antes de declarar una tarea terminada o de pedir review, el agente debe:

- [ ] `npm run predeploy` (o esperar a que el hook `Stop` lo dispare automáticamente).
- [ ] Si falla, **arreglar** antes de cerrar turno. No documentar el error y seguir.
- [ ] Si los archivos untracked son intencionalmente no-deployables, agregarlos a `.gitignore`.

Capas de defensa instaladas:

| Capa | Cuándo dispara | Cómo bloquea |
|---|---|---|
| Hook `Stop` ([.claude/settings.json](.claude/settings.json)) | Cada vez que el agente termina turno | `exit 2` → el agente debe responder al error antes de cerrar |
| Husky `pre-push` ([.husky/pre-push](.husky/pre-push)) | `git push` (humano o agente) | Aborta el push |
| `npm run predeploy` | Manual | Output en pantalla |

Si necesitas saltarte el chequeo en una emergencia: `SKIP_PREDEPLOY_CHECK=1 git push …`. Documenta por qué en el commit message.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
