# GeoRetos

GeoRetos es una partida autenticada de cinco rondas, una por mecánica:

1. **Extremos:** identifica la capital más austral entre países que usan un idioma determinado.
2. **Mayor o menor:** compara población o superficie entre dos países del mismo continente.
3. **Vecino común:** encuentra el único país que comparte frontera terrestre con otros dos.
4. **El intruso:** tres países usan el idioma indicado y uno no.
5. **Norte a sur:** ordena cuatro países según la latitud de sus capitales.

Cada ronda dura 25 segundos y vale 100 puntos. El orden de la quinta respuesta es significativo. El backend genera la partida y conserva sus soluciones en un token AES-256-GCM cifrado, autenticado, ligado al usuario y válido por una hora; las soluciones no forman parte del payload público inicial ni pueden leerse decodificando el token.

## Datos y criterios

- El universo se limita a los 197 países soportados por `data/country-catalog.v1.json`.
- Población, superficie, idiomas, fronteras y coordenadas de capital proceden del dataset REST Countries v3.1 (MPL-2.0).
- “Usa un idioma” refleja la lista de idiomas del dataset fuente; no afirma exclusividad ni predominio.
- Las fronteras son terrestres. Los territorios no incluidos en el catálogo base se eliminan de las relaciones.
- La ubicación norte/sur y los extremos se calculan usando la latitud de la capital, no el territorio completo.

## Actualizar el catálogo

Descarga un snapshot de REST Countries v3.1 y ejecuta:

```bash
node scripts/build-geo-challenge-catalog.mjs /ruta/al/snapshot.json
```

El script valida cobertura, coordenadas, población y superficie antes de reemplazar `data/geo-challenge-catalog.v1.json`. Luego deben ejecutarse los tests del backend y `npm run predeploy`.

## Alcance de la primera versión

El resultado se valida en el servidor, pero no se mezcla con las estadísticas ni los rankings de los modos clásicos. Esto evita alterar sus contratos y sistemas de puntuación hasta definir una tabla o clasificación específica para GeoRetos.
