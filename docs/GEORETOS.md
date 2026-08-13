# GeoRetos

GeoRetos es una partida autenticada generada dinámicamente con **Engine V2**. Cada partida es una expedición geográfica corta y diferente.

## Engine V2

- **9 mecánicas disponibles:** Extremos, Mayor o menor, Vecino común, El intruso, Norte a sur, Proximidad de capitales, Ordenar por métrica, Conteo de fronteras, Cadena de fronteras.
- **Single:** 7 rondas seleccionadas dinámicamente (7 tipos distintos, 5 regiones cubiertas, 0 países repetidos, 25 segundos por reto).
- **Duel:** 10 rondas (las 9 mecánicas aparecen al menos una vez, cada región aparece 2 veces, 0 países repetidos).
- **Dificultad real:** EASY (100 pts), MEDIUM (125 pts), HARD (150 pts). La dificultad se calcula según la cercanía entre valores o la plausibilidad de distractores.
- **Progresión:** las rondas se ordenan EASY → MEDIUM → HARD para crear una curva natural.
- **Puntaje por dificultad:** el puntaje base depende de la dificultad de cada ronda. En single no hay bonus de velocidad; en duel se mantiene el bonus de tiempo sobre la base de dificultad.
- **Server-authoritative:** las respuestas se almacenan en Redis al momento de responder. El finish consolida desde Redis, no confía en el payload del cliente.
- **Sin países repetidos:** ningún país aparece más de una vez dentro de una partida, ni como opción ni como parte de una pregunta relacional.

## Mecánicas

1. **Extremos:** identifica la capital más al norte o más al sur entre países que usan un idioma determinado.
2. **Mayor o menor:** compara población o superficie entre dos países del mismo continente.
3. **Vecino común:** encuentra el único país que comparte frontera terrestre con otros dos. Los distractores prefieren ser vecinos parciales (vecino de A pero no de B, o viceversa).
4. **El intruso:** tres países usan el idioma indicado y uno no. La dificultad depende de cuán común es ese idioma en la región.
5. **Norte a sur:** ordena cuatro países según la latitud de sus capitales.
6. **Proximidad de capitales:** ¿qué capital está más cerca de la ciudad mencionada? Usa distancia haversine.
7. **Ordenar por métrica:** ordena cuatro países de mayor a menor por población o superficie.
8. **Conteo de fronteras:** ¿cuál tiene más (o menos) fronteras terrestres?
9. **Cadena de fronteras:** construye una ruta terrestre A → B → C → D donde cada país limita con el siguiente.

## Distribución geográfica

- Cada partida single cubre las 5 macroregiones: África, Américas, Asia, Europa y Oceanía.
- Oceanía aparece exactamente una vez en single; dos regiones aparecen dos veces.
- Las mecánicas relacionales (Vecino común, El intruso, Conteo de fronteras, Cadena de fronteras) no se usan en Oceanía.
- Un país no se repite dentro de una partida, ni como opción ni como parte visible de una pregunta relacional.
- La dificultad se calcula usando cercanía entre valores, capitales o plausibilidad de distractores cuando corresponde.

## Duelo

GeoRetos también puede jugarse en tiempo real desde el menú o desde el briefing individual. Reutiliza el matchmaking, la reconexión, el historial y el ranking de duelos, pero mantiene una cola separada de las categorías clásicas.

- Son exactamente 10 preguntas de 25 segundos.
- Las 9 mecánicas aparecen al menos una vez; una se repite.
- Cada macroregión aparece exactamente 2 veces.
- No se repiten países dentro del duelo.
- No hay dos rondas consecutivas del mismo tipo.
- Ambos jugadores reciben las mismas rondas.
- Cada acierto suma puntos base según dificultad (EASY=100, MEDIUM=125, HARD=150) más el bonus de velocidad del duelo.

## Datos y criterios

- El universo se limita a los 197 países soportados por `data/country-catalog.v1.json`.
- Población, superficie, idiomas, fronteras y coordenadas de capital proceden del dataset REST Countries v3.1 (MPL-2.0).
- "Usa un idioma" refleja la lista de idiomas del dataset fuente; no afirma exclusividad ni predominio.
- Las fronteras son terrestres. Los territorios no incluidos en el catálogo base se eliminan de las relaciones.
- La ubicación norte/sur y los extremos se calculan usando la latitud de la capital, no el territorio completo.
- La suite de distribución verifica que los 197 países puedan aparecer como respuesta correcta en una muestra determinista de partidas.

## Actualizar el catálogo

Descarga un snapshot de REST Countries v3.1 y ejecuta:

```bash
node scripts/build-geo-challenge-catalog.mjs /ruta/al/snapshot.json
```

El script valida cobertura, coordenadas, población y superficie antes de reemplazar `data/geo-challenge-catalog.v1.json`. Luego deben ejecutarse los tests del backend y `npm run predeploy`.

## Alcance

El resultado individual se valida en el servidor, pero no se mezcla con estadísticas ni rankings clásicos. Los GeoRetos jugados como duelo sí se registran como duelos para conservar el historial, victorias, derrotas y rankings existentes, sin requerir un esquema de base de datos nuevo. GeoRetos V2 no escribe `MasteryAttempt`.
