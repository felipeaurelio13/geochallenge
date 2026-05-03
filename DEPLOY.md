# Deploy Playbook

Render builds en cada push a `master`. Si el build falla, el sitio se queda con la versión anterior, pero pierdes tiempo y sumas ruido al historial. Este documento existe para que **eso no vuelva a pasar**.

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
2. `prisma generate && tsc` en backend si tocaste backend/data/prisma — espeja exactamente lo que hace Render via `postinstall`.
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

**Causa real:** Se editó `prisma/schema.prisma` o se agregó migración sin regenerar el cliente local. Render lo regenera automáticamente vía `postinstall`, pero localmente queda stale.

**Prevención:**
- Después de editar `schema.prisma` o de hacer `git pull` con migraciones nuevas: `cd backend && npx prisma generate`.
- El `postinstall` ya está en `backend/package.json`, así que en CI/Render funciona; el problema sólo aparece localmente.

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

## Render buildCommand

Lo que Render corre en cada push (definido en `render.yaml`):

| Servicio | Build | Start |
|---|---|---|
| Frontend | `npm install && npm run build` | sirve `dist/` |
| Backend | `npm install && npm run build` | `npm start` (con `npx prisma migrate deploy` pre-deploy) |

`npm install` dispara el `postinstall` del backend (`prisma generate`), por eso en CI funciona aunque localmente esté stale.

## Si el deploy falla

1. Lee el log completo en Render — el error real suele estar arriba, no en las últimas líneas.
2. Reproduce localmente: `cd frontend && npm run build` (o backend).
3. Arregla, **vuelve a correr `npm run build`** para confirmar, push.
4. **No pushees "fix" ciegos sin reproducir el error primero.** Caso real: PR #179 fue un "fix" automatizado que rompió el build en lugar de arreglarlo.

## Anti-patrones detectados en este repo

- Mergear PRs generados por agentes sin correr el build localmente. Varias veces se ha mergeado a `master` un cambio que rompe el deploy.
- "Limpieza de props no usadas" sin grep cross-file. Si una prop está declarada pero no usada **dentro del componente**, sigue pudiendo ser pasada por consumidores — el lint detecta lo primero, no lo segundo.
- Versionar bumps de `package.json` (1.2.86 → 1.2.87) sin que represente un cambio real — confunde el debugging.
- Múltiples agentes editando el mismo working tree. Si tienes dos sesiones de Claude o un agente Codex en paralelo en el mismo directorio, las modificaciones se pisan. Usa worktrees (`git worktree add`) o ramas separadas por sesión.
