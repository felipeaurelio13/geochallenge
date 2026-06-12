# GeoChallenge

**GeoChallenge** es un juego de trivia geográfica full-stack con modos de juego múltiples (single-player, duelos, survival, challenges, daily), multijugador en tiempo real via WebSockets, leaderboards, achievements y soporte offline (PWA).

- Frontend: React 18 + TypeScript + Vite (`frontend/`) — v1.2.87
- Backend: Node.js + Express + Socket.IO + Prisma + PostgreSQL + Redis (`backend/`) — v1.1.0
- Datos de juego estáticos en `data/` (JSON)
- Monorepo con workspace scripts en la raíz

---

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

---

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

---

## Estructura del monorepo

```
geochallenge/
├── frontend/          React + Vite + Tailwind (SPA + PWA)
├── backend/           Express + Prisma + Socket.IO
├── data/              JSON de países, ciudades y monumentos
├── scripts/           predeploy-check.sh
├── .github/workflows/ CI de calidad (lint, test, build)
├── docker-compose.yml Stack Docker para VPS (Postgres, Redis, Caddy)
├── render.yaml        Definición de servicios en Render
└── Caddyfile          Reverse proxy para deploy Docker
```

---

## Frontend (`frontend/`)

### Stack

| Herramienta | Versión | Rol |
|---|---|---|
| React | 18.2.0 | UI framework |
| TypeScript | 5.2.2 (strict) | Tipado |
| Vite | 5.1.4 | Build / dev server |
| Tailwind CSS | 3.4.1 | Estilos utilitarios |
| React Router | 6.22.2 | Client-side routing |
| Axios | 1.6.7 | HTTP client |
| Socket.IO Client | 4.7.4 | WebSocket (duelos, survival) |
| Leaflet | 1.9.4 | Mapa interactivo (preguntas MAP) |
| i18next | 23.10.0 | Internacionalización (ES/EN) |
| Zod | 3.23.8 | Validación de esquemas |
| Vite Plugin PWA | 0.19.2 | Service worker + manifest |
| Vitest | 1.3.1 | Unit tests |
| Playwright | 1.51.1 | E2E tests |

### Scripts principales

```bash
cd frontend
npm run dev        # Vite dev server en :5173 (proxy /api y /socket.io → :3001)
npm run build      # tsc + vite build → dist/
npm run test       # Vitest
npm run lint       # ESLint
```

### Estructura de carpetas

```
frontend/src/
├── pages/          # 15 páginas (rutas)
├── components/     # Diseño atómico: atoms/ molecules/ organisms/ templates/
├── context/        # AuthContext, GameContext
├── hooks/          # 16 custom hooks
├── services/       # api.ts (Axios), socket.ts (Socket.IO)
├── store/          # useUiStore.ts (estado UI global)
├── types/          # index.ts — tipos compartidos
├── i18n/           # index.ts config, es.json, en.json
├── utils/          # helpers (scoring, routing, telemetría)
├── constants/      # constantes del juego
├── data/           # datos estáticos del cliente
├── config/         # configuración por entorno
└── App.tsx         # Router principal
```

### Páginas (`src/pages/`)

| Página | Descripción |
|---|---|
| `HomePage.tsx` | Landing / bienvenida |
| `LoginPage.tsx` | Autenticación |
| `RegisterPage.tsx` | Registro |
| `MenuPage.tsx` | Hub principal de navegación |
| `GamePage.tsx` | Juego clásico single-player |
| `FlashGamePage.tsx` | Modo flash 60 segundos |
| `DuelPage.tsx` | Duelo PvP en tiempo real |
| `SurvivalPage.tsx` | Modo survival multijugador con eliminación |
| `ChallengesPage.tsx` | Lista de desafíos personalizados |
| `ChallengeGamePage.tsx` | Jugar un desafío |
| `ChallengeResultsPage.tsx` | Resultados del desafío |
| `DailyChallengePage.tsx` | Desafío diario con streak |
| `RankingsPage.tsx` | Leaderboards global / temporada |
| `ProfilePage.tsx` | Perfil, stats, achievements |
| `ResultsPage.tsx` | Resumen de resultados |

### Diseño atómico de componentes

```
atoms/       Button, Input, Card, Badge, Alert, Icon, FormLabel, SectionTitle,
             StatCard, UserAvatar
molecules/   CategorySelector, EmptyState, FilterDrawer, FormField,
             FullScreenError, GameModeCard, ListItem, PageHeader
organisms/   Header, Modal, ScreenLayout
templates/   AuthPageTemplate, PageTemplate
```

Componentes de juego independientes: `QuestionCard`, `OptionButton`, `Timer`, `ProgressBar`,
`MapInteractive`, `ScoreDisplay`, `StreakCombo`, `MechanicsHud`, `FlashCard`, `GameRoundScaffold`, etc.

### Estado y contextos

- **`AuthContext`** — login/logout, token JWT en localStorage, datos del usuario autenticado.
- **`GameContext`** — estado de partida, respuestas, scoring, caché offline (IndexedDB via `useOfflineQuestions`).
- **`useUiStore`** — estado UI global (Zustand-like, sin dependencia externa).

### Hooks personalizados (`src/hooks/`)

- `useApi` — wrapper genérico sobre Axios
- `useFormValidation` — validación con Zod
- `useOfflineQuestions` — caché IndexedDB con mínimo 10 preguntas de fallback
- `useGesture` / `useHaptics` — soporte móvil
- `useInstallPrompt` — prompt de instalación PWA
- `useStreakShareImage` / `useWebShare` — compartir resultados nativamente
- `useLocalStorage`, `useMediaQuery`, `useDebounce`, `useWindowSize` — utilidades generales

### Servicio API (`src/services/api.ts`)

Instancia singleton de Axios con:
- **Request interceptor:** inyecta `Authorization: Bearer <token>` desde localStorage; añade header de bypass para tests e2e.
- **Response interceptor:** redirige a login en 401; maneja timeouts, errores de red, rate-limit.
- Métodos: `getMe`, `login`, `register`, `startGame`, `submitAnswer`, `finishGame`, `getLeaderboard`, `getDuelHistory`, `getDuelStats`, `joinDuel`, `getChallenges`, `joinChallenge`, `getDailyChallenge`, `joinSurvival`, etc.

### i18n

- Idiomas: **Español** (fallback) y **Inglés**
- Detección de idioma: `localStorage` → idioma del navegador
- Archivos: `src/i18n/es.json`, `src/i18n/en.json`
- Agregar nueva clave: añadir en ambos archivos con la misma estructura.

### Variables de entorno frontend

```bash
VITE_API_URL=http://localhost:3001/api   # Backend API
VITE_SOCKET_URL=http://localhost:3001    # WebSocket
VITE_ENABLE_TEST_AUTH_BYPASS=false       # Solo para e2e tests
VITE_BASE_PATH=/                         # Sub-ruta para GitHub Pages
```

---

## Backend (`backend/`)

### Stack

| Herramienta | Versión | Rol |
|---|---|---|
| Node.js | 20 | Runtime |
| Express | 4.18.3 | HTTP server |
| TypeScript | 5.4.2 (strict) | Tipado |
| Prisma | 5.10.0 | ORM para PostgreSQL |
| PostgreSQL | 16 | Base de datos principal |
| Redis | 7 / ioredis 5.3.2 | Caché leaderboards, sesiones |
| Socket.IO | 4.7.4 | WebSocket (duelos, survival) |
| jsonwebtoken | 9.0.2 | Autenticación JWT |
| bcryptjs | 2.4.3 | Hash de contraseñas |
| Helmet | 7.1.0 | Headers de seguridad |
| Zod | 3.22.4 | Validación de requests |
| express-rate-limit | 8.2.1 | Rate limiting en /api |
| Vitest | 1.3.1 | Unit tests |

### Scripts principales

```bash
cd backend
npm run dev          # tsx watch (hot reload)
npm run build        # tsc → dist/
npm run start        # node dist/index.js
npm run start:prod   # prisma migrate deploy + start
npm run db:migrate   # Crear nueva migración Prisma
npm run db:push      # Sync schema sin migración (solo desarrollo)
npm run seed         # Poblar datos de prueba
npm run test         # Vitest
npm run lint         # tsc --noEmit
npm run rebuild:leaderboards  # Script admin: reconstruir leaderboards
```

### Estructura de carpetas

```
backend/src/
├── controllers/     # auth, game, leaderboard, challenge
├── services/        # game, leaderboard, challenge, achievement
├── middleware/      # auth.ts (JWT), rateLimit.ts
├── sockets/         # index.ts, duel.handler.ts, survival.handler.ts, duel.utils.ts
├── config/          # env.ts, database.ts, redis.ts
├── utils/           # scoring.ts, haversine.ts
├── scripts/         # scripts admin
├── __tests__/       # 20 archivos de tests
├── seed.ts          # Seed de datos
└── index.ts         # Entry point (Express + Socket.IO + graceful shutdown)
```

### Controladores y rutas

| Controlador | Rutas clave |
|---|---|
| `auth.controller.ts` | POST /register, POST /login, GET /me, PATCH /profile |
| `game.controller.ts` | POST /start, POST /answer, POST /finish, GET /history, GET /category-stats, GET /duel-history, GET /duel-stats, GET /duel-opponents, GET /duel-head-to-head |
| `leaderboard.controller.ts` | GET /global, GET /season, POST /rebuild (admin) |
| `challenge.controller.ts` | GET /, POST /create, POST /join, POST /complete |

### Servicios

- **`game.service.ts`** — Lógica central: selección de preguntas, validación de respuestas, cálculo de puntaje, mecánicas de juego, persistencia de resultados.
- **`leaderboard.service.ts`** — Leaderboard global y por temporada (Redis-backed), rebuild idempotente al startup.
- **`challenge.service.ts`** — Creación y participación en desafíos personalizados.
- **`achievement.service.ts`** — Evaluación de logros post-game y post-daily.

### Middleware

- **`auth.ts`**: `authenticateJWT()` (requerido), `optionalAuth()` (sin-op si falta). Soporta bypass para tests: header `x-test-auth-bypass: <secret>`.
- **`rateLimit.ts`**: Rate limiter solo en rutas `/api`. No aplica a `/ping` ni `/health`.

### Socket.IO (`src/sockets/`)

- **`index.ts`**: Autenticación por JWT en handshake, mapa `userId → socketId` para emissions dirigidas, cleanup en disconnect.
- **`duel.handler.ts`**: `MatchmakingQueue` con timeout, eventos `join_duel_queue`, `leave_duel_queue`, `duel_start`, `duel_answer`, `duel_finish`, `duel_opponent_abandoned`. Puntaje del oponente se emite en tiempo real.
- **`survival.handler.ts`**: Eliminación dinámica de jugadores por respuesta incorrecta, leaderboard en tiempo real, modo espectador para eliminados.

### Variables de entorno backend

```bash
DATABASE_URL=postgresql://...           # PostgreSQL
REDIS_URL=redis://...                   # Redis
JWT_SECRET=...                          # Firma JWT
JWT_EXPIRES_IN=7d                       # Expiración (7d prod, 24h dev)
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://...                # CORS origin
ENABLE_TEST_AUTH_BYPASS=false           # Solo para e2e tests
ENABLE_COMBO_SCORING=true               # Scoring progresivo (flash mode)
```

---

## Base de datos

### Schema Prisma (`backend/prisma/schema.prisma`)

#### Modelos principales

| Modelo | Descripción |
|---|---|
| `User` | username, email, passwordHash, preferredLanguage, highScore, gamesPlayed, wins, losses, dailyStreak, lastDailyDate |
| `Question` | category, questionData, options[], correctAnswer, imageUrl, lat/lng, continent, difficulty, isAvailable, isInsular, isLandlocked, subregion, populationTier, areaTier, flagComplexity |
| `GameResult` | userId, score, correctCount, totalQuestions, category, gameMode, details (JSON) |
| `Challenge` | creatorId, status, categories[], maxPlayers, questionIds[], filters (JSON), winnerId, expiresAt |
| `ChallengeParticipant` | challengeId, userId, score, correctCount |
| `DuelMatch` | player1Id, player2Id, winnerId, player1Score, player2Score, category |
| `SurvivalMatch` | metadata de partidas survival |
| `UserAchievement` | userId, key, earnedAt |

#### Enums

- `Category`: MAP, FLAG, CAPITAL, SILHOUETTE, MONUMENT, MIXED
- `Difficulty`: EASY, MEDIUM, HARD
- `GameMode`: SINGLE, DUEL, CHALLENGE, SURVIVAL
- `ChallengeStatus`: PENDING, IN_PROGRESS, COMPLETED

### Flujo de migraciones

```bash
# Agregar campo al schema.prisma, luego:
cd backend
npm run db:migrate   # Genera migración en prisma/migrations/ y la aplica
# Comitear el schema.prisma Y el directorio de migración generado
```

**Regla crítica:** Nunca modificar `schema.prisma` sin crear la migración correspondiente. `npm run predeploy` detecta este desajuste.

Migraciones actuales (10 total, hasta `20260521_add_survival_mode`).

---

## Datos de juego (`data/`)

| Archivo | Contenido |
|---|---|
| `countries.json` | 195+ países: nombre, capital, continente, coordenadas, código ISO |
| `cities.json` | 1000+ ciudades con coordenadas |
| `monuments.json` | 50+ monumentos: nombre (EN/ES), país, coordenadas, URL imagen Wikimedia, atribución |
| `country-catalog.v1.json` | Metadata extendida: subregión, población, área, complejidad de bandera, insular/landlocked |

Para agregar monumentos: editar `data/monuments.json` y luego ejecutar el script de seed para importarlos a la DB.

---

## Mecánicas de juego

### Modos de juego

| Modo | Descripción | Preguntas | Tiempo |
|---|---|---|---|
| Single | Clásico sin presión de tiempo | 10 | 10s/pregunta |
| Flash | 60 segundos, respuestas rápidas | Ilimitadas | 60s total |
| Streak | Infinitas, un error termina el juego | Ilimitadas | 10s/pregunta |
| Duel | PvP en tiempo real via WebSocket | 10 | 10s/pregunta |
| Survival | Multi-player, eliminación por error | 10-20 | 10s/pregunta |
| Challenge | Desafíos personalizados por jugadores | Configurable | Configurable |
| Daily | Un desafío por día, streak tracking | 10 | 10s/pregunta |

### Sistema de puntaje

- **Base**: 100 pts (single/streak), 10 pts (flash)
- **Bonus tiempo**: Hasta 50 pts según tiempo restante
- **Combo flash**: Tiers `[x1, x1, x2, x2, x3, x3, x5, x5, x8, x8, x10]`
- **Mapa**: Bonus por precisión de distancia (haversine)
- **Estrategia configurable**: `ENABLE_COMBO_SCORING` activa scoring progresivo vs simple 1/0

### Mecánicas (power-ups)

- **Intel 5050**: Elimina 2 respuestas incorrectas (1 uso/partida)
- **Focus Time**: +3 segundos extra (1 uso/partida)
- **Streak Shield**: Protege el streak ante un error (1 uso/partida)

---

## Tests

### Frontend (`frontend/src/__tests__/` — 38 archivos)

- Vitest + React Testing Library + jest-dom
- Cubre: componentes, hooks, contextos, páginas, flujos de autenticación, events de socket

### Frontend E2E (`frontend/tests/e2e/` — 3 archivos)

- Playwright: `home.spec.ts`, `game-layout.spec.ts`, `game-layout-darkmode.spec.ts`

### Backend (`backend/src/__tests__/` — 20 archivos)

- Vitest
- Cubre: auth, inicio de partida, scoring, leaderboards, timeouts de duelos, survival, daily streak

### Test auth bypass

Para e2e tests sin registro real:
- Backend: `ENABLE_TEST_AUTH_BYPASS=true` + header `x-test-auth-bypass: <secret>`
- Frontend: `VITE_ENABLE_TEST_AUTH_BYPASS=true` + `src/utils/testAuthBypass.ts`

---

## CI/CD

### Workflows (`.github/workflows/`)

| Workflow | Trigger | Pasos |
|---|---|---|
| `backend-quality.yml` | PR / push a master | lint → test → build |
| `frontend-quality.yml` | PR / push a master | lint → test → build |
| `deploy-frontend-pages.yml` | Push a master (frontend/) | quality gate → deploy GitHub Pages |
| `keep-backend-awake.yml` | Cada 5 minutos (cron) | GET /ping → previene sleep en Render free |

### Deploy en Render (`render.yaml`)

**Backend (geochallenge-api):**
- Build: `npm install && npm run build`
- Pre-deploy: `npx prisma migrate deploy`
- Start: `npm start`

**Frontend (geochallenge):**
- Build: `npm install && npm run build`
- Publish: `dist/` (estático)
- Routes: `/* → /index.html` (SPA fallback)

### Deploy Docker (VPS)

`docker-compose.yml` levanta: PostgreSQL 16 + Redis 7 + Backend + Caddy (HTTPS auto).

---

## Convenciones de código

### TypeScript

- **Strict mode** en ambos proyectos — no usar `any` sin justificación.
- Tipos compartidos en `frontend/src/types/index.ts`.
- Validación de requests con Zod (backend) y zod (frontend en forms).
- No crear archivos `.ts/.tsx` sin agregarlos al repositorio (trampa del predeploy check #1).

### Componentes React

- Diseño atómico: atoms → molecules → organisms → templates → pages.
- Hooks primero: extraer lógica compleja a custom hooks antes de ponerla en el componente.
- No comentarios obvios; solo cuando el WHY no sea evidente.
- i18n obligatorio: usar `useTranslation()` de react-i18next para toda cadena visible.

### Backend

- MVC estricto: controllers enrutan, services implementan, Prisma persiste.
- JWT en header `Authorization: Bearer <token>`.
- Rate limiting solo en `/api` (no en health checks).
- Nuevas rutas: agregar middleware `authenticateJWT` salvo que sea pública.

### Git

- Commits descriptivos en inglés o español (consistente con el historial).
- Nunca mergear a `master` sin pasar `npm run predeploy`.
- Al agregar un modelo/campo nuevo al schema, siempre crear la migración.

---

## Desarrollo local

### Setup inicial

```bash
# 1. Instalar dependencias
cd frontend && npm install
cd ../backend && npm install

# 2. Configurar entorno
cp backend/.env.example backend/.env   # Rellenar DATABASE_URL, REDIS_URL, JWT_SECRET
cp frontend/.env.example frontend/.env

# 3. Levantar PostgreSQL y Redis (con Docker)
docker-compose up -d postgres redis

# 4. Aplicar migraciones y seed
cd backend && npm run db:migrate && npm run seed

# 5. Iniciar ambos servidores
cd backend && npm run dev    # :3001
cd frontend && npm run dev   # :5173 (proxy → :3001)
```

### Flujo de trabajo habitual

```bash
# Antes de hacer push
npm run predeploy   # Desde la raíz del monorepo

# Agregar campo a la DB
# 1. Editar backend/prisma/schema.prisma
# 2. cd backend && npm run db:migrate
# 3. Comitear schema.prisma + directorio de migración
```
