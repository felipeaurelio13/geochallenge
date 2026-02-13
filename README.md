# GeoChallenge

Juego de trivia geográfica con modos individual, duelos en tiempo real y desafíos entre amigos.


## Versión actual

- Frontend: **v1.0.4**

## Requisitos Previos

- **Node.js** v18 o superior
- **PostgreSQL** v14 o superior
- **Redis** v6 o superior (para leaderboards y duelos)

## Estructura del Proyecto

```
geochallenge/
├── backend/          # API Node.js + Express + Socket.IO
├── frontend/         # React + Vite + TypeScript
└── data/             # Datos de países (JSON)
```

---

## Paso 1: Configurar PostgreSQL

### Opción A: Con Docker (recomendado)
```bash
docker run --name geochallenge-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=geochallenge \
  -p 5432:5432 \
  -d postgres:14
```

### Opción B: Instalación local
1. Instalar PostgreSQL
2. Crear base de datos:
```sql
CREATE DATABASE geochallenge;
```

---

## Paso 2: Configurar Redis

### Opción A: Con Docker (recomendado)
```bash
docker run --name geochallenge-redis \
  -p 6379:6379 \
  -d redis:7
```

### Opción B: Instalación local
Instalar Redis y asegurarse de que esté corriendo en el puerto 6379.

---

## Paso 3: Configurar el Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo de variables de entorno
cp .env.example .env
```

### Editar el archivo `.env`:
```env
# Base de datos
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/geochallenge?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="tu-secreto-super-seguro-cambiar-en-produccion"

# Server
PORT=3001
NODE_ENV=development
```

### Ejecutar migraciones y seed:
```bash
# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# Poblar base de datos con preguntas (196 países × 4 categorías = 784 preguntas)
npm run seed
```

### Iniciar el servidor:
```bash
npm run dev
```

El backend estará disponible en: `http://localhost:3001`

---

## Paso 4: Configurar el Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Crear archivo de variables de entorno
cp .env.example .env
```

### Editar el archivo `.env`:
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### Iniciar el servidor de desarrollo:
```bash
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

---

## Paso 5: Crear un usuario de prueba

### Opción A: Usar el formulario de registro
1. Ir a `http://localhost:5173`
2. Click en "Registrarse"
3. Completar el formulario

### Opción B: Crear usuario via API (curl)
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@test.com",
    "password": "123456"
  }'
```

### Opción C: Modo desarrollo (bypass login)
Agregar `?dev=true` a la URL para activar el modo desarrollo:
```
http://localhost:5173?dev=true
```

---

## Comandos Útiles

### Backend
```bash
npm run dev          # Iniciar en modo desarrollo
npm run build        # Compilar TypeScript
npm run start        # Iniciar en producción
npm run seed         # Poblar base de datos
npm test             # Ejecutar tests
npx prisma studio    # Abrir GUI de base de datos
```

### Frontend
```bash
npm run dev          # Iniciar en modo desarrollo
npm run build        # Compilar para producción
npm run preview      # Vista previa de producción
npm test             # Ejecutar tests
```

---

## Troubleshooting

### Error: "Cannot connect to database"
- Verificar que PostgreSQL esté corriendo
- Verificar el `DATABASE_URL` en `.env`
- Probar conexión: `psql -U postgres -d geochallenge`

### Error: "Redis connection refused"
- Verificar que Redis esté corriendo
- Verificar el `REDIS_URL` en `.env`
- Probar conexión: `redis-cli ping`

### Error: "CORS error" en el frontend
- Verificar que el backend esté corriendo en el puerto 3001
- Verificar `VITE_API_URL` en el `.env` del frontend

### Error: "Invalid token" o "Unauthorized"
- Limpiar localStorage: `localStorage.clear()` en la consola del navegador
- Registrar un nuevo usuario

### Las preguntas no aparecen
- Ejecutar `npm run seed` en el backend
- Verificar en Prisma Studio: `npx prisma studio` y revisar la tabla `Question`


### En duelos se hace match pero no cargan preguntas
- Verificar que el frontend escuche eventos `duel:question`, `duel:questionResult` y `duel:finished` (no `game:*`).
- Verificar que al enviar respuesta se envíe `timeRemaining` en `duel:answer`.
- Verificar que ambos clientes emitan `duel:ready` tras el match para iniciar countdown.

---

## Modos de Juego

1. **Un Jugador**: Partida individual con 10 preguntas
2. **Duelo**: Competencia en tiempo real contra otro jugador
3. **Desafío**: Envía un desafío a un amigo para jugar de forma asíncrona

## Categorías

- **Banderas**: Identificar países por su bandera
- **Capitales**: Asociar países con sus capitales
- **Mapas**: Ubicar ciudades/capitales en el mapa mundial
- **Siluetas**: Identificar países por su forma geográfica
- **Mixto**: Combinación de todas las categorías

---

## Tecnologías

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- Socket.IO
- JWT Authentication
- bcrypt

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router v6
- i18next (ES/EN)
- Leaflet (mapas)
- Socket.IO Client
