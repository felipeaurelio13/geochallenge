# Plan de Empatía con el Usuario — GeoChallenge

> **Propósito de este documento:** plan de implementación detallado para que un agente de IA (u otro desarrollador) ejecute las mejoras de empatía detectadas en la auditoría de julio 2026. Cada tarea incluye: archivos exactos, comportamiento actual verificado (con `archivo:línea`), cambio requerido y criterios de aceptación.
>
> **Origen:** auditoría de 5 dimensiones sobre el código real — (1) manejo de errores y resiliencia, (2) copy/tono/i18n, (3) accesibilidad, (4) diseño emocional de journeys, (5) estados de carga y feedback. Todos los hallazgos críticos fueron verificados contra el código fuente.

---

## 0. Diagnóstico ejecutivo

La plataforma tiene buena infraestructura (offline cache, ServerWakeUp explicativo, focus trap en modales, haptics, reintentos con backoff) pero presenta un **gradiente de tono invertido**: celebra las victorias con calidez y trata las derrotas, errores y esperas con frialdad — exactamente al revés de lo que pide la psicología de retención. Los 6 problemas más graves:

1. **No existe recuperación de contraseña** — el usuario que la olvida pierde su cuenta (la clave i18n `auth.forgotPassword` existe, pero no hay ruta ni página).
2. **El streak diario se calcula en fecha UTC** — un usuario en Chile que juega a las 21:00 puede perder su racha "sin razón" y nadie se lo explica ([game.controller.ts:501](backend/src/controllers/game.controller.ts) y :756).
3. **Errores de conexión Socket.IO solo van a consola** — si el socket no conecta, el usuario ve una UI congelada sin mensaje ([socket.ts:88](frontend/src/services/socket.ts)).
4. **Los achievements se ganan en silencio** — el backend devuelve `newAchievements` en la respuesta de finish, el frontend nunca lo renderiza (verificado: solo aparece en `types/index.ts:143` y `api.ts:383`).
5. **Errores del backend hardcodeados en español** — un usuario en inglés recibe mensajes en español, y el tono es técnico/acusador.
6. **Derrotas sin dignidad** — "Perdiste", "Has sido eliminado", "¡Racha terminada!" en el momento de mayor vulnerabilidad emocional; y perder en la ronda 1 de streak muestra "🏆 ¡Excelente! 100%" (se siente burla).

---

## 1. Principios de diseño empático (aplicar en TODA tarea)

Estos principios gobiernan cualquier decisión de copy o UX durante la implementación:

- **P1 — La derrota recibe más calidez que la victoria.** Nunca un titular frío en un momento de pérdida. Siempre: reconocer el esfuerzo → suavizar → ofrecer siguiente acción concreta.
- **P2 — Nunca culpar al usuario.** Prohibido: "inválido", "incorrecto", "demasiados intentos" como titular. El sistema explica qué pasó y cómo seguir, en lenguaje conversacional.
- **P3 — Nada falla en silencio.** Todo error que afecte al usuario (conexión, guardado, imagen) produce feedback visible con acción de recuperación (reintentar / continuar / reportar).
- **P4 — Transparencia en esperas.** Toda espera > 2s comunica qué está pasando, cuánto suele tardar y cómo cancelar.
- **P5 — El progreso del usuario es sagrado.** Rachas, resultados y estadísticas nunca se pierden ni se resetean sin explicación previa y mensaje posterior.
- **P6 — Accesible por defecto.** Todo cambio nuevo cumple: feedback no solo por color, `aria-*` correcto, touch targets ≥ 44px, animaciones gateadas por `prefers-reduced-motion`.
- **P7 — Todo texto visible pasa por i18n** (`es.json` + `en.json`, siempre ambos, misma estructura).

---

## 2. Reglas obligatorias del repo (no negociables)

El agente implementador DEBE cumplir:

1. **`npm run predeploy` en verde antes de cerrar cada tarea** (desde la raíz). Si falla, arreglar antes de seguir.
2. **Todo archivo `.ts/.tsx` nuevo se agrega a git** en el mismo commit (trampa #1 del predeploy check).
3. **Cambios a `backend/prisma/schema.prisma` siempre con migración** (`cd backend && npm run db:migrate`) y comitear schema + directorio de migración.
4. TypeScript **strict** en ambos proyectos; no usar `any` sin justificación.
5. Toda cadena visible usa `useTranslation()`; agregar claves en **ambos** `es.json` y `en.json`.
6. Frontend: respetar diseño atómico (atoms → molecules → organisms → templates → pages); lógica compleja va a custom hooks.
7. Backend: MVC estricto (controllers enrutan, services implementan).
8. Cada fase incluye tests (Vitest) para la lógica nueva; no romper los 38 tests frontend + 20 backend existentes.
9. Commits descriptivos; un PR por fase (ver §5).

---

## 3. Workstreams y tareas

Prioridades: **P0** = crítico (confianza/pérdida de datos), **P1** = alto impacto en retención, **P2** = medio, **P3** = pulido.

---

### W1 — Momentos críticos de confianza (P0)

#### T1.1 — Recuperación de contraseña (P0) — *PR propio, el más grande del plan*

**Estado actual:** [LoginPage.tsx](frontend/src/pages/LoginPage.tsx) termina sin link de "olvidé mi contraseña". La clave `auth.forgotPassword` existe en `es.json` pero no hay ruta, página, ni endpoint. Un usuario que olvida su contraseña pierde la cuenta para siempre.

**Cambio requerido:**

*Backend:*
1. Nuevo modelo Prisma `PasswordResetToken` (`id`, `userId` FK, `tokenHash` (sha256 del token, nunca el token en claro), `expiresAt` (30 min), `usedAt` nullable, `createdAt`). Crear migración.
2. `POST /api/auth/forgot-password` (público, con `authLimiter`): recibe `{ email }`. **Siempre responde 200 con el mismo mensaje** (no revelar si el email existe). Si existe: genera token aleatorio (32 bytes), guarda hash, envía email con link `${FRONTEND_URL}/reset-password?token=...`.
3. `POST /api/auth/reset-password` (público, con `authLimiter`): recibe `{ token, newPassword }`. Valida token no usado/no expirado, actualiza `passwordHash` (bcrypt, mismo costo que register), marca `usedAt`, invalida los demás tokens del usuario.
4. Servicio de email: nuevo `backend/src/services/email.service.ts` usando **Resend** (tier gratis, API HTTP simple — no requiere SMTP). Nueva env var `RESEND_API_KEY` + `EMAIL_FROM` en `config/env.ts` (opcionales). **Degradación elegante:** si no hay API key configurada, el endpoint responde 200 igual pero loguea warning; el frontend muestra el mensaje genérico (no romper el flujo en dev).
5. Plantilla de email en ES y EN según `user.preferredLanguage`, tono cálido ("Recupera tu acceso a GeoChallenge").

*Frontend:*
6. Link "¿Olvidaste tu contraseña?" en LoginPage bajo el campo password, y también **dentro del mensaje de error de credenciales** y del error de rate-limit (P2 del principio: dar salida, no regaño).
7. Nueva página `ForgotPasswordPage.tsx` (usar `AuthPageTemplate`): campo email + submit; siempre muestra éxito: "Si existe una cuenta con ese correo, te enviamos un enlace. Revisa también spam 📬".
8. Nueva página `ResetPasswordPage.tsx`: lee `token` de query, campos nueva contraseña + confirmación (con toggle mostrar/ocultar, ver T7.3), redirige a login con mensaje de éxito. Token inválido/expirado → mensaje amable + botón para pedir uno nuevo.
9. Rutas en `App.tsx`; métodos `forgotPassword`/`resetPassword` en `services/api.ts`.

**Claves i18n nuevas (agregar en es.json y en.json):** `auth.forgotPassword` (revisar existente), `auth.forgotTitle`, `auth.forgotSubtitle`, `auth.forgotSent`, `auth.resetTitle`, `auth.newPassword`, `auth.confirmNewPassword`, `auth.resetSuccess`, `auth.resetTokenInvalid`, `auth.resetRequestNew`.

**Criterios de aceptación:**
- [ ] Flujo completo funciona con `RESEND_API_KEY` configurada; sin ella, no lanza 500.
- [ ] La respuesta de forgot-password es idéntica exista o no el email (anti-enumeración).
- [ ] Token de un solo uso, expira a los 30 min, se guarda hasheado.
- [ ] Tests backend: token expirado, token reusado, email inexistente, reset exitoso + login con nueva contraseña.
- [ ] Migración Prisma comiteada junto al schema.

---

#### T1.2 — Streak diario: timezone del usuario + mensajes de pérdida (P0)

**Estado actual:** `getTodayKey()` en [game.controller.ts:501](backend/src/controllers/game.controller.ts) usa `new Date().toISOString().slice(0, 10)` (UTC), igual que el cálculo de "ayer" en :756. Un usuario en GMT-4 que juega a las 21:00 ya está en "mañana" UTC: puede perder la racha jugando todos los días. Además, cuando la racha se resetea, el frontend solo muestra "🔥 1 día" sin explicar que se perdió una racha de N días ([DailyChallengePage.tsx:162-169](frontend/src/pages/DailyChallengePage.tsx)).

**Cambio requerido:**

*Backend:*
1. Los endpoints daily (`GET` estado del daily y el finish/submit del daily en `game.controller.ts`) aceptan un parámetro `clientDate` (string `YYYY-MM-DD`, la fecha local del dispositivo). **Validación anti-trampa:** `clientDate` debe estar a ±1 día calendario de la fecha UTC del servidor; si no, usar la fecha UTC (fallback actual).
2. Toda la lógica de "hoy"/"ayer" del daily usa `clientDate` validada como day-key. La racha se mantiene si `lastDailyDate` es el "ayer" del usuario, no del servidor.
3. Cuando la racha se resetea (no jugó "ayer"), la respuesta incluye `previousStreak` (el valor que tenía antes del reset) y `streakLost: true`. El dato ya está disponible en `userRow.dailyStreak` antes de sobrescribir — no requiere migración.

*Frontend:*
4. `services/api.ts`: los métodos del daily envían `clientDate` calculada con la fecha local del dispositivo (`new Date()` local, formatear manualmente YYYY-MM-DD — NO `toISOString`).
5. `DailyChallengePage`: si la respuesta trae `streakLost: true` y `previousStreak >= 2`, mostrar mensaje empático ANTES del resultado: "Tu racha de {{count}} días se cortó 💛 — hoy empieza una nueva. Lo importante es volver." (nueva clave `daily.streakLostNotice`).
6. En la pantalla "ya jugaste hoy" y en el resultado del daily, mostrar cuándo abre el próximo reto **en hora local del usuario**: "El próximo reto abre a medianoche (tu hora)" (`daily.nextChallengeAt`).
7. **(P2, opcional, fase posterior):** mecánica de "protector de racha" (1 por semana, se consume automáticamente al fallar un día). Requiere campos nuevos en `User` → migración. No implementar en el primer PR de esta tarea.

**Criterios de aceptación:**
- [ ] Test backend: usuario con tz GMT-4 que juega 23:30 local dos días seguidos mantiene racha (simular con `clientDate`).
- [ ] Test backend: `clientDate` a +3 días del server → se ignora y usa UTC.
- [ ] Racha perdida ⇒ respuesta incluye `previousStreak` y el frontend lo comunica con tono cálido.
- [ ] Sin `clientDate` (clientes viejos/PWA cacheada) todo sigue funcionando como hoy.

---

#### T1.3 — Errores de conexión Socket.IO visibles (P0)

**Estado actual:** [socket.ts:88-94](frontend/src/services/socket.ts) — `connect_error` y `disconnect` solo hacen `console.error/log`. Si el socket nunca conecta, DuelPage se queda en "Buscando rival..." para siempre y SurvivalPage congelada, sin mensaje. DuelPage sí maneja bien `disconnect` una vez conectado (:264) pero nunca se entera del fallo inicial.

**Cambio requerido:**
1. `socketService`: agregar API de suscripción a estado de conexión — `onConnectionChange(cb: (state: 'connected' | 'disconnected' | 'error') => void)` que internamente escucha `connect`, `connect_error`, `disconnect`. Exponer también `getConnectionState()`.
2. `DuelPage` y `SurvivalPage`: suscribirse al montar. En estado `error` estando en búsqueda/lobby/juego → `Alert` tipo warning: "No pudimos conectar al servidor de partidas. Reintentando…" con botón **Reintentar** (reusar `retryDuelFlow` en DuelPage, crear equivalente en SurvivalPage) y botón **Volver al menú**.
3. Timeout de conexión inicial: si tras 10s de entrar a Duel/Survival el socket no conectó, mostrar el mismo Alert (no esperar indefinidamente).
4. En DuelPage, cuando `isSyncingRound === true` por más de 5s, mostrar texto explicativo: "Sincronizando con la partida… tu progreso está a salvo" (`duel.syncingLong`).

**Claves i18n:** `socket.connectionFailed`, `socket.retrying`, `duel.syncingLong` (ES+EN).

**Criterios de aceptación:**
- [ ] Con backend apagado, entrar a /duel muestra mensaje + retry en ≤10s (nunca spinner infinito).
- [ ] Test frontend: simular `connect_error` y verificar que se renderiza el Alert.

---

#### T1.4 — Guardado de partida nunca falla en silencio (P0)

**Estado actual:** [GamePage.tsx:340](frontend/src/pages/GamePage.tsx) — `.catch(() => navigate('/results?gameType=streak'))`: si `finishGame` falla, se redirige a resultados sin avisar; el usuario cree que su partida se guardó. Además `GameContext` encola sesiones offline ([useOfflineQuestions.ts:155-177](frontend/src/hooks/useOfflineQuestions.ts)) pero nunca comunica que hay resultados pendientes de sincronizar.

**Cambio requerido:**
1. `GamePage` (y revisar el mismo patrón en `FlashGamePage`, `ChallengeGamePage`, `DailyChallengePage`): si `finishGame` falla estando online, **reintentar 1 vez**; si vuelve a fallar, encolar con `enqueuePendingSession` (mismo mecanismo offline) y navegar a resultados con flag `?pendingSync=1`.
2. `ResultsPage`: si `pendingSync=1` o el resultado vino de la cola offline, mostrar badge no-alarmista: "📡 Resultado guardado en este dispositivo — se sincronizará automáticamente" (`results.pendingSync`).
3. Sincronización visible: donde se ejecute `drainPendingSessions` (buscar su consumidor; si no tiene, invocarlo al recuperar conexión en `AppRoot` escuchando el evento `online`), emitir toast de éxito "Tus partidas pendientes se sincronizaron ✓" (`sync.done`) usando el sistema de toasts de T3.1.
4. Indicador de modo offline durante el juego: `GamePage` ya conoce el estado offline vía GameContext — mostrar chip persistente "📴 Sin conexión — puedes seguir jugando" (`game.offlineBadge`) mientras `!navigator.onLine`, reutilizando el patrón del banner de [AppRoot.tsx:43](frontend/src/AppRoot.tsx).

**Criterios de aceptación:**
- [ ] Matar el backend justo antes de terminar una partida ⇒ el usuario ve el badge de pendiente, nunca un resultado "normal" falso.
- [ ] Al volver la conexión, la cola se drena y aparece el toast.
- [ ] Test: `finishGame` rechaza ⇒ se encola la sesión y se navega con flag.

---

#### T1.5 — Protección anti doble-submit en single-player (P0, fix pequeño)

**Estado actual:** [GamePage.tsx:307-351](frontend/src/pages/GamePage.tsx) — `handleSubmitAnswer` no tiene guard; el botón no se deshabilita durante el round-trip ([RoundActionTray.tsx:121](frontend/src/components/RoundActionTray.tsx) acepta `isSubmitting` pero GamePage nunca lo pasa). DuelPage sí está protegido con ref (:334).

**Cambio requerido:**
1. Estado `isSubmitting` en GamePage: se activa al enviar, se limpia al recibir respuesta/error. Pasarlo a `RoundActionTray` y a los `OptionButton` (prop `disabled`).
2. Guard al inicio de `handleSubmitAnswer`: `if (isSubmitting || showResult) return;`.
3. Replicar el patrón en `ChallengeGamePage` y `DailyChallengePage` si tienen el mismo hueco (verificar).

**Criterios de aceptación:**
- [ ] Doble click rápido en enviar produce exactamente un request (test con mock de api).

---

### W2 — Derrotas con dignidad (P1) — *solo copy + presentación, sin lógica nueva*

> Regla transversal: aplicar P1/P2 de §1. Todas las claves se agregan en `es.json` **y** `en.json`. Los textos de abajo son la dirección de tono ES; el implementador escribe la versión EN equivalente (no traducción literal, mismo calor).

#### T2.1 — Derrota en duelo
**Actual:** heading "Perdiste" / "You lose" (`es.json:309`), emoji 💪 plano, y recién debajo "¡Buen juego! Intenta de nuevo." ([DuelPage.tsx:603-611](frontend/src/pages/DuelPage.tsx)).
**Cambio:** invertir jerarquía. Heading nuevo: "¡Gran duelo!" (`duel.closeMatch`); subtítulo con contexto real de marcador: si la diferencia fue ≤ 200 pts → "Quedaste a solo {{diff}} puntos 🔥" (`duel.almostWon`), si no → "{{opponent}} estuvo fuerte hoy. La revancha es tuya cuando quieras." (`duel.rematchNudge`). Mantener "Perdiste" solo como texto secundario pequeño junto al marcador (el dato debe estar, pero no como grito). CTA primario: "Revancha" → re-entrar a cola con la misma categoría; secundario: "Menú".

#### T2.2 — Fin de racha (streak mode)
**Actual:** al perder, ResultsPage calcula porcentaje sobre respondidas ⇒ racha de 1 muestra "🏆 ¡Excelente! 100%" ([ResultsPage.tsx:82-96](frontend/src/pages/ResultsPage.tsx)); GamePage muestra "¡Racha terminada! Esta era la respuesta correcta." (`es.json:247`).
**Cambio:**
1. `ResultsPage`: cuando `gameType=streak`, NO usar el mensaje por porcentaje. Layout propio de racha: "Racha de {{count}} 🔥" como dato principal + mensaje según longitud: 0-2 → "Todos empiezan así. Una más y le agarras el ritmo." (`results.streakShort`); 3-9 → "¡Sólida racha! Tu récord está a la vista." (`results.streakMid`); ≥10 → "Racha enorme. Eso ya es nivel experto 👏" (`results.streakLong`). Mostrar récord personal si está disponible ("Tu mejor: {{best}}") y CTA primario "Otra racha".
2. Reescribir `game.streakOver`: "Se cortó en {{count}} 💛 La respuesta era:" — reconocer la racha lograda antes de revelar la respuesta.

#### T2.3 — Eliminación en survival
**Actual:** "💀 Has sido eliminado. Mira cómo termina." ([SurvivalPage.tsx:744-748](frontend/src/pages/SurvivalPage.tsx), `es.json:187`), auto-espectador a los 1.8s.
**Cambio:** "Llegaste a la ronda {{round}} de {{total}} 💪 Quédate a ver el final" (`survival.eliminatedWarm` — el nº de ronda está en el estado de la página). En modo espectador, header persistente: "👀 Modo espectador — sobreviviste {{round}} rondas". Al terminar el match, mostrar al eliminado su posición final ("Terminaste {{place}}º de {{players}}").

#### T2.4 — Rival abandona el duelo
**Actual:** [DuelPage.tsx:249-257](frontend/src/pages/DuelPage.tsx) — auto-victoria sin explicación; el usuario puede sentir que el triunfo "no cuenta".
**Cambio:** en la pantalla final, cuando la victoria fue por abandono, subtítulo explícito: "{{opponent}} abandonó la partida. Victoria para ti — cuenta igual para tu ranking ✓" (`duel.wonByForfeit`).

#### T2.5 — Puntaje bajo / 0 en resultados
**Actual:** <30% ⇒ "¡Puedes hacerlo mejor!" (`es.json:279`) — juzga sin guiar.
**Cambio:** reescribir tramo <30%: "Las primeras partidas son las más difíciles — cada una te enseña banderas nuevas 🌱" (`results.growthMindset`). Si `score === 0`, agregar CTA sugerido: "Prueba dificultad Fácil" que navegue al menú con `difficulty=EASY` preseleccionada (`results.tryEasy`).

#### T2.6 — Daily ya jugado + mensajes fríos varios
**Actual:** "Ya jugaste hoy / Vuelve mañana" (`es.json:474-475`); shield: "Escudo activado: la racha continúa, pero esta ronda no suma." (`es.json:528`); login: "Email o contraseña incorrectos. Verifica e intenta de nuevo." (`es.json:67`); rate limit: "Demasiados intentos…" (`es.json:68`).
**Cambio (reescritura de claves existentes, ambos idiomas):**
- Daily jugado: "¡Reto de hoy completado! 🎯 Mañana hay uno nuevo esperándote" + mostrar el puntaje logrado hoy.
- Shield: "🛡️ ¡Tu escudo salvó la racha! Sigue con todo" (celebrar el rescate, la letra chica del puntaje va secundaria).
- Login fallido: "Ese correo y contraseña no coinciden. ¿Lo intentamos de nuevo?" + link "¿Olvidaste tu contraseña?" (depende de T1.1; si aún no existe, dejar el link fuera).
- Rate limit: "Por seguridad pausamos los intentos un momento. Prueba de nuevo en {{minutes}} min" + link a recuperar contraseña.
- Validación email: "Ese correo no parece completo — algo como tu@correo.com" (`es.json:65`).
- Empty states ([EmptyState](frontend/src/components/molecules/EmptyState.tsx) ya soporta prop `action` — los callsites no la pasan): Challenges vacío → "Aún no hay desafíos por aquí. ¡Crea el primero e invita a alguien!" + botón Crear; historial vacío → "Tu primera partida está a un click 🚀" + botón Jugar; duelos vacío → "Tu primer duelo te espera ⚔️" + botón Buscar rival.

**Criterios de aceptación W2 (todos los sub-ítems):**
- [ ] Ninguna pantalla de derrota tiene como titular una palabra negativa seca ("Perdiste", "eliminado", "terminada").
- [ ] Toda pantalla de derrota ofrece un CTA de siguiente acción (revancha / otra racha / ver final / cambiar dificultad).
- [ ] es.json y en.json actualizados en paralelo; `npm run test` frontend en verde (hay tests que assertean copy — actualizarlos).

---

### W3 — Celebración en el momento (P1)

#### T3.1 — Sistema de toasts propio (prerequisito de T3.2 y T1.4)

**Estado actual:** no existe ningún sistema de toast/snackbar (verificado por búsqueda); los éxitos se comunican con `Alert` inline que requiere navegación o cierre manual.

**Cambio requerido:** crear infraestructura mínima sin dependencias externas (coherente con `useUiStore` sin libs):
1. `frontend/src/components/organisms/ToastHost.tsx` + estado en `useUiStore` (`toasts: Toast[]`, acciones `pushToast/dismissToast`). Tipos: `success | info | achievement`.
2. Render en esquina superior (mobile: top, full-width con margen), auto-dismiss 4s (achievement: 6s), pausa de timer on hover/focus, botón cerrar con `aria-label`.
3. Accesibilidad: contenedor `role="status"` `aria-live="polite"`; entrada/salida animada **gateada por `prefersReducedMotion`** (ya está en `useUiStore`).
4. Montar `ToastHost` en `AppRoot`.

**Criterios de aceptación:**
- [ ] Toast visible y auto-descartado; navegable por teclado; anunciado por lector de pantalla (test con testing-library: `getByRole('status')`).

#### T3.2 — Achievements celebrados al ganarlos

**Estado actual:** el backend evalúa y devuelve `newAchievements` en el finish ([game.controller.ts:351-360](backend/src/controllers/game.controller.ts)); el frontend lo tipa (`types/index.ts:143`, `api.ts:383`) pero **ningún componente lo consume**. Solo se ven en ProfilePage.

**Cambio requerido:**
1. `GameContext.finishGame`: propagar `newAchievements` en el estado del resultado (y en el flujo del daily y challenge si sus finish también los devuelven — verificar en `game.controller.ts` y `challenge.controller.ts`).
2. `ResultsPage` (y pantalla final del daily): si hay achievements nuevos, bloque destacado "🏅 ¡Logro desbloqueado!" con nombre y descripción localizada. Reusar el mapeo clave→i18n que ya usa ProfilePage para el catálogo (buscar `achievements.` en es.json; si el mapeo vive en ProfilePage, extraerlo a `utils/achievements.ts`).
3. Además del bloque en resultados, disparar un toast tipo `achievement` por cada logro (máximo 2 visibles, el resto agrupado: "+{{count}} logros más").
4. Animación de brillo sutil, gateada por reduced-motion.

**Criterios de aceptación:**
- [ ] Simular respuesta de finish con `newAchievements: ['STREAK_10']` ⇒ ResultsPage muestra el bloque con nombre localizado ES/EN.
- [ ] Sin logros nuevos, la UI de resultados no cambia.

---

### W4 — Errores que guían: backend localizado + códigos (P1)

#### T4.1 — Códigos de error estructurados

**Estado actual:** errores del backend hardcodeados en español y acoplados al copy: `challenge.service.ts` (~19 `throw new Error('...')` en :47-301), `duel.handler.ts` (:198-672), `survival.handler.ts` (:475-483), `rateLimit.ts`, y validaciones que exponen el array crudo de Zod (`auth.controller.ts:40-44`, `game.controller.ts:141`). El frontend los muestra verbatim vía `getApiErrorMessage()` ([utils/apiError.ts](frontend/src/utils/apiError.ts)).

**Cambio requerido (patrón código→i18n, sin tocar la firma de cada endpoint):**
1. Backend: crear `backend/src/utils/appError.ts` con clase `AppError extends Error { code: string; status: number; params?: Record<string, unknown> }` y catálogo de códigos (ej.: `CHALLENGE_PLAYER_RANGE`, `CHALLENGE_NOT_ENOUGH_QUESTIONS`, `CHALLENGE_ALREADY_JOINED`, `DUEL_RATE_LIMITED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_TAKEN`, `VALIDATION_FAILED`, `INTERNAL`).
2. Reemplazar los `throw new Error(...)` de services/sockets por `AppError` con código + params (ej. `{ min: 2, max: 8 }`). Los controllers capturan `AppError` y responden `{ error: <mensaje ES actual como fallback>, code, params }`. Los handlers de socket emiten `{ message, code, params }` en `duel:error`/`survival:error`.
3. Validación Zod: en vez de `details: validation.error.errors`, responder `code: 'VALIDATION_FAILED'` + `fields: [{ field, code }]` con códigos por regla (`too_short`, `invalid_email`…). No exponer el objeto Zod crudo.
4. Errores 500: incluir `requestId` corto (random por request, logueado junto al stack) → `{ error: ..., code: 'INTERNAL', requestId }`.
5. Frontend: extender `getApiErrorMessage()` — si la respuesta trae `code`, buscar `t('apiErrors.' + code, { ...params, defaultValue: mensajeDelServidor })`. Agregar sección `apiErrors` en es.json/en.json con los códigos del catálogo, redactados según P2 (ej. `CHALLENGE_NOT_ENOUGH_QUESTIONS`: "No alcanzan las preguntas para esos filtros — prueba con más categorías 🗺️"). Para `INTERNAL`: "Algo falló de nuestro lado 😓 Ya quedó registrado (ref: {{requestId}}). Intenta de nuevo en un momento."
6. Migrar de una vez los mensajes existentes; el fallback `error` (string) garantiza compatibilidad con cualquier código no mapeado.

#### T4.2 — `retryAfterSeconds` universal

**Estado actual:** el backend lo envía en el authLimiter ([rateLimit.ts:31-46](backend/src/middleware/rateLimit.ts)) pero solo LoginPage lo interpreta (:43-46, verificado por grep). En cualquier otra pantalla un 429 muestra texto crudo.

**Cambio:** en el interceptor de respuesta de [api.ts](frontend/src/services/api.ts), si `status === 429`, construir SIEMPRE el error con mensaje localizado usando `retryAfterSeconds` si viene (redondear a minutos, mínimo "1 min") con la clave reescrita en T2.6. Eliminar el manejo especial de LoginPage (queda cubierto por el interceptor).

**Criterios de aceptación W4:**
- [ ] Usuario con idioma EN recibe todos los errores de challenge/duel/survival en inglés.
- [ ] 500 muestra referencia corta y el log del backend permite encontrarla.
- [ ] 429 en cualquier pantalla muestra tiempo de espera.
- [ ] Tests backend de `AppError` → shape de respuesta; tests frontend de `getApiErrorMessage` con `code` conocido, desconocido y sin código.

---

### W5 — Transparencia en esperas, offline y percepción de velocidad (P1/P2)

#### T5.1 — Feedback de respuesta sin esperar al servidor (P1)
**Actual:** en single-player el resultado espera el round-trip completo ([GamePage.tsx:307-351](frontend/src/pages/GamePage.tsx)); con red lenta el usuario mira la pantalla sin feedback y **el timer sigue corriendo** (:504-513). El cliente ya posee `correctAnswer` (GameContext valida localmente offline en :184-196), así que el feedback optimista es viable.
**Cambio:**
1. Al enviar respuesta: congelar el timer inmediatamente (prop `isActive` a false al entrar en estado `submitting`) y marcar al instante la opción como correcta/incorrecta usando la validación local (mismo matching case-insensitive que el path offline).
2. Los puntos (que dependen del server: bonus tiempo/precisión) aparecen cuando llega la respuesta; mientras tanto, placeholder "+…" con shimmer. Si el server discrepa del resultado local (edge raro), la respuesta del server manda y se corrige la UI.
3. Si el request falla, mantener el resultado visual local y encolar según T1.4.

#### T5.2 — Imagen rota nunca deja al usuario atrapado (P1)
**Actual:** si falla la imagen FLAG/SILHOUETTE se intenta `replaceCurrentQuestion()` y si eso también falla, catch silencioso ([GameContext.tsx:270-271](frontend/src/context/GameContext.tsx)) — pregunta sin imagen, timer corriendo.
**Cambio:** si el reemplazo falla: pausar el timer, mostrar en el área de imagen un fallback con mensaje "No pudimos cargar esta imagen 🖼️" y botones "Reintentar" / "Saltar pregunta (no cuenta)" — saltar avanza sin registrar la pregunta (excluirla del resultado). Reusar el patrón de placeholder de [FlagDisplay.tsx:69-82](frontend/src/components/FlagDisplay.tsx).

#### T5.3 — Esperas comunicadas (P2)
1. **Matchmaking duelo** ([DuelPage.tsx:466-544](frontend/src/pages/DuelPage.tsx)): agregar "La mayoría encuentra rival en menos de 1 min" (`duel.expectedWait`); al timeout de 120s, reemplazar "No se encontró oponente. Intenta de nuevo más tarde." por mensaje con opciones: "No apareció nadie esta vez 😅 Prueba otra categoría o vuelve en unos minutos" + botones "Cambiar categoría" / "Reintentar".
2. **ServerWakeUp** ([ServerWakeUp.tsx](frontend/src/components/ServerWakeUp.tsx)): agregar barra de progreso indeterminada + texto que rota cada ~8s ("Despertando el servidor…", "Ya casi…", "Los servidores gratis se toman su siesta 😴") y tras 30s: "Está tardando más de lo normal — puedes seguir esperando o probar el modo offline".
3. **Lobby survival** ([SurvivalPage.tsx:571-621](frontend/src/pages/SurvivalPage.tsx)): agregar línea "La partida arranca sola cuando se llene la sala" (`survival.autoStartHint`).

#### T5.4 — Skeletons y PWA update (P2/P3)
1. Crear `atoms/Skeleton.tsx` (variantes `line`, `card`, `row`, con `animate-pulse` gateado por reduced-motion) y aplicarlo en RankingsPage (podio + lista), ChallengesPage (cards) y tabs de ProfilePage — hoy son spinner de página completa ([RankingsPage.tsx:534-537](frontend/src/pages/RankingsPage.tsx), [ChallengesPage.tsx:222](frontend/src/pages/ChallengesPage.tsx)).
2. PWA: con `registerType: 'autoUpdate'` ([vite.config.ts:13-51](frontend/vite.config.ts)) la app se actualiza silenciosa; agregar toast informativo cuando el SW instala una versión nueva: "GeoChallenge se actualizó ✨" (usar `onNeedRefresh`/`onOfflineReady` de `virtual:pwa-register`). P3.

**Criterios de aceptación W5:**
- [ ] Con red throttled (DevTools Slow 3G): la opción elegida se marca al instante y el timer no consume tiempo durante el round-trip.
- [ ] Forzar error de imagen (URL inválida) con reemplazo fallido ⇒ el usuario tiene salida (retry/skip) y el timer está pausado.
- [ ] Ninguna página principal renderiza spinner de pantalla completa si puede mostrar skeleton del layout final.

---

### W6 — Accesibilidad (P1 la fase 1, P2 la fase 2)

#### T6.1 — Fase 1: correcciones puntuales (P1)
1. **`eslint-plugin-jsx-a11y`**: instalar y activar en `.eslintrc.cjs` (preset `recommended`); corregir violaciones que reporte. Corre en CI vía `frontend-quality.yml` sin cambios extra.
2. **FormField accesible** ([FormField.tsx](frontend/src/components/molecules/FormField.tsx)): dar `id` al error y al hint; en el Input agregar `aria-invalid={hasError}` y `aria-describedby` apuntando a error/hint según existan. El error con `role="alert"`.
3. **Foco al error de formulario**: en Login/Register, al fallar submit mover el foco al Alert de error (LoginPage:107).
4. **`StreakCombo` milestone flash** gateado por `prefersReducedMotion` ([StreakCombo.tsx:34-43](frontend/src/components/StreakCombo.tsx) + `index.css:486-491`).
5. **Haptic de urgencia** ([Timer.tsx:67](frontend/src/components/Timer.tsx)): no disparar si `prefersReducedMotion`.
6. **Toggle de contraseña ≥44px** ([LoginPage.tsx:142-150](frontend/src/pages/LoginPage.tsx)): llevar a `min-h-11 min-w-11`; agregar el mismo toggle en RegisterPage (T7.3).
7. **Anuncio de urgencia del timer**: región `aria-live="polite"` (visually-hidden) que anuncia una sola vez "Quedan 5 segundos" al cruzar el umbral (`timer.hurryAnnouncement`).
8. **Feedback no solo simbólico** en [OptionButton.tsx:108](frontend/src/components/OptionButton.tsx): junto a ✓/✕ agregar texto sr-only "Correcta"/"Incorrecta" para lectores.
9. **Labels diminutos**: reemplazar `text-[0.62rem]`/`text-[0.65rem]` (badge de dificultad en QuestionCard:139, labels de RoundActionTray:101) por `text-xs` mínimo o clamp.

#### T6.2 — Fase 2: accesibilidad estructural (P2)
1. **Modo de tiempo extendido**: toggle en ajustes de perfil "Más tiempo por pregunta (+50%)", persistido en `useUiStore`/localStorage; aplica SOLO a modos single-player (single, streak, daily práctica — no duel/survival por equidad). El timer usa duración ×1.5; el bonus de tiempo se calcula igual (es una acomodación, no una trampa: documentar en el código el porqué).
2. **MapInteractive con teclado** ([MapInteractive.tsx:110-116](frontend/src/components/MapInteractive.tsx)): crosshair central fijo; flechas panean el mapa, `+`/`-` zoom, Enter coloca el marcador en el crosshair. Instrucciones visibles al enfocar el mapa ("Usa las flechas y Enter para marcar").
3. **Controles Leaflet ≥44px** vía CSS override.
4. **Haptics default off** en primera visita ([useUiStore.ts:41](frontend/src/store/useUiStore.ts): cambiar default de `true` a `false`) — respetar la elección de usuarios existentes que ya tienen la pref guardada.
5. **Skip link en páginas de juego** hacia las opciones de respuesta.
6. **Auditoría de contraste** AA sobre los tokens CSS en light/dark (documentar resultado en este archivo).

**Criterios de aceptación W6:**
- [ ] `npm run lint` frontend en verde con jsx-a11y activo.
- [ ] Con VoiceOver/NVDA: un formulario con error anuncia el error al llegar al campo; el timer anuncia la urgencia una vez.
- [ ] Una partida completa de categoría MAP es jugable solo con teclado.
- [ ] Tests: FormField renderiza `aria-invalid`/`aria-describedby`; Timer no anima con reduced-motion.

---

### W7 — Onboarding y descubrimiento (P2)

#### T7.1 — "Cómo se juega" contextual
**Actual:** [MenuPage.tsx:212-320](frontend/src/pages/MenuPage.tsx) — cards con descripción de una línea; cero tutorial. "Un error y pierdes" como única explicación de streak (intimidante, sin upside).
**Cambio:**
1. Botón "?" en cada `GameModeCard` → `Modal` (ya accesible) con 3 bullets: objetivo, reglas, consejo. Claves `howto.<modo>.*`.
2. Primera vez que el usuario entra a cada modo (flag en localStorage `howto_seen_<modo>`), mostrar el modal automáticamente con CTA "¡Jugar!". Nunca más de una vez por modo.
3. Reescribir descripciones intimidantes: streak → "¿Cuántas seguidas puedes acertar? 🔥" (`menu.streakDesc`).

#### T7.2 — Tooltips de mecánicas (Intel 5050 / Focus Time / Streak Shield)
**Actual:** [MechanicsHud.tsx:43-69](frontend/src/components/MechanicsHud.tsx) — solo icono + contador; el usuario descubre qué hacen por accidente.
**Cambio:** long-press/hover/focus sobre cada `MechanicButton` muestra tooltip de una línea ("Elimina 2 opciones incorrectas — 1 por partida"). Primera partida con mecánicas activas: coach-mark de una sola vez señalando el HUD ("Tus ayudas 👇 tócalas cuando las necesites"). Al usar una mecánica, feedback inmediato con toast pequeño ("🧠 Fuera 2 opciones") — hoy el efecto es silencioso.

#### T7.3 — Fricción de registro
**Actual:** RegisterPage sin toggle mostrar contraseña (Login sí lo tiene, :142-151); error "email ya registrado" sin acción de recuperación ([RegisterPage.tsx:35-48](frontend/src/pages/RegisterPage.tsx)).
**Cambio:** (a) mismo toggle de Login en ambos campos de password de Register (y de ResetPasswordPage de T1.1); (b) cuando el error es email tomado, el Alert incluye link "¿Ya tienes cuenta? Inicia sesión" (y "Recupérala aquí" cuando exista T1.1); (c) requisitos de contraseña visibles desde el inicio (ya hay `FormField.Hint` — verificar que se muestre antes del primer error).

#### T7.4 — Rankings sin humillación
**Actual:** el newcomer ve el top global; su posición solo aparece como "(Tú)" ([RankingsPage.tsx:218-220](frontend/src/pages/RankingsPage.tsx)); ya existe "Cargando vecinos…" (:489-510) — hay contexto de vecinos parcial.
**Cambio:** bloque fijo arriba de la lista con la posición propia: "Tu posición: #{{rank}} de {{total}} — top {{percent}}%" + si `rank > 100`, mostrar la franja de vecinos (±3) por defecto. Mensaje para usuarios sin partidas: "Juega tu primera partida para aparecer aquí 🚀".

**Criterios de aceptación W7:**
- [ ] Usuario nuevo ve el how-to del modo la primera vez y nunca más.
- [ ] Cada mecánica es explicable sin salir del juego y su uso produce feedback visible.
- [ ] Register tiene paridad de affordances con Login.

---

## 4. Tareas explícitamente descartadas (no hacer sin aprobación del owner)

- **Streak freeze / protector de racha diaria** (T1.2.7): requiere migración y decisión de producto — dejar propuesto, no implementar.
- **Pausa manual del timer en modos competitivos** (duel/survival): rompe equidad PvP. La acomodación de tiempo (T6.2.1) es solo single-player.
- **Cambiar el modelo de scoring** con tiempo extendido: se mantiene scoring normal (decisión documentada en T6.2.1).
- **Librerías nuevas de UI** (react-toastify, radix, etc.): todo se construye con los patrones existentes del repo. Única dependencia nueva permitida: `eslint-plugin-jsx-a11y` (dev) y el SDK/fetch de Resend en backend (T1.1).

---

## 5. Orden de ejecución y PRs sugeridos

Cada PR: rama desde `master`, `npm run predeploy` verde, tests nuevos incluidos, descripción con checklist de criterios de la(s) tarea(s).

| # | PR | Tareas | Tamaño | Riesgo |
|---|----|--------|--------|--------|
| 1 | `fix/resiliencia-critica` | T1.3, T1.4, T1.5 | M | Bajo |
| 2 | `feat/copy-derrotas-dignas` | W2 completo (T2.1–T2.6) | M (mucho i18n, poca lógica) | Bajo |
| 3 | `fix/daily-streak-timezone` | T1.2 | M | Medio (lógica de racha — testear fuerte) |
| 4 | `feat/toasts-y-achievements` | T3.1, T3.2 | M | Bajo |
| 5 | `feat/api-error-codes` | T4.1, T4.2 | L | Medio (toca muchos endpoints — el fallback string protege) |
| 6 | `feat/a11y-fase-1` | T6.1 | M | Bajo |
| 7 | `feat/percepcion-velocidad` | T5.1, T5.2, T5.3 | M | Medio (timer/optimismo — testear con red lenta) |
| 8 | `feat/onboarding-descubrimiento` | W7 | M | Bajo |
| 9 | `feat/password-reset` | T1.1 | L | Medio (schema + email + seguridad) |
| 10 | `feat/a11y-fase-2 + polish` | T6.2, T5.4 | L | Medio |

Justificación del orden: primero lo que evita pérdida de confianza/datos con poco riesgo (1–3), luego lo que más mueve retención (4–5), después base de calidad (6) y percepción (7), y al final las piezas grandes con dependencias externas (9) y estructurales (10). El PR 9 puede adelantarse si el owner consigue la API key de email antes.

---

## 6. Definition of done global del plan

- [ ] `npm run predeploy` verde en cada PR.
- [ ] Cero strings visibles nuevos fuera de i18n; `es.json` y `en.json` siempre en paridad de claves.
- [ ] Ningún error alcanzable por el usuario termina solo en `console.*`.
- [ ] Toda pantalla de derrota/bloqueo ofrece siguiente acción.
- [ ] jsx-a11y activo en lint; sin regresiones en los tests existentes.
- [ ] QA manual final con el usuario de pruebas de producción (credenciales en la memoria del proyecto) cubriendo: login fallido → recuperación, partida con red lenta, duelo con desconexión, daily en horario nocturno, un logro nuevo, y navegación con teclado + VoiceOver de una partida completa.
