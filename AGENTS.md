# AGENTS.md — GeoChallenge

Estas reglas aplican a todo el repositorio.

Objetivo: hacer cambios pequeños, correctos, reversibles y fáciles de integrar, respetando el comportamiento actual del producto y minimizando riesgo técnico y de merge.

## Contexto del repo

- Monorepo con:
  - `frontend/`: React + Vite + TypeScript + Tailwind + i18n + Vitest + Playwright
  - `backend/`: Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis + Socket.IO + Vitest
- El frontend se despliega en GitHub Pages.
- El backend se despliega por separado y usa variables de entorno.
- Existe `CLAUDE.md` para skill routing. No modificar su semántica ni su propósito salvo instrucción explícita.

## Principios no negociables

- No hagas un big-bang refactor.
- Prefiere siempre el cambio mínimo viable que resuelva bien el problema.
- Mantén compatibilidad con el comportamiento actual salvo que la tarea pida cambiarlo explícitamente.
- Antes de implementar algo no trivial, inspecciona primero el código existente.
- Reutiliza patrones, componentes, hooks, utilidades y contratos ya presentes en el repo.
- No dupliques lógica si ya existe una ruta clara para resolver el problema.
- No hagas limpiezas amplias, reformateos masivos ni refactors oportunistas fuera del alcance.
- Si detectas mejoras valiosas fuera de scope, repórtalas en `Riesgos / Follow-ups`, pero no las implementes por defecto.
- Prioriza confiabilidad, claridad, depurabilidad, observabilidad y rollback fácil por sobre sofisticación.

## Disciplina de alcance y trabajo en paralelo

Asume siempre que puede haber varios issues y PRs trabajando en paralelo.

Por lo tanto:

- Mantén el diff lo más pequeño posible.
- Toca solo los archivos estrictamente necesarios.
- Evita archivos compartidos y propensos a conflicto si no son indispensables.

### No tocar salvo instrucción explícita

- `frontend/package.json` en su campo `version`
- footer/versionado visible de la app
- `README.md` como historial de release
- changelogs o notas de versión
- metadata/manifests de release
- lockfiles (`package-lock.json`) salvo que el cambio realmente requiera una dependencia nueva o actualizada
- archivos de despliegue o infraestructura (`render.yaml`, workflows, Pages config) salvo que la tarea sea de deploy/CI/CD/configuración

### Si necesitas tocar dependencias o lockfiles

- hazlo solo si es estrictamente necesario;
- minimiza el delta;
- explica por qué fue necesario;
- evita upgrades no relacionados.

## Estrategia de cambio

- Prefiere cambios aditivos cuando sea posible.
- Usa feature flags, config gates o fallbacks seguros cuando el cambio tenga riesgo real.
- Si no corresponde usar flag/fallback, explica por qué.
- Mantén los cambios fáciles de revisar y fáciles de revertir.
- Sigue naming, arquitectura y estilo ya presentes en el repo, salvo razón fuerte en contra.
- No inventes capas nuevas si el repo ya tiene una forma razonable de resolverlo.

## Reglas específicas de frontend

Aplican cuando la tarea toca `frontend/`.

- Diseñar e implementar con enfoque mobile-first.
- No introducir overflow horizontal accidental.
- En pantallas de juego, proteger la integridad del viewport y no romper la experiencia mobile existente.
- Preservar safe areas (`env(safe-area-inset-*)`) cuando la UI use headers, footers o CTAs fijos.
- Evitar regresiones donde botones, tarjetas, indicadores o mensajes queden cortados.
- Validar también dark mode cuando el cambio sea visual.
- Reutilizar layout/components existentes antes de crear variantes paralelas.
- Mantener consistencia con i18n: si cambias texto visible al usuario, actualizar ES/EN cuando corresponda.
- No hardcodear rutas que rompan GitHub Pages o el base path actual del frontend.
- No reintroducir footer global o shell global en rutas de juego si la arquitectura actual los excluye intencionalmente para proteger altura útil.
- No usar mock data en funcionalidad real. En tests sí se pueden usar fixtures, stubs o mocks controlados.

### Guardrails fuertes para UI de juego

Si el cambio toca modos de juego (`single`, `duel`, `challenge`, `streak` o rutas equivalentes), además:

- no romper visibilidad de CTA principal;
- no romper visibilidad/alcance de las 4 alternativas;
- no introducir clipping visual;
- no degradar contraste de estados (correcto, incorrecto, seleccionado, deshabilitado);
- no reemplazar una estructura reutilizable existente por duplicación ad hoc.

## Reglas específicas de backend

Aplican cuando la tarea toca `backend/`.

- Mantener compatibilidad hacia atrás en contratos HTTP y Socket.IO salvo instrucción explícita.
- Preferir extensiones aditivas: nuevos campos opcionales, nuevos params opcionales, fallbacks seguros.
- No cambiar nombres de eventos/socket contracts sin necesidad explícita.
- No romper parseo tolerante o compatibilidad de payloads si el frontend actual depende de ello.
- No hardcodear secretos, tokens ni credenciales.
- Usar variables de entorno y patrones de configuración ya existentes.
- Evitar cambios destructivos en Prisma/schema/migraciones salvo que la tarea lo requiera de forma explícita.

## Método de trabajo

Antes de codificar:

1. inspecciona el código relevante;
2. identifica el patrón existente;
3. define el cambio mínimo seguro;
4. evalúa compatibilidad, impacto lateral y rollback.

Si la tarea es compleja, ambigua o arquitectónica, entrega primero un plan breve antes de implementar.

## Verificación

Antes de terminar:

- ejecuta checks proporcionales al cambio;
- agrega o ajusta tests según el riesgo;
- deja explícito qué sí validaste y qué no pudiste validar.

### Calidad esperada por tipo de cambio

#### Si cambias frontend

Prioriza, según corresponda:

- `npm --prefix frontend run test`
- `npm --prefix frontend run build`
- `npm --prefix frontend run ci:quality`

Usa E2E cuando el cambio afecte flujo real, routing, autenticación, juego o regresiones visuales/UX críticas.

#### Si cambias backend

Prioriza, según corresponda:

- `npm --prefix backend run lint`
- `npm --prefix backend run test`
- `npm --prefix backend run build`

#### Si cambias ambos

Valida ambos lados y explicita dependencias cruzadas de contrato.

## Qué debe entregar siempre la respuesta final

1. Diagnóstico
2. Plan
3. Implementación
4. Tests
5. Documentación breve
6. Riesgos / Follow-ups
7. Rollback
8. Lista exacta de archivos tocados

## Formato esperado

### Diagnóstico

- Qué existe hoy
- Qué patrón reutilizarás
- Qué restricciones detectaste

### Plan

- Pasos concretos
- Decisiones de diseño
- Qué no vas a tocar

### Implementación

- Cambios realizados por archivo
- Explicación breve de cada cambio relevante

### Tests

- Tests agregados o ajustados
- Qué cubren
- Qué no quedó cubierto

### Documentación

- Notas mínimas operativas o de mantenimiento

### Riesgos / Follow-ups

- Riesgos reales
- Casos borde
- Mejoras futuras fuera de scope

### Rollback

- Cómo revertir
- Qué comportamiento previo se recupera

### Archivos tocados

- Lista exacta de archivos modificados
- Lista exacta de archivos nuevos, si aplica

## Regla de decisión

Si encuentras una mejor forma de implementar algo:

- proponla;
- explica por qué es mejor;
- ejecútala solo si sigue siendo incremental, reversible, compatible y de bajo riesgo.

En conflicto entre elegancia y seguridad, gana seguridad.
En conflicto entre velocidad y claridad, gana claridad.
En conflicto entre novedad y compatibilidad, gana compatibilidad.
