# GeoChallenge 2: auditoría visual

Fecha: 2026-08-30

> **Estado (2026-09-02):** segunda pasada completada. Las pantallas de meta game usan las primitives centrales y los colores hardcodeados del palette Tailwind fueron migrados a tokens (`success`/`error`/`warning`/`primary`/`app-*`), con overrides de dark mode para los tokens de estado. El favicon usa la marca propia (`geochallenge-mark.svg`). Pendiente de verificación visual en producción.

## Base revisada

Se revisaron las rutas de `App.tsx`, las páginas de `frontend/src/pages`, los primitives y layouts de `frontend/src/components`, `index.css`, Tailwind, PWA y las suites Vitest/Playwright.

La estructura de juego ya resuelve problemas importantes y se conserva: `AppRoot` aplica safe areas; `UniversalGameLayout` usa tres filas con `100dvh`; `GameRoundScaffold` mantiene las cuatro alternativas; `RoundActionTray` reserva espacio para la acción y `MapInteractive` tiene soporte táctil y de teclado. La migración visual no cambia rutas, contratos HTTP ni Socket.IO.

## Inventario y decisión

| Área | Estado | Decisión |
| --- | --- | --- |
| Shell, safe areas y layouts de juego | Estables y cubiertos por tests | Mantener |
| Tokens, Tailwind y CSS global | Paleta azul genérica, seis radios, elevaciones y aliases visuales redundantes | Reconstruir |
| Header, home y auth | El globo emoji, blur y cards pesan más que el contenido | Simplificar y reconstruir con marca SVG |
| Lobby | Expone muchos modos, categorías y colores a la vez; compite con la acción principal | Fusionar en «Continuar», «Hoy», «Jugar» y navegación secundaria |
| Preguntas de media | El contenido geográfico comparte protagonismo con contenedores y badges | Simplificar; la bandera, silueta o monumento queda sobre superficie neutra |
| Pregunta de mapa | Base funcional buena, pero el marco se siente como un widget separado | Mantener interacción y reducir el tratamiento de contenedor |
| Respuestas y feedback | Estados completos, pero con radio/elevación/colores heredados | Reconstruir la misma API visual con señal textual y de forma |
| Resultados | Demasiados paneles, gradientes, emojis y sombra | Fusionar en resumen, métricas y acciones |
| Meta game, ranking, perfil y retos | Hay estilos de campañas y categorías que no comparten lenguaje | Migrar progresivamente a las primitives centrales |
| Auth, carga, vacío y error | Estructura reutilizable presente; personalidad inconsistente | Mantener contratos y sustituir superficies/iconos |
| PWA y favicon | Fuente `globe.svg` genérica; PNG derivados existentes | Reemplazar la fuente por una marca SVG propia y alinear metadatos |

## Problemas detectados

- El mismo concepto aparece como card, panel, modal o bloque con una combinación distinta de radio, borde y sombra.
- La identidad de los modos se apoya en emojis y colores de categoría, en vez de geografía, progreso y acción.
- Hay gradientes, blur y sombras grandes en pantallas de alta concentración, especialmente home, resultados y bandejas.
- El lobby muestra opciones secundarias antes de que el jugador haya elegido una intención.
- Los tests ya protegen layout, safe areas y respuesta; faltaba una matriz de capturas para estados North Star y viewports.

## Norte de producto

La interfaz deja el fondo y las superficies en segundo plano. La geografía ocupa el área principal; el progreso queda arriba, las respuestas abajo y una única acción domina cada estado. El lobby muestra continuar, el desafío diario y dos puertas de entrada. Los demás modos siguen disponibles, pero aparecen dentro de su contexto.

## Alcance de esta migración

La primera entrega establece el sistema y migra las cuatro experiencias North Star: lobby, pregunta visual con bandera, pregunta de mapa y resultados. Sus primitives se aplican a shell, home, auth, feedback y navegación compartida. Las pantallas específicas de meta game conservan su lógica y quedan previstas para la segunda pasada de migración, sin duplicar el sistema anterior.

## Riesgos verificados

- Los cambios de color deben revisar banderas y tiles de mapa en ambos temas.
- No se debe cambiar la altura contractual de la grilla de juego ni convertir el tray en overlay.
- La eliminación de emojis se limita a iconografía de interfaz. Los logros y el contenido histórico pueden seguir usando su símbolo como dato hasta que tengan una migración de datos separada.
