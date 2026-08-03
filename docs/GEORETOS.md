# GeoRetos

GeoRetos es una partida autenticada de cinco rondas, una por mecánica:

1. **Extremos:** identifica la capital más austral entre países que usan un idioma determinado.
2. **Mayor o menor:** compara población o superficie entre dos países del mismo continente.
3. **Vecino común:** encuentra el único país que comparte frontera terrestre con otros dos.
4. **El intruso:** tres países usan el idioma indicado y uno no.
5. **Norte a sur:** ordena cuatro países según la latitud de sus capitales.

Cada ronda dura 25 segundos y vale 100 puntos. El orden de la quinta respuesta es significativo. Antes de activar el reloj, la interfaz presenta la ruta y las cinco mecánicas; después de la partida ofrece un pasaporte de cobertura y un repaso de explicaciones.

El backend genera la partida y conserva sus soluciones en un token AES-256-GCM cifrado, autenticado, ligado al usuario y válido por una hora; las soluciones no forman parte del payload público inicial ni pueden leerse decodificando el token.

## Distribución geográfica

- Cada partida cubre exactamente una vez África, Américas, Asia, Europa y Oceanía.
- Las dos mecánicas que necesitan una red terrestre o un grupo lingüístico con intruso se asignan solo a regiones con candidatos válidos; las demás completan la ruta global.
- Un país no se repite dentro de una partida, ni como opción ni como parte visible de una pregunta relacional.
- “Extremos” compara una muestra regional de cuatro países, por lo que la respuesta no queda fijada para siempre al mismo extremo mundial de cada idioma.
- “Vecino común” sortea primero el país correcto y luego una relación válida. Así, los países con muchas combinaciones fronterizas no reciben una probabilidad artificialmente mayor.
- La dificultad se calcula usando cercanía entre valores o capitales cuando corresponde y se expone como contexto, sin cambiar el puntaje de la ronda.

## Duelo

GeoRetos también puede jugarse en tiempo real desde el menú o desde el briefing individual. Reutiliza el matchmaking, la reconexión, el historial y el ranking de duelos, pero mantiene una cola separada de las categorías clásicas.

- Son exactamente 10 preguntas de 25 segundos.
- Cada una de las cinco mecánicas aparece dos veces.
- Cada macroregión aparece dos veces.
- No se repiten países dentro del duelo.
- Ambos jugadores reciben las mismas rondas y el orden de Norte a sur se valida de forma exacta.
- Cada acierto suma 100 puntos base más el bonus de velocidad del duelo.

## Datos y criterios

- El universo se limita a los 197 países soportados por `data/country-catalog.v1.json`.
- Población, superficie, idiomas, fronteras y coordenadas de capital proceden del dataset REST Countries v3.1 (MPL-2.0).
- “Usa un idioma” refleja la lista de idiomas del dataset fuente; no afirma exclusividad ni predominio.
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

El resultado individual se valida en el servidor, pero no se mezcla con estadísticas ni rankings clásicos. Los GeoRetos jugados como duelo sí se registran como duelos para conservar el historial, victorias, derrotas y rankings existentes, sin requerir un contrato o esquema de base de datos nuevo.
