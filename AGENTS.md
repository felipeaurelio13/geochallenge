# AGENTS.md — GeoChallenge

Estas reglas aplican a todo el repositorio y buscan evitar regresiones de UX/UI como elementos cortados, mala jerarquía visual o inconsistencias entre modos.

## Principios de producto y UX

- Diseñar e implementar siempre con enfoque **mobile-first**.
- Priorizar una estética **minimalista profesional**, con jerarquías visuales claras (qué mirar primero, segundo y tercero).
- Mantener tono y decisiones **empáticas con el usuario**, favoreciendo claridad, feedback inmediato y reducción de errores.
- Nunca usar **mock data** en funcionalidades reales.

## Reglas obligatorias de layout visual

- Ningún elemento crítico puede quedar cortado o a medias (tarjetas, botones, mensajes de estado, badges).
- En pantallas de juego, evitar cualquier solución que introduzca scroll vertical.
- Toda pantalla de juego debe ocupar exactamente el viewport disponible y resolver su contenido sin desbordes.
- Validar siempre safe areas en mobile (`env(safe-area-inset-*)`) para CTAs sticky o barras fijas.
- Revisar que no exista overflow horizontal accidental en pantallas pequeñas.

## Dark mode y consistencia visual

- Cada cambio visual debe validarse también en **tema oscuro**.
- En dark mode cuidar especialmente:
  - contraste texto/fondo,
  - prioridad visual de CTA principal,
  - legibilidad de estados (éxito, error, pendiente, deshabilitado),
  - consistencia de bordes/sombras para separar planos.

## Calidad y pruebas

- Toda nueva funcionalidad debe incluir test automatizado.
- Si se modifica una funcionalidad existente, actualizar sus tests.
- Incluir validaciones de layout/estados cuando el cambio sea visual o de interacción.

## Versionado, documentación y despliegue

- En cada cambio de producto/frontend:
  - actualizar versión visible en footer,
  - actualizar `README.md` con novedades.
- El despliegue se realiza en **GitHub Pages**.
- Las secret keys se gestionan en GitHub (no hardcodear secretos).

## Leyes del sistema (layout de juego)

- **Viewport Unit Standard:** prohibido usar `vh`; usar exclusivamente `dvh` para evitar saltos al aparecer/desaparecer barras del navegador móvil.
- **Zero-Scroll Policy:** el contenedor raíz de juego debe usar `height: 100dvh` y `overflow: hidden`; ninguna pantalla de juego puede permitir scroll.
- **Universal Game Wrapper:** todos los modos de juego (Banderas, Capitales, Mapas) deben usar el mismo layout base reutilizable.
- **Question Composition Rules:**
  - Si no hay imagen (modo Capitales), centrar verticalmente el texto de la pregunta con el espacio sobrante.
  - Si hay imagen (Banderas/Mapas), usar `max-height: 30%` y `object-fit: contain`.
- **Safe Area Isolation:** elementos fijos en extremos (header y footer/CTA confirmar) deben respetar `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)`.
- **Mobile Interaction Guardrails:** desactivar `pull-to-refresh` y el efecto bounce en iOS mediante `overscroll-behavior: none`.
- **State Integrity:** botones de opción no deben cambiar su `opacity` ni usar `background-color: transparent` en estados seleccionados/inactivos; el fondo debe mantenerse sólido para evitar superposición visual.

## Design tokens y UI

- **Colores globales:** prohibido usar colores hexadecimales directos en componentes; utilizar siempre variables del tema (por ejemplo `--primary-bg`, `--correct-green`, `--error-red`).
- **Estado de botones:** al seleccionar una respuesta, los botones hermanos deben mantener fondo sólido; no usar transparencias ni opacidades que revelen capas traseras.
- **Opciones de respuesta:** respetar `padding` vertical máximo de `12px` para optimizar el espacio en pantallas pequeñas.
- **Minimalismo:** eliminar etiquetas redundantes (por ejemplo “Categoría activa: X”) cuando el selector visual ya comunica ese estado.

## Lógica de desarrollo

- **Cero mock data:** no usar datos estáticos para simular respuestas; implementar siempre la lógica real del estado de juego.
- **DRY obligatorio:** si la validación de respuestas es equivalente entre Banderas y Capitales, centralizarla en un hook o utilidad compartida.

## Cobertura de pruebas por modo de juego

- Cada modo de juego debe contar con su archivo `.test.js` que valide como mínimo:
  1. Renderizado correcto sin desbordamiento.
  2. Cambio de estado visual (colores) tras selección.
  3. Flujo al finalizar las 10 preguntas.

## Infraestructura y despliegue

- **GitHub Pages routing:** asegurar compatibilidad con la ruta base del repositorio (usar `HashRouter` si es necesario).
- **Versionado visible:** actualizar la versión del footer en cada commit con mejora de UI o funcionalidad.
