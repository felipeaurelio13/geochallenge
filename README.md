# GeoChallenge

Juego de trivia geográfica con modos individual, duelos en tiempo real y desafíos entre amigos.


## Versión actual

- Frontend: **v1.1.20**











## Novedades de la versión 1.1.20
- Ajuste mobile-first de consistencia visual en Home y Menú: se reforzó la contención horizontal de layout (`overflow-x-clip`) para evitar desbordes involuntarios entre secciones en pantallas pequeñas.
- Se añadieron mejoras de coherencia en tarjetas y textos (`min-w-0` y `break-words`) para que el contenido interno respete los márgenes del contenedor y no se salga visualmente.
- Se ajustaron áreas seguras móviles en header/CTA inferior del menú para mejorar estabilidad visual en dispositivos con notch o barras del sistema.
- Pruebas automatizadas actualizadas para validar contención visual y versión del footer.
- Footer actualizado a **v1.1.20** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.19
- Mejora mobile-first en partida individual para categoría **Banderas**: las alternativas ahora se muestran en una sola columna en pantallas pequeñas, priorizando legibilidad y evitando toques accidentales cuando hay imagen de bandera en pantalla.
- En pantallas medianas o mayores se conserva la grilla de dos columnas para mantener densidad visual sin perder claridad.
- Se actualizó la suite de pruebas de `GamePage` incorporando un caso específico para categoría `FLAG` que valida este comportamiento responsive y previene regresiones.
- Footer actualizado a **v1.1.19** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.18
- Mejora mobile-first de navegación en menú: se aumentó el área táctil mínima de acciones clave (rankings, perfil, cerrar sesión y categorías) para facilitar interacción con pulgar y reducir toques erróneos.
- Se añadió una pista contextual en móvil para el carrusel de categorías ("Desliza para ver más categorías"), mejorando descubribilidad y usabilidad sin recargar la interfaz.
- Se actualizaron traducciones i18n (ES/EN) y pruebas automatizadas para validar la nueva pista mobile y mantener cobertura funcional.
- Footer actualizado a **v1.1.18** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.17
- Mejora mobile-first en el menú principal: selección de categoría convertida en carrusel horizontal con `snap`, reduciendo saturación visual y facilitando el alcance con pulgar en pantallas pequeñas.
- Se añadió un CTA fijo inferior para iniciar partida individual con la categoría activa visible, priorizando acción principal y disminuyendo fricción en móvil.
- El menú ahora incluye footer con versión de app para trazabilidad del despliegue en GitHub Pages, alineado con el resto de vistas.
- Pruebas automatizadas actualizadas para validar el CTA mobile y la versión visible en footer.
- Footer actualizado a **v1.1.17** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.16
- Recomendación aplicada: el badge principal del Home dejó de estar hardcodeado y ahora usa i18n (`home.badge`), mejorando consistencia multilenguaje y usabilidad para usuarios en inglés.
- Se añadieron/actualizaron pruebas para validar el texto del badge y la versión visible en el footer.
- Footer actualizado a **v1.1.16** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.15

- Se reforzó la estabilidad del inicio de duelos agregando un timeout de seguridad de "ready": si ambos jugadores quedan emparejados pero uno no confirma, el backend fuerza el arranque para evitar bloqueos en estado de espera.
- Se añadió un evento explícito (`duel:ready-timeout`) para dejar trazabilidad del arranque forzado y facilitar monitoreo/diagnóstico del matchmaking en producción.
- Nuevas pruebas automatizadas para blindar la lógica de timeout del estado `waiting` y prevenir regresiones en el flujo de inicio.
- Footer actualizado a **v1.1.15** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.14

- Mejora mobile-first en vistas de desafío y duelo: las alternativas ahora se renderizan en grilla de 2 columnas para mostrar todas las opciones más rápido y reducir el scroll en pantallas pequeñas.
- Se agregaron pruebas automatizadas nuevas para validar la grilla de alternativas en `ChallengeGamePage` y `DuelPage`, manteniendo cobertura de UX en flujos clave.
- Footer actualizado a **v1.1.14** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.13

- Se incorporó un bypass de autenticación **seguro y explícito para tests** que evita bloquear la ejecución automática cuando no hay sesión iniciada.
- El bypass requiere cabecera secreta (`x-test-auth-bypass`) y sólo se activa en entorno de testing o cuando se habilita por variables de entorno, manteniendo protección en producción.
- Se añadió utilitario de frontend para inyectar el bypass en pruebas y fallback de autenticación en `AuthContext` para mejorar estabilidad de tests E2E/integración.
- Nuevas pruebas automatizadas para validar la configuración del bypass en frontend y backend.
- Footer actualizado a **v1.1.13** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.12

- Reorganización mobile-first de alternativas en juego individual: ahora se muestran en una grilla de 2 columnas para reducir el scroll y mantener todas las opciones visibles más rápido en pantallas pequeñas.
- Ajuste visual minimalista en cada botón de alternativa (espaciado, tipografía y tamaños) para mejorar legibilidad y densidad sin perder accesibilidad.
- Nueva prueba automatizada en `GamePage` para validar la grilla de dos columnas y actualización de pruebas del botón de alternativa para el nuevo tamaño compacto.
- Footer actualizado a **v1.1.12** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.11

- Optimización mobile-first del bloque de alternativas para que entren mejor en pantalla sin scroll innecesario: menor altura mínima, padding más compacto y tipografía ajustada en pantallas pequeñas.
- Badge de selección adaptado para mobile con icono compacto, conservando el texto completo en pantallas mayores para mantener claridad y accesibilidad.
- Se actualizó la prueba del botón de alternativa para validar explícitamente la nueva configuración compacta orientada a móvil.
- Footer actualizado a **v1.1.11** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.10

- Se corrigieron y estandarizaron textos en español para respetar tildes, signos de apertura (¿, ¡) y ortografía en la experiencia completa.
- Se reforzó la calidad con una prueba automatizada nueva para validar traducciones críticas en español y prevenir regresiones de acentuación.
- Footer actualizado a **v1.1.10** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.9

- Se incorporó selección integral de categoría en duelos: ahora puedes buscar partidas de **solo banderas, solo capitales, solo mapas, solo siluetas o mixto** desde el menú principal.
- Matchmaking de duelos ajustado para respetar la categoría elegida por ambos jugadores, evitando cruces inconsistentes entre modos.
- El reintento de duelo conserva la categoría activa para mantener una experiencia coherente y predecible.
- Se agregaron pruebas automatizadas en frontend y backend para blindar el ruteo por categoría y el emparejamiento por tipo de duelo.
- Footer actualizado a **v1.1.9** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.8

- Se rediseñó el modelo de puntuación para que sea transversal, objetivo y coherente entre modos: ahora la velocidad de respuesta impacta de forma explícita en el puntaje en preguntas de opción múltiple y también en preguntas de mapa.
- En preguntas de mapa, el puntaje ya no depende solo de acertar/fallar: combina precisión geográfica (distancia) + rapidez para premiar mejor desempeño real.
- En duelos, además del score total, se agregó un desempate objetivo por tiempo restante acumulado cuando ambos jugadores terminan con el mismo puntaje.
- Se reforzaron pruebas automatizadas de scoring y de desempate en duelos para cubrir estos nuevos criterios y evitar regresiones.
- Footer actualizado a **v1.1.8** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.7

- Corregido el resumen de progreso en partida individual: ahora cada indicador solo se pinta verde/rojo si esa pregunta ya fue respondida, evitando que preguntas no respondidas aparezcan en rojo.
- Ajustada la lógica para que la pregunta activa se marque correctamente como actual incluso cuando el avance y los resultados llegan desfasados temporalmente.
- Se reforzó la suite de pruebas con un caso que reproduce este desajuste y previene regresiones en el indicador superior.
- Footer actualizado a **v1.1.7** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.6

- Estandarizados los indicadores de respuesta correcta/incorrecta en juego individual, duelo y resumen final usando un mismo componente visual reutilizable.
- Se alineó el feedback de selección y resultado entre botones de alternativas y paneles de resultado para mantener coherencia total en mobile y desktop.
- Se agregaron nuevas claves de i18n para etiquetas consistentes de estado de respuesta (correcta/incorrecta y opción seleccionada).
- Se incorporó una prueba automatizada para el nuevo badge de estado y se actualizaron pruebas existentes de botón/versión.
- Footer actualizado a **v1.1.6** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.5

- Auditoría de buenas prácticas aplicada al manejo de versión en frontend: el footer ahora consume automáticamente la versión real del paquete en build para evitar desalineación entre app y despliegue en GitHub Pages.
- Se tipó la constante global de versión (`__APP_VERSION__`) para mantener seguridad de tipos y evitar accesos implícitos.
- Se reforzó la prueba de Home para validar que el footer renderiza la versión activa esperada.
- Footer actualizado a **v1.1.5** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.4

- Corregida una condición de carrera en duelos que podía resolver la misma pregunta más de una vez bajo latencia/reintentos, provocando auto-respuestas aparentes en ambos jugadores.
- Se agregó un candado de resolución por índice de pregunta (`resolvingQuestionIndex`) para garantizar idempotencia del cierre por pregunta.
- Se añadió protección de respuesta en vuelo por jugador (`pendingQuestionIndex`) para evitar duplicados mientras se valida en backend.
- Se reforzó la suite de pruebas en backend para cubrir escenarios de auto-cierre y resolución única.
- Footer actualizado a **v1.1.4** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.3

- En preguntas de mapa, cada nueva pregunta ahora inicia desde una vista neutral global para evitar perder tiempo reubicando el mapa entre intentos consecutivos.
- Se corrigió el estado visual del resumen de progreso: cada burbuja ahora refleja el resultado real de su pregunta (verde/roja) en lugar de depender del total acumulado de aciertos.
- Se dejó explícito en backend el umbral de acierto para mapa (`< 500 km`) para mantener consistencia entre puntaje y estado correcto/incorrecto.
- Se agregaron pruebas automatizadas para cubrir el reset de viewport en mapa y la lógica de estado por pregunta en la barra de progreso.
- Footer actualizado a **v1.1.3** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.2

- Corregido un bug crítico en duelos: timers pendientes de preguntas anteriores podían auto-cerrar preguntas nuevas, haciendo que varias respuestas se marcaran solas sin interacción del jugador.
- Se agregó una guarda explícita de índice de pregunta para que cada timeout solo afecte a la pregunta para la que fue programado.
- Se incorporó una prueba automatizada para blindar este comportamiento y evitar regresiones en el flujo multijugador.
- Footer actualizado a **v1.1.2** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.1

- Corregido el flujo final de partida en modo individual: la pantalla de resultados ya no desaparece al instante y permanece visible para revisar puntaje, aciertos y acciones posteriores.
- Se agregó prueba automatizada del flujo de fin de partida para asegurar que no se resetee el estado al navegar a resultados.
- Footer actualizado a **v1.1.1** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.0

- Correcciones de ortografía y acentuación en español (incluye “Iniciar sesión”) para una experiencia más cuidada.
- Vista de login refinada para modo oscuro con CTA de “Entrar” más claro y apariencia inequívoca de botón en móvil.
- Pantalla de selección de modo de juego rediseñada (header y cuerpo) con enfoque mobile-first, mayor jerarquía visual y mejor legibilidad.
- Footer actualizado a **v1.1.0** para mantener trazabilidad con el despliegue en GitHub Pages.
- Mejorado el estado visual de alternativas en preguntas: selección más evidente (anillo, contraste y badge) para reducir dudas en móvil.
- Header de juego fijado arriba (sticky) para mantener el temporizador siempre visible mientras haces scroll en preguntas largas o mapas.
- Botones de login, registro y acciones de juego actualizados con apariencia de CTA clara y feedback de carga/press para mejor percepción de respuesta.
- Home refinado con layout mobile-first más compacto y jerarquía visual optimizada para primera interacción en teléfonos.
- Footer actualizado a **v1.0.9** para reflejar la versión desplegada en GitHub Pages.
- Reparado el flujo completo de duelos para evitar efectos secundarios de re-suscripción en sockets (causaban comportamientos erráticos de respuestas en pantalla) y mantener estado consistente al actualizar puntajes.
- Mejorado el envío de respuestas de mapa en duelos: ahora se incluyen coordenadas reales para validación correcta en backend.
- Footer de la app actualizado a **v1.0.9** para mantener trazabilidad con el despliegue en GitHub Pages.
- Corregido el flujo de fin de partida en modo individual: ahora `Ver resultado` mantiene el estado de la sesión y muestra la pantalla de resultados en lugar de redirigir al home/menu.
- Rediseño de la vista principal con enfoque **mobile-first**, mejor jerarquía visual y CTA más claros para mejorar la usabilidad inicial.
- Feedback visual mejorado al seleccionar alternativas (estado activo más claro con realce y etiqueta de selección), manteniendo un enfoque mobile-first y accesible.
- En preguntas de mapa, al mostrar un resultado incorrecto la vista ahora ajusta automáticamente el encuadre para mostrar tanto tu selección como la ubicación correcta, evitando que tengas que desplazar el mapa manualmente.

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
