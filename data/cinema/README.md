# Cine & Geografía — proceso de curado

Esta carpeta contiene el catálogo de preguntas de la categoría "Cine & Geografía" (enum `CINEMA_GEO`).

## Una sola mecánica

Toda pregunta CINEMA_GEO responde a la misma pregunta de fondo: **"¿Dónde se filmó esta escena?"**.

- La respuesta es siempre un lugar (país, ciudad o venue específico).
- El título de la película se muestra como contexto visual (movie card) — **no es la respuesta**, así que mostrarlo nunca spoilea.
- No hay fotos de escenas. Esto evita el problema clásico de imágenes rotas/atribución legal de Wikimedia.

## Schema (v2)

Cada entrada en [cinema-geo-questions.json](cinema-geo-questions.json) sigue este shape:

```json
{
  "id": "kebab-case-stable-id",
  "answerKind": "country" | "city" | "venue",
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "movie": {
    "title": "Mission: Impossible – Ghost Protocol",
    "year": 2011,
    "franchise": "Mission: Impossible"
  },
  "answer": {
    "value": "Dubai",
    "country": "United Arab Emirates",
    "city": "Dubai",
    "realLocation": "Burj Khalifa",
    "lat": 25.1972,
    "lng": 55.2744,
    "continent": "Asia"
  },
  "options": ["Dubai", "Doha", "Abu Dhabi", "Riyadh"],
  "prompt": {
    "es": "La icónica escena en que Ethan Hunt escala el Burj Khalifa fue filmada en qué ciudad?",
    "en": "The iconic scene where Ethan Hunt scales the Burj Khalifa was filmed in which city?"
  },
  "sources": [
    {
      "claim": "The Burj Khalifa climbing sequence is set in Dubai (2011, dir. Brad Bird).",
      "sourceUrl": "https://en.wikipedia.org/wiki/Mission:_Impossible_%E2%80%93_Ghost_Protocol"
    }
  ],
  "confidence": "high" | "medium" | "low",
  "reviewStatus": "approved" | "needs_sources" | "rejected"
}
```

## Reglas innegociables

1. **`answer.value` jamás puede ser igual a `movie.title`.** El validador falla con `SPOILER:` si lo detecta. Si la pregunta original era "¿qué película es?", reformulala para que pregunte por el lugar.
2. **`options` debe tener exactamente 4 elementos**, sin duplicados, e incluir `answer.value`.
3. **Aprobada (`reviewStatus: "approved"`) requiere al menos un `sourceUrl` real**. Wikipedia es la fuente por defecto; otras citas verificables (production notes, IMDb trivia con cita) también valen.
4. **`answer.country` debe coincidir con un país del catálogo** ([data/country-catalog.v1.json](../country-catalog.v1.json)) para que los filtros geográficos funcionen (continente, insular, sin salida al mar).
5. **Consistencia regional prompt ↔ distractores**: si el prompt promete una restricción ("qué ciudad surcoreana", "qué país norteafricano", "qué capital europea"), **todas las opciones deben respetar esa restricción**. Ejemplos de cosas que no van: prometer "ciudad surcoreana" y listar Tokyo como distractor; prometer "capital europea" y listar Munich (que no es capital nacional). Si vas a mezclar regiones en los distractores, deshacé la promesa en el prompt y dejalo abierto ("en qué ciudad").

## Flujo para agregar una pregunta nueva

1. Identificá una escena memorable con un lugar de filmación verificable.
2. Decidí qué pregunta hacer: país (más fácil), ciudad (medio), venue específico (más difícil).
3. Generá 3 distractores plausibles. Tip: mismo continente o región para no ser obvio.
4. Buscá la cita en Wikipedia (artículo de la película, sección "Production" o "Filming locations").
5. Pegá la entrada en `cinema-geo-questions.json` con `reviewStatus: "needs_sources"` mientras la pulís.
6. Cuando tengas la fuente verificada, cambiá a `"approved"`.
7. Validá:
   ```bash
   npm run validate:cinema-geo
   ```
8. Commit. El backend sembrará la pregunta nueva en el próximo deploy automáticamente (script idempotente, ver [ensureCinemaGeoQuestions.ts](../../backend/src/scripts/ensureCinemaGeoQuestions.ts)).

## Despublicar una pregunta

Cambiar `reviewStatus` de `approved` a `needs_sources` o `rejected`. El próximo arranque del backend elimina la fila de la DB automáticamente.

## Validación

- **`npm run validate:cinema-geo`** — chequea schema, spoilers, sources, options.
- **`npm test` (en `backend/`)** — corre el test suite del validador (17 casos en `validate-cinema-geo.test.ts`).

Ambos corren en pre-push (Husky) y en CI.

## Sembrado en producción

`ensureCinemaGeoQuestions()` corre en cada arranque del backend ([index.ts](../../backend/src/index.ts)):

- **Upsert** las preguntas approved (crea o actualiza el row).
- **Elimina** rows huérfanos (preguntas removidas, despublicadas o IDs renombrados).
- **Sembra `continent`/`isInsular`/`isLandlocked`/`subregion`** desde el país real, así los filtros geográficos del menú funcionan igual que las otras categorías.
