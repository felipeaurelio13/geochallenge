# GeoChallenge — Design TODOs

Generado el 2026-04-30 desde un audit en vivo (mobile 375) que cubrió Home, Login, Register, Menu, Single, Flash, Duel, Challenges, Profile, Rankings, Results.

Score actual: **6/10**. Target post P0+P1: **8/10**.

Decisiones de design language tomadas en el review:
- **Iconografía**: emoji para contenido semántico (banderas de países, mapas, capitales reconocibles), icon set neutro (Lucide o Phosphor) para sistema (errores, header, modos, achievements decorativos).
- **Onboarding**: detectar `gamesPlayed === 0` y recomendar Flash como primer modo con un banner discreto.
- **DESIGN.md**: pendiente, correr `/design-consultation` para destilarlo.

---

## P0 — Critical UX bugs (rompe el juego)

### P0.1 — `FullScreenError` debe usarse de forma consistente con retry
**Where:** `frontend/src/pages/GamePage.tsx`, `frontend/src/pages/FlashGamePage.tsx`, `frontend/src/pages/RankingsPage.tsx`, `frontend/src/pages/ChallengesPage.tsx`, `frontend/src/pages/RegisterPage.tsx`, `frontend/src/pages/LoginPage.tsx`.

**Why:** El componente molecule `FullScreenError` ya soporta `onRetry`, pero los consumidores no lo pasan uniformemente. Resultado:
- Single Player error: solo "Volver al menú" (sin retry).
- Rankings error: tiene retry (correcto).
- Register error: banner inline genérico "Error al registrarse" sin causa ni recovery action — el usuario queda atascado con un formulario lleno.

**Acceptance:**
- Toda página que hace `try/catch` sobre fetch debe pasar `onRetry={() => refetch()}` al `FullScreenError`.
- Register error muestra causa específica (duplicate email, weak password, network) y mantiene el form rellenable.
- Crear test: `'cuando la API falla, FullScreenError muestra retry button'` para cada page.

---

### P0.2 — Mensaje de error miente: "Sin conexión a internet" para errores 4xx/5xx
**Where:** El default copy de `FullScreenError` o donde sea que se setea `error.message`. Buscar en `frontend/src/services/api.ts` el manejo de errores.

**Why:** Single Player y Rankings muestran "Sin conexión a internet. Verifica tu red." cuando realmente es un 404 o 500 del backend. El usuario verifica WiFi, no encuentra problema, queda confundido.

**Acceptance:**
- Mostrar "Sin conexión a internet" SOLO cuando `navigator.onLine === false` o `error instanceof TypeError && /fetch/.test(error.message)`.
- Para 4xx: "El servidor no aceptó la solicitud. Reintenta o vuelve al menú."
- Para 5xx: "El servidor está teniendo problemas. Estamos en eso."
- Para 401: redirect a `/login` con mensaje "Tu sesión expiró".

---

### P0.3 — Spinner infinito en Flash (y posiblemente otros modos)
**Where:** `frontend/src/pages/FlashGamePage.tsx` líneas 73-100.

**Why:** Si `api.startFlashGame()` no responde y no rechaza (cuelga), el usuario ve "Cargando Flash..." para siempre. No hay timeout, no hay escape.

**Acceptance:**
- Wrap el fetch en un `Promise.race` con timeout de 10s.
- Si el timeout dispara, setea `error` con mensaje "Esto está tardando más de lo normal" y un retry button.
- Aplicar el mismo patrón a GamePage, ChallengeGamePage, RankingsPage.

---

### P0.4 — Challenges muestra error + empty state simultáneamente
**Where:** `frontend/src/pages/ChallengesPage.tsx`.

**Why:** En el screenshot del audit se ven al mismo tiempo: banner "Error al cargar los desafíos" + card "Crea un desafío multijugador" + empty state "📭 No hay desafíos" + segundo CTA "Crear desafío multijugador". Cuatro elementos compitiendo, dos CTAs duplicados.

**Acceptance:**
- Si hay error: solo mostrar el error (con retry), nada más.
- Si no hay error y la lista está vacía: solo el empty state con UN CTA.
- Si la lista tiene items: mostrar items, sin el banner promocional.
- Si quieres preservar el banner "Crea un desafío" como discovery, ponlo SOLO cuando la lista tiene items (no compite con empty state).

---

## P1 — Retención y first-time UX

### P1.1 — Onboarding ligero: recomendar Flash como primer modo
**Where:** `frontend/src/pages/MenuPage.tsx`.

**Why:** Usuario nuevo (`user.gamesPlayed === 0`) cae al menú sin saber dónde empezar. Flash es el modo más self-evident (60s, low commitment).

**Acceptance:**
- Detectar `user.gamesPlayed === 0`.
- Mostrar banner sutil arriba: "✨ Empieza con Flash — 60 segundos para sentir el juego →".
- El card de Flash recibe un highlight (`ring-2 ring-primary` + un pequeño "Recomendado para ti").
- Banner se oculta tras la primera partida o si el usuario lo cierra.

---

### P1.2 — Empty state de Profile más cálido y accionable
**Where:** `frontend/src/pages/ProfilePage.tsx`, sección Estadísticas.

**Why:** Hoy muestra cards "0", "0", "0", "0%". Frío. Para un usuario nuevo es una pared.

**Acceptance:**
- Si `gamesPlayed === 0`: reemplazar las stat cards con un block "🎮 Aún no has jugado. Tu primera partida desbloquea las estadísticas → [Jugar Flash]".
- Si `gamesPlayed > 0`: mantener las cards actuales pero animar el incremento del último valor con `transition`.

---

### P1.3 — Daily streak persistente en Menu
**Where:** Header del Menu, encima de "SELECCIONA UNA CATEGORÍA".

**Why:** No hay retention hook. Sin razón para volver mañana.

**Acceptance:**
- Tracking de `lastPlayedDate` y `currentStreak` en backend.
- En el menu, banner discreto: "🔥 Racha: 3 días — juega hoy para no perderla". Si la racha se rompió ayer: "Tu racha de 3 días terminó ayer. Empieza una nueva →".
- No bloquear el menu, solo mostrar.

---

### P1.4 — Logout debe estar detrás del avatar, no como botón peer
**Where:** `frontend/src/pages/MenuPage.tsx` lines 56-65, header de TODAS las páginas.

**Why:** Hoy el botón "Cerrar sesión" 🚪 está al lado del avatar en el top bar. Tap targets adyacentes y logout es destructivo. Risk de tap accidental real.

**Acceptance:**
- Click en el avatar abre un menú (Modal o popover) con: "Mi perfil", "Configuración", divider, "Cerrar sesión" (rojo).
- Eliminar el botón 🚪 del header.
- En mobile, abrir como bottom sheet; en desktop, dropdown.

---

### P1.5 — Categorías: solucionar overflow oculto
**Where:** `frontend/src/pages/MenuPage.tsx` líneas 75-94.

**Why:** En 375px, "Mixto" queda fuera del viewport. Sin scroll-fade ni indicador visual. Usuarios no descubren el modo Mixto.

**Acceptance:**
- Agregar gradient fade en el borde derecho: `mask-image: linear-gradient(to right, black 90%, transparent)`.
- O reducir el ancho de cada chip para que las 5 entren en 375px (62×5 + 4×8gap = 342px → ya casi entran; reducir font o icon).
- O switchear a 2 filas de chips en mobile: 3 + 2.
- Test: con viewport 375px, las 5 categorías están visibles SIN scroll horizontal.

---

### P1.6 — "Racha" no debe ser modo peer; sub-modo de Single
**Where:** `frontend/src/pages/MenuPage.tsx` line 123-129.

**Why:** El código navega a `/game/single?mode=streak` — confirma que es un sub-modo. Hoy se presenta como 5to mode card (full-width). Esto fragmenta la mental model.

**Acceptance:**
- Eliminar el card "Racha" del menu.
- Dentro de la pantalla "Un Jugador", al entrar mostrar dos opciones: "Normal (10 preguntas)" / "Racha (hasta fallar)".
- O: agregar un toggle a la card "Un Jugador" del menu: ["Normal" | "Racha"].

---

## P2 — Design system y consistencia

### P2.1 — Crear DESIGN.md
**Why:** El sistema de diseño existe (atomic structure + CSS-variable tokens) pero no está documentado. Decisiones nuevas se tomarán ad-hoc.

**Acceptance:**
- Correr `/design-consultation` para destilar el sistema actual.
- DESIGN.md cubre: paleta de tokens, tipografía, spacing scale, radius scale, sombras, motion, componentes core con ejemplos, do's/don'ts.
- Linkear desde CLAUDE.md.

---

### P2.2 — Reemplazar emoji-decoración con icon set
**Why:** Decisión tomada en review: emoji para semántica (banderas de países, capitales reconocibles), iconos sistema para decoración (errores, header, modos abstractos, achievements).

**Acceptance:**
- Instalar `lucide-react` o `phosphor-react`.
- Reemplazar:
  - Modos: ⚡ → `Zap`, 🎯 → `Target`, ⚔️ → `Swords`, 🏁 → `Flag` (o `Trophy`), 🔥 → `Flame`.
  - Errors: 😢 → `CloudOff` (network) / `ServerCrash` (5xx) / `XCircle` (default).
  - Header: 🚪 (logout) → desaparece tras P1.4 / 🌍 (logo) → mantener emoji o reemplazar con SVG marca.
  - Achievements en Results: mantener emoji (es la celebración expresiva).
- Crear atom `<ModeIcon mode="flash" />` para encapsular.

---

### P2.3 — Errores deben unificar en `FullScreenError`
**Where:** `frontend/src/pages/RegisterPage.tsx` (banner inline rojo) — debe pasar a usar `Alert` atom para errores in-form, no inline div.

**Why:** Hoy Register pinta su propio banner rojo. Inconsistencia con el resto.

**Acceptance:**
- Crear `<FormError message />` que use el `Alert` atom.
- Aplicar en Register, Login (cuando falle).
- Test visual: errores en formulario se ven idénticos en Login y Register.

---

### P2.4 — `Sonidos (próximamente)` checkbox debe estar disabled
**Where:** `frontend/src/pages/ProfilePage.tsx`, sección Preferencias de juego.

**Why:** Hoy el checkbox aparece interactivo aunque diga "(próximamente)". Confusión.

**Acceptance:**
- Si la feature no está lista: `disabled` en el checkbox + opacity 0.5.
- O ocultar completamente la fila hasta que esté lista.
- Decision: pregúntar al implementador si quieren signaling de roadmap o esperar.

---

## P3 — Nice-to-have y exploraciones

### P3.1 — Reduced motion respect
**Why:** Animaciones (`active:scale-[0.99]`, accuracy bar `transition-all duration-500`, gradient fades) no respetan `prefers-reduced-motion`.

**Acceptance:**
- Añadir `motion-safe:` prefix a todas las animation classes O usar un hook `useReducedMotion`.

---

### P3.2 — Verificar contrast ratios
**Why:** `text-gray-400` y `text-gray-500` sobre `bg-gray-900` puede caer bajo 4.5:1.

**Acceptance:**
- Correr axe o Lighthouse a11y audit.
- Reemplazar grays bajos con tokens validados (ya existen `--color-text-muted` y `--color-text-secondary`).

---

### P3.3 — Revisar la tagline de Home
**Where:** `frontend/src/pages/HomePage.tsx`, prop `t('home.subtitle')`.

**Why:** "Pon a prueba tus conocimientos geográficos" es genérico. No diferencia ni vende. No comunica diversión ni mecánica.

**Acceptance:**
- Brainstormear 5-10 alternativas con copy especifico ("60 segundos. ¿Cuántas banderas reconoces?", "Compite en duelos relámpago contra otros jugadores", etc).
- A/B test si hay analytics.

---

### P3.4 — Daily challenge / preguntas curadas del día
**Why:** Retención. Junto con P1.3 (streak), ofrecer una "pregunta del día" da una razón concreta para abrir el app.

**Acceptance:**
- Backend: endpoint `/api/daily-challenge` que devuelve la pregunta del día (cacheable).
- Frontend: card en Menu con preview "🌍 Pregunta del día: ¿Capital de Mongolia?".
- Resolver streak diario.

---

### P3.5 — Empty state de Rankings
**Why:** Hoy si no hay rankings, "Sin conexión a internet" (mensaje falso). Cuando se arregle el copy del error: tener un EMPTY state distinto cuando la lista está vacía pero no falló.

**Acceptance:**
- Si `rankings.length === 0` y no hubo error: "Sé el primero en aparecer aquí. [Jugar ahora]".

---

### P3.6 — Results: tip educacional
**Why:** Results es transaccional (score → repetir). Oportunidad de aprender.

**Acceptance:**
- En Results, debajo del score, un block: "💡 Sabías que... [hecho relacionado a la pregunta que más fallaste]".
- Backend retorna un curated fact ligado a la categoría / país de la falla.

---

## Pasos siguientes recomendados

1. **Esta semana:** P0.1 → P0.4 (4 fixes UX críticos).
2. **Próximas 2 semanas:** P1.1 (onboarding) + P1.4 (logout) + P1.5 (overflow categorías) — los 3 fixes de mayor impacto/esfuerzo.
3. **Antes de cualquier feature nuevo:** P2.1 DESIGN.md vía `/design-consultation`.
4. **Después de DESIGN.md:** P2.2 emoji decision rollout.
5. **Cuando haya bandwidth:** P3.x en orden de impacto.

## Boomerang post-implementación

Tras shipear P0+P1, correr `/design-review` (audit visual de live site, no plan) para verificar que los fixes se ven bien y no introducen regresiones.
