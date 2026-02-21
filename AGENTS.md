# AGENTS.md — GeoChallenge

Estas reglas aplican a todo el repositorio y buscan evitar regresiones de UX/UI como elementos cortados, mala jerarquía visual o inconsistencias entre modos.

## Principios de producto y UX
- Diseñar e implementar siempre con enfoque **mobile-first**.
- Priorizar una estética **minimalista profesional**, con jerarquías visuales claras (qué mirar primero, segundo y tercero).
- Mantener tono y decisiones **empáticas con el usuario**, favoreciendo claridad, feedback inmediato y reducción de errores.
- Nunca usar **mock data** en funcionalidades reales.

## Reglas obligatorias de layout visual
- Ningún elemento crítico puede quedar cortado o a medias (tarjetas, botones, mensajes de estado, badges).
- Evitar soluciones de “no scroll” que sacrifiquen legibilidad o corten contenido.
- Preferir contenedores que permitan crecimiento vertical del contenido cuando sea necesario.
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
- **Viewport Unit Standard:** prohibido usar `vh`; usar exclusivamente `svh` o `dvh` para evitar saltos al aparecer/desaparecer barras del navegador móvil.
- **Zero-Scroll Policy:** el contenedor raíz de juego debe usar `height: 100dvh` y `overflow: hidden`; ninguna pantalla de juego puede permitir scroll.
- **Safe Area Isolation:** elementos fijos en extremos (header y footer/CTA confirmar) deben respetar `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)`.
- **State Integrity:** botones de opción no deben cambiar su `opacity` ni usar `background-color: transparent` en estados seleccionados/inactivos; el fondo debe mantenerse sólido para evitar superposición visual.
