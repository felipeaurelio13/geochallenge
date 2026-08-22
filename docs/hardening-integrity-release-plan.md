# GeoChallenge - Plan por fases de hardening de integridad, concurrencia y release

## Proposito

Este documento convierte el plan de hardening recomendado en una guia incremental para implementar por fases. El objetivo es corregir riesgos de integridad, consistencia, concurrencia, durabilidad, seguridad de sesiones y release sin agregar features ni redisenos visuales.

La auditoria original toma como referencia el commit `83b6f2c001fdc08b71235a296c27dadb591f07c2`, pero siempre debe mandar el codigo actual de `master`.

## Principios de ejecucion

- Implementar en PRs pequenos, revisables y reversibles.
- Sincronizar antes de empezar cada fase: `git fetch origin` y `git pull --ff-only origin master`.
- Registrar el SHA base de `master` al inicio de cada fase.
- Revisar si el hallazgo ya fue corregido antes de tocar codigo.
- No reimplementar una solucion ya correcta.
- Preferir invariantes en Postgres/Redis y operaciones atomicas sobre locks locales en memoria.
- Mantener compatibilidad de API salvo que el cambio la requiera explicitamente.
- No cambiar UX salvo para representar errores, retry o estados transitorios reales.
- No tocar GeoRetos V2, World Event, contenido de preguntas, formula Elo ni semantica de leaderboards salvo evidencia directa de necesidad.
- Cada correccion de concurrencia debe tener un test que reproduzca la carrera.

## Buenas practicas transversales

### Integridad de scoring

- El servidor debe ser la autoridad para todo dato que impacte score persistente o competitivo.
- El frontend puede enviar datos de tiempo para UI o telemetria, pero no para calcular puntos.
- Centralizar el calculo de tiempo efectivo en una abstraccion pequena, por ejemplo `startedAt`, `deadlineAt` y `durationMs`.
- Usar `clamp(deadlineAt - now, 0, durationMs)` y cuidar conversiones segundos/milisegundos.
- Evitar crear timers de todas las preguntas al crear una sesion si las preguntas se muestran secuencialmente.
- Si se agrega `start-question`, debe ser idempotente, vinculado a `sessionId + questionId`, y la primera llamada debe ganar.

### Respuestas e idempotencia

- Definir una fuente canonica por flujo.
- Para Single, las respuestas aceptadas deben vivir en una estructura Redis explicita por sesion, no en una copia secundaria mutable.
- Usar operaciones first-wins atomicas como `HSETNX`, `SET NX` o Lua cuando la abstraccion no exponga la primitiva.
- `/finish` debe leer la fuente canonica, no datos best-effort.
- Una respuesta aceptada por `/answer` debe ser visible para `/finish` mientras la sesion siga vigente.

### Concurrencia

- No usar mutex JS local para proteger recursos compartidos de producto.
- En Postgres, preferir transacciones, constraints, `updateMany` compare-and-set, isolation `SERIALIZABLE` o advisory locks cuando corresponda.
- Las transiciones de estado deben tener precondiciones explicitas: por ejemplo `ACCEPTED -> COMPLETED`.
- Los side effects de stats, rating y wins/losses deben ejecutarse solo por la request que reclame la transicion final.
- Los requests que pierdan la carrera deben devolver estado final consistente sin duplicar efectos.

### Durabilidad

- No eliminar estado recuperable en memoria antes de que exista una representacion durable suficiente para reintentar.
- Usar `runId` estable para idempotencia de finalizaciones y resultados.
- Si una persistencia falla despues de mostrar resultado al usuario, debe quedar una finalizacion pendiente recuperable.
- El recovery al arrancar backend debe procesar pendientes con retry idempotente.
- Evitar colas externas o infraestructura nueva si Postgres alcanza para guardar pendientes.

### Seguridad de sesiones

- Password reset y cambio de password deben invalidar JWT previos.
- Incluir `authVersion` en JWT y compararlo contra el usuario actual.
- Un token invalido, expirado o revocado debe responder `401`.
- Reservar `403` para usuarios autenticados sin permiso.
- En frontend, separar estado anonimo de errores transitorios de verificacion.

### CI, release y operacion

- `npm run predeploy` debe seguir siendo la compuerta local antes de push a `master`.
- Los tests de integracion criticos deben correr contra Postgres y Redis reales.
- El frontend no debe publicarse si falla Playwright/E2E relevante.
- Versionar contrato API con un entero explicito, no con semver de `package.json`.
- Startup debe conectar dependencias y escuchar; no debe modificar datasets o reconstruir leaderboards por defecto.
- Logs estructurados deben incluir contexto operativo sin filtrar JWT, passwords, respuestas correctas ni detalles sensibles.
- `/health` debe reportar estado degradado sin exponer mensajes internos de error.

## Fase 0 - Preparacion y auditoria del estado actual

### Objetivo

Confirmar el estado real del repo antes de implementar y dividir el trabajo en PRs seguros.

### Pasos

1. Sincronizar con `origin/master`.
2. Registrar SHA actual de `master`.
3. Revisar los flujos afectados y marcar hallazgos ya corregidos.
4. Identificar archivos de alto riesgo: scoring, Redis session store, Challenge, Duel, Survival, auth, Daily, workflows y deploy.
5. Definir el scope exacto del primer PR.

### Salida esperada

- Lista de hallazgos aplicables.
- Lista de hallazgos descartados con evidencia archivo/linea.
- Plan de PRs por fase.

## Fase 1 - Integridad fundamental

### Alcance

1. Timing server-authoritative.
2. Redis como fuente de verdad para respuestas Single.
3. Finish parcial con denominador correcto.
4. Flag Master fail-fast cuando Redis no persiste sesion.

### Implementacion recomendada

- Crear una utilidad pequena de timing server-side reutilizable por los modos afectados.
- Agregar o adaptar un mecanismo de `question started` first-wins para Single/Streak/Flash si el flujo actual lo requiere.
- En Duel y Survival, reutilizar el instante server-side en que se emite la pregunta.
- En Flag Master, guardar el inicio server-side por pregunta y no usar `timeRemaining` del cliente para score.
- En Challenge asincrono, eliminar el bonus de tiempo y alinear backend/frontend para que el score mostrado coincida con el persistido.
- Migrar respuestas Single a una estructura Redis por sesion, preferentemente `game:answers:<sessionId>` como hash `questionId -> JSON(result)`.
- Hacer que `/answer`, re-answer, `/finish`, combo Flash y checks post-answer lean la misma fuente canonica.
- En `/finish`, conservar `expectedQuestions` y `answeredQuestions`. Para modos de tamano fijo, no registrar una partida truncada como perfecta.
- Cambiar Flag Master `/start` para responder `503 GAME_STATE_UNAVAILABLE` si Redis no guarda la sesion.

### Tests minimos

- Cliente manda `timeRemaining` maximo despues de esperar y el score usa tiempo servidor.
- Repetir `start-question` no reinicia timer.
- Duel non-rated no confia en tiempo cliente.
- Survival no confia en tiempo cliente.
- Flag Master no confia en tiempo cliente.
- Challenge ignora el tiempo cliente.
- Primera respuesta Single gana frente a re-answer o concurrencia.
- `/finish` usa exactamente la primera respuesta canonica.
- Respuestas concurrentes de distintas preguntas no se pisan.
- Sesion de 10 preguntas con 5 respondidas no queda como 5/5 perfect.
- Flag Master start falla con Redis caido.

### Criterios de salida

- Ningun score persistente competitivo depende de `timeRemaining` controlado por cliente.
- `/answer` aceptado implica que `/finish` puede ver la respuesta canonica.
- `PERFECT_GAME` requiere partida esperada completa.
- Tests de backend relevantes pasan.

## Fase 2 - Challenges

### Alcance

1. Transicion `PENDING -> ACCEPTED` al abrir preguntas.
2. Join atomico.
3. Cierre atomico e idempotente.

### Implementacion recomendada

- En `getChallengeQuestions`, hacer una transicion explicita cuando el challenge esta lleno y usar el estado actualizado en la misma request.
- Proteger join con una solucion multi-instancia: transaccion `SERIALIZABLE`, advisory lock de Postgres o constraint/transicion equivalente.
- En submit final, guardar el resultado individual idempotentemente dentro de una transaccion.
- Reclamar el cierre con compare-and-set `ACCEPTED -> COMPLETED`.
- Ejecutar actualizaciones de `gamesPlayed`, `wins`, `losses` y `winner` solo si `claimed.count === 1`.

### Tests minimos

- Challenge `PENDING`, `maxPlayers = 2`, 2 participantes, `GET questions` devuelve 200, transiciona a `ACCEPTED` y retorna preguntas.
- Challenge con un cupo disponible recibe dos joins concurrentes: uno entra y uno recibe `CHALLENGE_FULL`.
- Dos submits finales concurrentes dejan `COMPLETED` una vez y no duplican stats.

### Criterios de salida

- Nunca existe `participantsCount > maxPlayers`.
- El primer acceso a preguntas despues de llenarse no requiere retry del cliente.
- El cierre ocurre exactamente una vez.

## Fase 3 - Durabilidad multiplayer

### Alcance

1. Finalizacion durable de Duel.
2. Finalizacion durable de Survival.

### Implementacion recomendada

- Reutilizar la idempotencia existente de Duel por `runId`.
- Agregar `runId` estable a Survival si falta, por ejemplo `<survivalMatchId>:<userId>`.
- Crear la minima representacion durable necesaria en Postgres antes de limpiar estado recuperable.
- Reintentar persistencia con backoff pequeno cuando sea razonable, sin bloquear indefinidamente la UX.
- Procesar finalizaciones pendientes al arrancar backend.

### Tests minimos

- Fallo DB al finalizar Duel deja finalizacion pendiente durable.
- Retry de Duel crea exactamente un `DuelMatch`, un `GameResult` por jugador y aplica rating una vez.
- Fallo DB al finalizar Survival deja pendiente durable.
- Retry de Survival crea exactamente un `SurvivalMatch` y un `GameResult` por jugador.

### Criterios de salida

- Un resultado mostrado al usuario puede recuperarse despues de una falla de DB.
- Retry no duplica resultados, stats ni rating.

## Fase 4 - Auth y Daily

### Alcance

1. Revocacion JWT con `authVersion`.
2. Estado auth transitorio en frontend.
3. `dayKey` de Daily determinado por servidor.

### Implementacion recomendada

- Agregar `authVersion Int @default(0)` a `User`.
- Incluir `authVersion` en JWT.
- En middleware auth, comparar JWT contra version actual del usuario.
- Incrementar `authVersion` al resetear o cambiar password.
- En frontend, modelar un estado como `loading`, `authenticated`, `anonymous` y `temporarily-unverified`.
- En 401, limpiar token y pasar a `anonymous`.
- En network timeout, 429 o 5xx, conservar token y mostrar retry sin redirigir a login.
- En Daily, calcular dia server-side usando timezone IANA u offset si el cliente lo envia.
- Rechazar fechas futuras y evitar que `lastDailyDate` retroceda.

### Tests minimos

- Token A funciona, password reset incrementa version, token A responde 401, token B nuevo funciona.
- Fallo transitorio de `/auth/me` no borra token ni fuerza login.
- Daily con UTC, America/Santiago, medianoche, D+1 rechazado y D-1 sin retroceso de streak.

### Criterios de salida

- Password reset invalida sesiones anteriores.
- Errores transitorios de red no simulan logout.
- El cliente no puede adelantar el dia ni retroceder `lastDailyDate`.

## Fase 5 - CI y release seguro

### Alcance

1. Infraestructura de integration tests con Postgres y Redis reales.
2. Version de contrato API.
3. E2E bloqueando deploy frontend.
4. Smoke tests.

### Implementacion recomendada

- Agregar `npm run test:integration` en backend.
- Configurar services de PostgreSQL y Redis en GitHub Actions.
- Crear DB limpia y ejecutar `prisma migrate deploy` antes de integration tests.
- Agregar `GET /api/version` con `apiVersion`, `appVersion` y `commitSha`.
- Definir `API_CONTRACT_VERSION` en backend y `MIN_SUPPORTED_API_VERSION` en frontend.
- Mostrar una pantalla clara si backend no cumple contrato minimo.
- Hacer que deploy de Pages dependa de los checks relevantes, incluido Playwright/E2E.
- Agregar smoke test para frontend URL, backend `/ping` y backend `/api/version`.

### Tests minimos

- Redis real: first-wins de respuestas, first-wins de question start, Redis unavailable y respuestas concurrentes.
- Postgres real: migrations desde cero, Challenge concurrent join, Challenge concurrent finish, Duel retry, Survival retry y JWT `authVersion`.

### Criterios de salida

- CI cubre las invariantes criticas con infraestructura real.
- Frontend no se publica si E2E falla.
- Frontend detecta backend incompatible antes de entrar a flujos rotos.

## Fase 6 - Simplificacion y operacion

### Alcance

1. Performance simple.
2. Startup limpio.
3. Observabilidad minima.
4. Limpiezas menores de release.

### Implementacion recomendada

- En `getQuestionsForGame`, eliminar query redundante de `MIXED`.
- Eliminar `questionsCache` solo si esta muerto y no tiene consumidores.
- Optimizar leaderboard de competencia con ranking SQL/window si Prisma lo permite de forma clara, preservando reglas de orden/rank.
- Extraer `ensureCinemaGeoQuestions()` del startup automatico a un comando explicito como `npm run sync:cinema-geo`.
- Mantener rebuild de leaderboards como comando administrativo explicito, no default de startup.
- Alinear Node de CI con produccion si produccion usa Node 22.
- Hacer que predeploy ejecute tests backend cuando hubo cambios backend.
- Implementar logger estructurado ligero, preferentemente `pino` si no existe equivalente.
- Loggear `timestamp`, `level`, `requestId`, `method`, `path`, `status`, `durationMs`, `userId` y `runId` cuando corresponda.
- Agregar eventos `game_finalization_failed`, `game_finalization_recovered`, `redis_unavailable` y `challenge_concurrency_conflict`.
- Ajustar `/health` para no exponer `error.message` interno.
- Actualizar `DEPLOY.md` solo para reflejar workflows existentes y una fuente de verdad de migraciones.

### Tests minimos

- Ranking conserva exactamente la semantica previa.
- Startup no ejecuta jobs destructivos por defecto.
- `/health` degrada sin filtrar detalles internos.
- Logger no incluye secretos ni respuestas correctas.

### Criterios de salida

- Startup hace solo conexion, validacion de dependencias y listen.
- Operacion tiene logs utiles sin datos sensibles.
- Documentacion de deploy refleja el estado real.

## Validacion obligatoria por fase

Ejecutar checks proporcionales al scope. Para backend:

```bash
cd backend
npx prisma generate
npm run lint
npm run test
npm run test:integration
npm run build
```

Para frontend:

```bash
cd frontend
npm run lint
npm run test
npm run build
npm run test:e2e
```

Antes de push a `master`:

```bash
npm run predeploy
```

Si una fase agrega infraestructura de integration tests, documentar como levantar Postgres/Redis localmente y no declarar terminada la fase con tests rojos.

## Revision final antes de cerrar una fase

- Revisar `git diff` completo.
- Buscar cambios accidentales fuera de scope.
- Revisar todos los writes nuevos o modificados de `GameResult`, `Challenge`, `ChallengeParticipant`, `DuelMatch`, `CompetitiveRating`, `SurvivalMatch`, `User.gamesPlayed`, `User.wins`, `User.losses` y `User.highScore`.
- Comprobar idempotencia de cada finish.
- Confirmar que no hay read-modify-write no atomicos en flujos criticos nuevos.
- Confirmar que frontend y backend muestran el mismo scoring efectivo.
- Confirmar que no se filtran `correctAnswer` ni coordenadas antes de responder.
- Confirmar que GeoRetos V2 y World Event no fueron afectados accidentalmente.

## Formato recomendado de entrega por fase

Cada fase deberia cerrarse con esta estructura:

```text
Estado: IMPLEMENTADO / PARCIAL / BLOQUEADO
SHA base:
SHA final:

Cambios de produccion:
| Area | Archivo(s) | Cambio |
| ---- | ---------- | ------ |

Migraciones:
- <migracion o "ninguna">

Tests nuevos:
- <test>: <riesgo cubierto>

Validacion:
- backend lint:
- backend unit:
- backend integration:
- backend build:
- frontend lint:
- frontend unit:
- frontend e2e:
- frontend build:
- predeploy:

Hallazgos descartados:
- <hallazgo>: <por que no aplica>, <evidencia archivo/linea>

Riesgos restantes:
- <riesgo real aun abierto>

Rollback:
- <comando o estrategia de revert>
```

## Orden recomendado de PRs

1. Fase 0: auditoria actual y scope de PRs.
2. Fase 1a: timing server-authoritative.
3. Fase 1b: respuestas Single canonicas y finish parcial.
4. Fase 1c: Flag Master fail-fast.
5. Fase 2a: Challenge `PENDING -> ACCEPTED`.
6. Fase 2b: Challenge join atomico.
7. Fase 2c: Challenge cierre atomico.
8. Fase 3a: Duel durable finalization.
9. Fase 3b: Survival durable finalization.
10. Fase 4a: `authVersion`.
11. Fase 4b: auth frontend transitorio.
12. Fase 4c: Daily dayKey server-side.
13. Fase 5a: integration tests reales.
14. Fase 5b: API contract version.
15. Fase 5c: E2E deploy gate y smoke tests.
16. Fase 6a: performance simple.
17. Fase 6b: startup limpio.
18. Fase 6c: logging, health y docs.

## Riesgos principales

- El timing server-authoritative es el cambio mas delicado: no debe reemplazarse `timeRemaining` por otro valor controlado por frontend.
- Agregar integration tests puede requerir ajustar CI y entorno local; mantener la suite chica y valiosa.
- Las migraciones de auth/durabilidad deben revisarse con cuidado para no romper usuarios existentes.
- Los cambios de Challenge pueden tocar stats historicas; todo side effect debe quedar protegido por idempotencia.

## Rollback general

- Revertir por PR/fase, no por mega revert.
- Para cambios con migracion, documentar si la migracion es reversible o si requiere una migracion compensatoria.
- Mantener cambios aditivos cuando sea posible para poder desactivar el uso nuevo sin perder compatibilidad.
- Si una fase falla en produccion, priorizar restaurar comportamiento previo de API y bloquear temporalmente el flujo afectado antes que aplicar cambios amplios no validados.
