# GeoChallenge

GeoChallenge es un juego full-stack de trivia geografica. Incluye modos single-player, racha, flash, duelos en tiempo real, desafios entre amigos, rankings y categorias de preguntas como paises, capitales, mapas, siluetas y monumentos.

## Estado actual

- Rama principal: `master`
- Frontend: React 18 + Vite + TypeScript + Tailwind + i18n + PWA
- Backend: Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis + Socket.IO
- Frontend de produccion: GitHub Pages / sitio estatico
- Backend de produccion: Render o VPS Docker, segun despliegue
- Version visible del frontend: definida en `frontend/package.json`

## Estructura

```text
geochallenge/
├── frontend/              # SPA React + Vite + Tailwind
├── backend/               # API Express + Socket.IO + Prisma
├── data/                  # Catalogos canonicos del juego
├── docs/                  # Auditorias y notas tecnicas
├── scripts/               # Automatizaciones del repo
├── .github/workflows/     # CI y deploy frontend
├── docker-compose.yml     # Stack completo para VPS
├── render.yaml            # Servicios Render
├── DEPLOY.md              # Playbook de deploy/predeploy
└── DEPLOY-ORACLE.md       # Guia VPS Oracle Cloud Always Free
```

## Funcionalidad principal

- Modos de juego:
  - `single`: partida clasica.
  - `streak`: racha infinita hasta fallar.
  - `flash`: respuestas rapidas por tiempo.
  - `duel`: PvP en tiempo real via Socket.IO.
  - `challenge`: desafios creados por usuarios.
  - `daily`: desafio diario.
- Categorias:
  - `MAP`
  - `FLAG`
  - `CAPITAL`
  - `SILHOUETTE`
  - `MONUMENT`
  - `MIXED`
- Rankings globales y por contexto.
- Autenticacion JWT.
- PWA con soporte movil.
- i18n en español e ingles.

## Requisitos locales

- Node.js 20
- npm
- Docker y Docker Compose, recomendado para PostgreSQL y Redis locales
- Git

## Setup local

Instala dependencias:

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

Copia variables de entorno:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Levanta dependencias locales:

```bash
docker compose up -d postgres redis
```

Aplica migraciones y carga datos:

```bash
npm --prefix backend run db:migrate
npm --prefix backend run seed
```

Arranca backend y frontend en terminales separadas:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

URLs por defecto:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001/api`
- Backend health: `http://localhost:3001/health`

## Scripts principales

Desde la raiz:

```bash
npm run predeploy          # chequeo obligatorio antes de push a master
npm run lint               # lint/typecheck frontend + backend
npm run test               # tests frontend + backend
npm run format:check       # valida formato
npm run validate:cinema-geo
```

Frontend:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend run lint:strict
npm --prefix frontend run test
npm --prefix frontend run test:e2e
npm --prefix frontend run ci:quality
```

Backend:

```bash
npm --prefix backend run dev
npm --prefix backend run build
npm --prefix backend run lint
npm --prefix backend run test
npm --prefix backend run db:migrate
npm --prefix backend run db:generate
npm --prefix backend run seed
npm --prefix backend run rebuild:leaderboards
```

## Variables de entorno

Frontend (`frontend/.env`):

```bash
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_ENABLE_TEST_AUTH_BYPASS=false
VITE_TEST_AUTH_BYPASS_SECRET=
VITE_TEST_AUTH_BYPASS_EMAIL=test-runner@geochallenge.local
VITE_TEST_AUTH_BYPASS_USERNAME=TestRunner
```

Backend (`backend/.env`):

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/geochallenge?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me"
JWT_EXPIRES_IN="24h"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
ADMIN_TOKEN=""
```

Docker/VPS (`.env` en la raiz):

```bash
DOMAIN=geochallenge.duckdns.org
POSTGRES_PASSWORD=change-me
JWT_SECRET=change-me
```

No subas archivos `.env` reales al repositorio.

## Datos del juego

Los catalogos viven en `data/`:

- `countries.json`: fuente historica de paises.
- `country-catalog.v1.json`: catalogo canonico versionado.
- `country-catalog.meta.json`: metadata generada del catalogo.
- `cities.json`: ciudades para preguntas geograficas.
- `monuments.json`: monumentos con nombre, pais, coordenadas, imagen y atribucion.
- `cinema/`: dataset de cine con validaciones propias.

Para agregar o ajustar datos:

1. Edita el JSON correspondiente.
2. Valida integridad si existe script asociado.
3. Ejecuta seed backend.
4. Corre tests proporcionales al cambio.

Comandos utiles:

```bash
npm --prefix backend run seed
npm run validate:cinema-geo
```

## Base de datos

Prisma vive en `backend/prisma/`.

Flujo para cambios de schema:

```bash
npm --prefix backend run db:migrate
npm --prefix backend run db:generate
```

Reglas importantes:

- No modificar `schema.prisma` sin crear migracion cuando el cambio afecta produccion.
- Commitar `schema.prisma` junto con el directorio nuevo en `backend/prisma/migrations/`.
- `npm run predeploy` detecta `schema.prisma` modificado sin migracion nueva.

## Tests y calidad

Checks recomendados segun alcance:

- Solo frontend: `npm --prefix frontend run ci:quality`
- Solo backend: `npm --prefix backend run lint && npm --prefix backend run test`
- Ambos lados, datos o Prisma: `npm run predeploy`
- Flujos reales, routing, auth, juego o UX critica: agregar E2E con Playwright cuando corresponda.

Antes de cualquier push a `master`, debe pasar:

```bash
npm run predeploy
```

El resultado esperado es:

```text
✓ predeploy: builds limpios
```

## Deploy

Lee primero [DEPLOY.md](DEPLOY.md). Ese documento es la fuente operativa para pushes a `master`, hooks, predeploy y errores recurrentes.

Opciones disponibles:

- GitHub Pages para frontend estatico.
- Render para backend y/o sitio estatico segun `render.yaml`.
- VPS Docker con Postgres, Redis, backend, frontend estatico y Caddy. Ver [DEPLOY-ORACLE.md](DEPLOY-ORACLE.md).

## Convenciones de desarrollo

- Mantener diffs pequeños, reversibles y faciles de revisar.
- Reutilizar patrones existentes antes de crear variantes paralelas.
- Mantener compatibilidad de contratos HTTP y Socket.IO salvo cambio explicito.
- En frontend, actualizar ES/EN cuando cambie texto visible.
- En pantallas de juego, proteger viewport movil, safe areas, CTA principal y las 4 alternativas.
- Evitar refactors oportunistas fuera de scope.
- No tocar versionado visible ni metadata de release salvo tarea explicita.

## Documentacion relacionada

- [AGENTS.md](AGENTS.md): reglas de trabajo para agentes en este repo.
- [CLAUDE.md](CLAUDE.md): contexto ampliado y routing historico de agentes.
- [DEPLOY.md](DEPLOY.md): checklist de deploy y predeploy.
- [DEPLOY-ORACLE.md](DEPLOY-ORACLE.md): deploy completo en VPS.
- [docs/ui-ux-audit-2026-04-11.md](docs/ui-ux-audit-2026-04-11.md): auditoria UI/UX.
- [docs/duel-audit-2026-05-01.md](docs/duel-audit-2026-05-01.md): auditoria de duelos.
- [data/cinema/README.md](data/cinema/README.md): notas del dataset de cine.
- [scripts/daily-agent/README.md](scripts/daily-agent/README.md): agente diario.
