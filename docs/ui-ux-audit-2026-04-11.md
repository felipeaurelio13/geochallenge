# Auditoría experta UI/UX + visual + despliegue

Fecha: 2026-04-11

## Alcance

- Frontend layout mobile-first (shell, juego, CTA, safe areas, dark mode).
- Coherencia visual de estados (opciones, feedback y jerarquía).
- Compatibilidad de despliegue en GitHub Pages.
- Cobertura de tests orientada a regresiones visuales y de interacción.

## Hallazgos (estado actual)

1. **Layout universal de juego sólido**
   - `UniversalGameLayout` usa estructura fija de 3 filas (`header/main/footer`) y `100dvh`, evitando overlays del action tray.
2. **Safe areas aplicadas correctamente**
   - Se observa uso de `env(safe-area-inset-top|bottom|left|right)` en shell y zonas críticas.
3. **Control de scroll y bounce mobile**
   - El root desactiva overscroll global; gameplay usa scroll interno contenido donde corresponde.
4. **Centrado por tipo de pregunta**
   - Capitales se centran verticalmente y preguntas con media usan modo contenido para preservar 4 opciones visibles.
5. **Despliegue robusto en Pages**
   - Pipeline con quality gate (`lint + test + build`) antes de publicar artefacto.

## Riesgos detectados

1. **Riesgo de regresión por unidad `vh`**
   - Si reaparece `vh` en estilos de juego, puede romperse la estabilidad en iOS/Android con barras dinámicas.
2. **Riesgo de drift visual por cambios rápidos**
   - Sin guardrails automatizados, pequeños cambios pueden romper 4 opciones visibles o safe area del CTA.

## Acción implementada (aditiva, reversible)

Se agregó una suite de guardrails automatizada para blindar:

- `100dvh` y grid de 3 filas en layout universal.
- Safe areas y overscroll behavior.
- Prohibición de `vh` en stylesheet base.
- Reglas de composición de pregunta (capital centrada / media en contenido).
- Reglas de 4 filas de opciones y padding vertical de opción.

## Follow-ups recomendados

1. Incorporar snapshot visual e2e en dark mode por viewport (iPhone SE, iPhone 15 Pro, Android medium).
2. Añadir test e2e explícito de alineación horizontal (sin overflow accidental).
3. Consolidar checklist de release visual en PR template.

## Rollback

Para revertir este cambio de auditoría, eliminar:

- `frontend/src/__tests__/ui-ux-audit-guardrails.test.ts`
- `docs/ui-ux-audit-2026-04-11.md`

Y deshacer cambios de versionado/documentación asociados.
