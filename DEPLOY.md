# Deploy Playbook

Produccion corre con esta arquitectura:

```text
GitHub Pages -> Tailscale Funnel/PhilServer -> backend Docker -> Neon Postgres
                                                   \-> Redis Docker
```

El frontend se publica en GitHub Pages. El backend vive en PhilServer con
`docker-compose.backend.yml`, expuesto por Tailscale Funnel. La base real vive en
Neon y Redis corre junto al backend. Este documento existe para que los pushes a
`master` no rompan el build ni vuelvan a asumir Render como destino.

## Regla de oro

**Nunca pushear a `master` sin que `npm run predeploy` pase.** Los errores de tipo no siempre se ven en el editor — sólo `tsc` los garantiza.

## Pre-deploy checklist

```bash
# 1. Sincronizar
git fetch origin && git pull --ff-only origin master

# 2. Un solo comando — corre prisma generate + builds + chequeos:
npm run predeploy

# 3. Si pasa con `✓ predeploy: builds limpios`, push:
git push origin master
```

`npm run predeploy` ejecuta [scripts/predeploy-check.sh](scripts/predeploy-check.sh), que chequea:

1. Archivos untracked importados por código tracked (la trampa de PR #179 / monumentos).
2. `prisma generate && tsc` en backend si tocaste backend/data/prisma.
3. `tsc && vite build` en frontend si tocaste frontend/data.
4. `schema.prisma` modificado sin migración nueva.

Si falla, **no pushees**. Arregla local primero. Para emergencias: `SKIP_PREDEPLOY_CHECK=1 git push …` (documenta por qué en el commit).

### Capas automáticas

No tienes que recordar correr el comando: el repo lo enforza solo.

| Capa | Cuándo dispara | Qué hace |
|---|---|---|
| Hook `Stop` ([.claude/settings.json](.claude/settings.json)) | Cada vez que un agente Claude Code termina turno | `exit 2` → fuerza al agente a resolver bloqueadores antes de cerrar |
| Husky `pre-push` ([.husky/pre-push](.husky/pre-push)) | `git push` (humano, Codex, o cualquier agente) | Aborta el push |
| `npm run predeploy` | Manual | Output en pantalla |

## Errores recurrentes y cómo evitarlos

### 1. Cleanups incompletos rompen consumidores

**Síntoma:** Build falla con `Property 'X' does not exist on type 'Props'` en un archivo distinto al que se modificó.

**Causa real:** Alguien (humano o agente) eliminó una prop de un componente porque "no se usaba", sin grepear los call-sites. Caso real: PR #179 eliminó `compact` de `MechanicsHud` argumentando que no se usaba — pero `FlashGamePage.tsx` sí la pasaba.

**Prevención:**
- Antes de eliminar una prop o un export, correr: `grep -rn "<NombreComponente" frontend/src` y revisar todos los usos.
- Antes de mergear cualquier PR de "cleanup" o "fix lint", correr el build completo.

### 2. Prisma client desincronizado

**Síntoma:** `Property 'duelMatch' does not exist on PrismaClient` o `'isAvailable' does not exist in QuestionWhereInput`.

**Causa real:** Se editó `prisma/schema.prisma` o se agregó migración sin regenerar el cliente local. CI y el build Docker lo regeneran vía `postinstall`, pero localmente queda stale.

**Prevención:**
- Después de editar `schema.prisma` o de hacer `git pull` con migraciones nuevas: `cd backend && npx prisma generate`.
- El `postinstall` ya está en `backend/package.json`, así que en CI/Docker funciona; el problema sólo aparece localmente.

### 3. Trabajar sobre rama desactualizada

**Síntoma:** El error que ves localmente ya está arreglado en `origin/master`, o tu fix entra en conflicto con cambios recientes.

**Causa real:** Hay muchos PRs siendo mergeados en paralelo (varios agentes Claude, codex, etc.). En unas horas se acumulan 10+ commits.

**Prevención:**
- Siempre `git fetch && git pull --ff-only` antes de empezar a trabajar.
- Si llevas más de 2 horas sin sincronizar, vuelve a hacerlo antes de pushear.

### 4. Editor no muestra todos los errores TS

**Síntoma:** El IDE no marca nada en rojo pero `tsc` falla en CI.

**Causa real:** El TS server del editor cachea estado y a veces no revalida archivos cruzados. `tsc` desde cero siempre dice la verdad.

**Prevención:**
- Tratar `npm run build` como la única fuente de verdad pre-push.
- En VS Code: `Cmd+Shift+P → TypeScript: Restart TS Server` cuando cambies archivos compartidos (types, props de componentes).

## Produccion actual

### Frontend: GitHub Pages

El workflow [.github/workflows/deploy-frontend-pages.yml](.github/workflows/deploy-frontend-pages.yml)
corre `npm run ci:quality` y publica `frontend/dist/`.

Variables requeridas del repo:

```bash
VITE_API_URL=https://philserver.mulard-caiman.ts.net/api
VITE_SOCKET_URL=https://philserver.mulard-caiman.ts.net
```

El workflow falla explicitamente si esas variables estan vacias, para evitar
publicar un bundle que intente llamar a `github.io/api`.

### Backend: PhilServer + Tailscale Funnel

El backend se levanta desde `docker-compose.backend.yml` en PhilServer:

```bash
docker compose --env-file .env.backend -f docker-compose.backend.yml up -d --build
```

Variables requeridas en `.env.backend` del servidor:

```bash
DATABASE_URL=<Neon production URL>
JWT_SECRET=<secure random secret>
FRONTEND_URL=https://felipeaurelio13.github.io
BACKEND_LOCAL_PORT=3101
```

Redis es el servicio `redis` del compose y se monta con volumen persistente.
Tailscale Funnel expone HTTPS hacia `http://127.0.0.1:3101`:

```bash
tailscale funnel --https=443 http://127.0.0.1:3101
```

Health check esperado:

```bash
curl https://philserver.mulard-caiman.ts.net/health
```

Antes de levantar un backend con migraciones nuevas, ejecutar contra la DB real:

```bash
docker compose --env-file .env.backend -f docker-compose.backend.yml run --rm backend npx prisma migrate deploy
```

### Backend por SHA

En PhilServer, despliega un commit explícito; no uses `git pull` como paso de deploy:

```bash
DEPLOY_SHA=<sha-validado>
git fetch origin "$DEPLOY_SHA"
git checkout --detach "$DEPLOY_SHA"
printf 'GIT_SHA=%s\n' "$DEPLOY_SHA" >> .env.backend
docker compose --env-file .env.backend -f docker-compose.backend.yml run --rm backend npx prisma migrate deploy
docker compose --env-file .env.backend -f docker-compose.backend.yml up -d --build
curl --fail https://philserver.mulard-caiman.ts.net/health
```

La respuesta de `/health` debe incluir `sha` igual a `DEPLOY_SHA`.

Antes de aplicar la migración `20261012000000_simplify_game_finalization`, revisa Neon:

```sql
SELECT "runId", "gameType", "status", "attempts", "lastError"
FROM "pending_game_finalizations"
WHERE "status" <> 'COMPLETED';
```

Si devuelve filas, no despliegues esa migración: resuelve esos runs con la versión anterior. Si no devuelve filas, la migración elimina la tabla de recovery de forma segura.

## Si el deploy falla

1. Frontend: revisa el run de GitHub Actions y reproduce con `npm --prefix frontend run ci:quality`.
2. Backend: entra a PhilServer y revisa `docker compose --env-file .env.backend -f docker-compose.backend.yml logs backend`.
3. DB/migraciones: confirma `prisma migrate deploy` contra Neon real antes de reiniciar backend.
4. Funnel: valida que `tailscale funnel status` siga apuntando a `http://127.0.0.1:3101`.
5. **No pushees "fix" ciegos sin reproducir el error primero.** Caso real: PR #179 fue un "fix" automatizado que rompió el build en lugar de arreglarlo.

## Anti-patrones detectados en este repo

- Mergear PRs generados por agentes sin correr el build localmente. Varias veces se ha mergeado a `master` un cambio que rompe el deploy.
- "Limpieza de props no usadas" sin grep cross-file. Si una prop está declarada pero no usada **dentro del componente**, sigue pudiendo ser pasada por consumidores — el lint detecta lo primero, no lo segundo.
- Versionar bumps de `package.json` (1.2.86 → 1.2.87) sin que represente un cambio real — confunde el debugging.
- Múltiples agentes editando el mismo working tree. Si tienes dos sesiones de Claude o un agente Codex en paralelo en el mismo directorio, las modificaciones se pisan. Usa worktrees (`git worktree add`) o ramas separadas por sesión.
