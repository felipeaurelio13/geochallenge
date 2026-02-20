# GeoChallenge

Juego de trivia geográfica con modos individual, duelos en tiempo real y desafíos entre amigos.


## Versión actual

- Frontend: **v1.2.52**

### Mantener backend activo en producción
Configura el secret **`BACKEND_HEALTHCHECK_URL`** en GitHub (Settings → Secrets and variables → Actions) con la URL pública de salud de tu API, por ejemplo:

`https://tu-backend.onrender.com/health`

Con ese secret configurado, el workflow **Keep backend awake** hará ping automático cada 10 minutos para minimizar el estado dormido del servicio free.

### Flujo interno recomendado para evitar fallas de deploy
1. Trabajar siempre en branch de feature y abrir PR a `main`.
2. Verificar localmente en frontend con un solo comando: `npm run ci:quality` (equivale a lint + tests + build).
3. Hacer merge sólo cuando estén en verde los workflows `Frontend Quality` y `Backend Quality`.
4. El deploy a GitHub Pages se ejecuta automáticamente en push a `main` con quality gate previo (`lint + tests + build`).
5. Si falla deploy, revisar primero el job `Frontend quality gate`: ese job corta el release antes de publicar para evitar romper producción.
6. El workflow de deploy se dispara solo con cambios de frontend o del propio pipeline, reduciendo ruido por cambios ajenos al cliente web.
7. Si el deploy falla, usar este protocolo interno: (a) `npm run ci:quality` local, (b) revisar secretos/configuración de Pages, (c) relanzar workflow solo tras corregir la causa raíz.





















## Novedades de la versión 1.2.52
- Se amplió el área visual de preguntas de silueta en `QuestionCard`, aumentando altura mínima del contenedor e imagen para que la forma del país se perciba completa y con mejor legibilidad en mobile.
- Se optimizó el enunciado de preguntas de mapa en layout compacto con tipografía y `line-height` más contenidos, evitando que el texto compita con el mapa y mejorando la jerarquía visual.
- Se añadieron pruebas automatizadas de `QuestionCard` para validar el nuevo espacio de silueta y el ajuste tipográfico del enunciado de mapa, reduciendo riesgo de regresión visual.
- Footer/versionado actualizado a **v1.2.52** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.51
- Se compactó la pantalla de ronda en modo individual para aprovechar mejor el alto en mobile: se eliminó la barra textual `Pregunta X de Y`, se redujo el margen superior del header y se quitaron mensajes contextuales redundantes en el cuerpo/resultado.
- En preguntas de capitales se retiró el icono superior para evitar ocupar una línea completa y mejorar la jerarquía visual del enunciado.
- Las alternativas ahora reemplazan la letra por ✓/✕ de color al mostrar resultado, eliminando badges de texto para reducir ruido visual y ganar espacio útil.
- Se reforzó la renderización de imágenes en `QuestionCard`: normalización de URL de bandera (código ISO en minúsculas para `flagcdn`) y contenedores con alturas mínimas para que banderas/siluetas se vean completas con `object-contain`.
- Se actualizaron pruebas automatizadas de `GamePage`, `DuelPage` y `OptionButton` para reflejar el nuevo layout y prevenir regresiones.
- Footer/versionado actualizado a **v1.2.51** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.50
- Se centralizó el footer global en el layout `Screen` para que la versión de la app aparezca de forma consistente en **todas las vistas** del frontend, incluyendo rutas protegidas y públicas.
- Se retiraron footers duplicados en páginas que ya estaban renderizando versión manualmente para evitar inconsistencias y mantener jerarquía visual limpia en mobile-first.
- Se actualizaron pruebas de vistas y layout para validar que el footer/versionado siga visible tras el cambio arquitectónico.
- Footer/versionado actualizado a **v1.2.50** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.49
- Se auditó y reforzó el flujo completo de autenticación para evitar fallas silenciosas en login/registro causadas por emails con espacios o mayúsculas.
- Backend: el email ahora se normaliza (`trim + lowercase`) en login y registro, y la búsqueda de usuario en login se realiza en modo case-insensitive para mejorar robustez.
- Frontend: `AuthContext` normaliza email y username antes de invocar la API, reduciendo errores de ingreso desde mobile/autocompletado.
- Se añadieron pruebas automatizadas nuevas en frontend y backend para cubrir la normalización de credenciales y prevenir regresiones.
- Footer/versionado actualizado a **v1.2.49** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.48
- Se recuperó la visualización del enunciado en preguntas cuando `questionData` llega serializado como JSON string, parseándolo de forma segura para extraer `country/capital` y mantener la experiencia consistente.
- Se añadió fallback para casos legacy sin `questionText`, priorizando contexto útil del usuario antes de dejar el enunciado vacío.
- Se agregó prueba automatizada de `QuestionCard` para asegurar que el enunciado de capital se renderice correctamente con `questionData` serializado.
- Footer/versionado actualizado a **v1.2.48** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.47
- Se eliminó código muerto del frontend: se retiraron `OverlayModal` y `useLockBodyScroll`, que no estaban referenciados en rutas ni componentes activos.
- Se limpió duplicación de lógica en rutas de autenticación extrayendo el estado de carga compartido a `AuthRouteLoading`.
- Se actualizaron exports del barrel de componentes y pruebas de layout para reflejar la limpieza sin afectar UX mobile-first.
- Footer/versionado actualizado a **v1.2.47** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.46
- Se refactorizó el sistema visual del frontend hacia **CSS Custom Properties globales** en `:root`, documentando tokens de color, spacing, radios, sombras y breakpoints para mantener consistencia mobile-first y facilitar evolución de UI.
- Se habilitó **dark mode automático** mediante `prefers-color-scheme`, manteniendo contraste y jerarquía visual en componentes compartidos.
- Se sincronizó `tailwind.config.js` con `theme.extend` basado en variables CSS para usar los mismos tokens de diseño desde utilidades Tailwind.
- Se actualizaron componentes principales (`Timer`, `MapInteractive`, `OptionButton`, `ScoreDisplay`) para consumir tokens globales en lugar de valores hardcodeados.
- Se agregó cobertura automatizada para validar la existencia y mapeo del token system (`design-tokens.test.js`) y se actualizaron tests afectados por el refactor de estilos.
- Footer/versionado actualizado a **v1.2.46** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.45
- Se optimizó el layout de rondas (individual, duelo y desafío) para que el área central use mejor el alto disponible: header/progreso compactados, contenido principal con `flex-1` + `min-h-0` y scroll interno sólo en el bloque que realmente lo necesita.
- Se eliminó espacio vertical desperdiciado sobre el core de juego reduciendo paddings superiores y gaps, con una jerarquía visual más cercana al header sin perder legibilidad en dark mode.
- Se consolidó el patrón de viewport mobile con `height: 100%` + `min-height` (`100svh`/`100dvh`) en el contenedor raíz, manteniendo `html/body` sin scroll global y evitando regresiones de `100vh` en iOS/Android.
- Se ajustó el mapa interactivo para usar una altura más equilibrada en mobile y disminuir scroll innecesario en preguntas de mapa.
- Se actualizaron tests automatizados de layout en páginas de juego para cubrir las nuevas clases de contenedor y safe area.
- Footer/versionado actualizado a **v1.2.45** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.44
- Se implementó un contenedor raíz `app-root` full-screen con `100svh` (fallback `100vh`), safe areas y bloqueo de overflow global para estabilizar altura visible en iOS Safari y Chrome Android.
- Se introdujo el componente reutilizable `Screen` (header/content/footer) para estandarizar pantallas de altura fija sin scroll del `body`, delegando el scroll sólo a contenedores internos cuando corresponde.
- Se añadió el hook `useLockBodyScroll(ref)` y un ejemplo `OverlayModal` para bloquear fondo en overlays y reducir rubber-band/scroll accidental en mobile.
- Se ajustó el viewport meta, estilos globales (`html`, `body`, `#root`) y reemplazos de `100vh/min-h-screen` conflictivos por patrón robusto mobile-first.
- Se agregaron tests automatizados para validar `Screen` y el lock/unlock del scroll de `body`.
- Footer/versionado actualizado a **v1.2.44** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.43
- Se compactó el layout del menú principal en mobile (cabecera de contenido, selector de categoría y tarjetas de modo) para aprovechar mejor el alto disponible y reducir scroll innecesario sin recortar información.
- Se ajustó la densidad visual de chips y CTAs con jerarquía más clara, manteniendo contraste y legibilidad en dark mode.
- Se actualizaron tests automatizados del menú para validar el nuevo layout compacto mobile-first y prevenir regresiones de espaciado/altura.
- Footer/versionado actualizado a **v1.2.43** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.42
- Se consolidó una bandeja de acción fija para ronda en mobile (confirmar/siguiente/espera) en modo individual, duelo y desafío, evitando que los CTA críticos queden fuera de pantalla.
- Se compactaron márgenes y alturas en scaffold de ronda, cabeceras y progreso para aprovechar mejor el alto disponible sin cortar contenido crítico.
- Se optimizó la tarjeta de pregunta compacta (especialmente siluetas y banderas) para reducir espacios verticales desaprovechados y mejorar jerarquía visual.
- Se actualizaron pruebas automatizadas de bandeja y páginas de juego para validar el contenedor fijo de acciones y prevenir regresiones de visibilidad en mobile.
- Footer/versionado actualizado a **v1.2.42** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.41
- Se rediseñaron las vistas previas al juego (Home, Menú, Login y Registro) con una estética dark mode más cuidada, compacta y mobile-first, priorizando jerarquía visual clara y mejor legibilidad.
- En menú se eliminaron CTA redundantes en mobile (barra fija duplicada), manteniendo una única zona de acciones para reducir ruido y mejorar foco de decisión.
- Se ajustaron espaciados y densidad visual para minimizar la necesidad de scroll en pantallas pequeñas sin forzar recortes de contenido.
- Se añadieron/actualizaron pruebas automatizadas de Home/Menú/Login y nueva cobertura de Registro para blindar el layout previo a partida.
- Footer/versionado actualizado a **v1.2.41** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.40
- Se simplificó la bandeja de acciones en ronda para que **Confirmar** sea el único CTA principal antes de responder, reduciendo ruido visual y priorizando la acción clave.
- Se eliminó el botón secundario de “Cambiar selección”: ahora basta con tocar otra alternativa para corregir, manteniendo una interacción más natural y mobile-first.
- Se actualizaron pruebas de bandeja y páginas de juego (individual, duelo y desafío) para validar la nueva jerarquía de acciones sin CTA auxiliar.
- Footer/versionado actualizado a **v1.2.40** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.39
- Se mejoró visualmente la bandeja de acciones en dark mode con un estilo más atractivo para contexto Río: contraste reforzado, profundidad sutil y CTA principal con gradiente cian/azulado para jerarquía clara.
- Se optimizó la UX de los botones **Confirmar** y **Cambiar selección**: mejor lectura táctil mobile-first, iconografía de apoyo y feedback visual más evidente para reducir errores.
- Se agregó microcopy asistivo breve (“Selección lista para confirmar”) para dar seguridad antes de enviar respuesta en modos individual, duelo y desafío.
- Se actualizó la cobertura automatizada de `RoundActionTray` para validar este nuevo estado de ayuda contextual.
- Footer/versionado actualizado a **v1.2.39** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.38
- Se consolidó la bandeja de acciones de ronda en un componente reutilizable (`RoundActionTray`) para un jugador, duelo y desafío, evitando implementaciones separadas por modo y asegurando consistencia visual mobile-first.
- Cada modo ahora delega en el mismo bloque base y controla por estado interno qué mostrar (enviar, limpiar, esperando rival, resultado o siguiente), reduciendo divergencias de UX/UI y facilitando mantenimiento.
- Se agregó cobertura automatizada para el nuevo componente reutilizable y se actualizaron pruebas de páginas de juego para validar la integración transversal.
- Footer/versionado actualizado a **v1.2.38** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.37
- Se unificó la estructura visual de ronda de juego en un componente reutilizable (`GameRoundScaffold`) para modo individual, duelo y desafío, evitando divergencias de layout entre modos.
- Ahora cada modo reutiliza los mismos bloques base (header/progreso/contenido/CTA) y sólo define qué piezas se muestran según estado interno, manteniendo una experiencia coherente mobile-first en claro/oscuro.
- Se actualizaron pruebas de páginas de juego para cubrir la reutilización del scaffold y prevenir regresiones de UX/UI al evolucionar nuevos modos.
- Footer/versionado actualizado a **v1.2.37** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.36
- Se corrigió el layout de `GamePage` para evitar recortes visuales tras seleccionar/responder: ahora el contenido principal puede crecer y desplazarse verticalmente sin cortar tarjetas, alternativas ni bloque de resultado.
- Se mantuvo la bandeja de acción sticky con espacio seguro inferior, pero reforzando el contenedor para no sacrificar contenido visible en pantallas pequeñas y dark mode.
- Se agregaron/actualizaron pruebas de `GamePage` para blindar el comportamiento de contención (sin clipping) y la visibilidad de CTA/resultados.
- Se creó `AGENTS.md` en la raíz con lineamientos de diseño/UX permanentes (mobile-first, dark mode, no clipping, tests obligatorios, actualización de README + footer versionado).
- Footer/versionado actualizado a **v1.2.36** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.35
- Se ajustó la barra de progreso para que los números de preguntas queden **en una sola fila** en mobile y desktop, sin saltos de línea ni desplazamiento horizontal.
- Cada indicador ahora calcula su ancho de forma proporcional dentro del contenedor, manteniendo todos los números visibles y adaptados al margen disponible.
- Se redujo el peso visual del estado actual en los indicadores para priorizar legibilidad en pantallas pequeñas sin perder feedback de estado.
- Se actualizó la prueba unitaria de `ProgressBar` para validar explícitamente el layout en una sola fila (`flex-nowrap` + `overflow-hidden`).
- Footer/versionado actualizado a **v1.2.35** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.34
- Se rediseñó la barra de progreso de preguntas en formato **grilla responsiva**, eliminando el scroll horizontal para que todos los números se vean completos dentro del contenedor en mobile-first.
- Se compactó el layout vertical de `GamePage` (header, estado de progreso, tarjetas y CTA) para que el contenido clave quede mejor adaptado al alto de pantalla y se reduzca la necesidad de desplazamiento.
- Se ajustaron tipografías y alturas mínimas de tarjeta/opciones con foco empático en legibilidad y control táctil en teléfonos pequeños.
- Se agregaron y actualizaron pruebas automatizadas para blindar la nueva grilla de progreso sin overflow y los cambios de layout móvil.
- Footer/versionado actualizado a **v1.2.34** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.33
- Se corrigió el desborde de texto en las opciones de respuesta dentro de tarjetas, priorizando una lectura fluida en mobile-first: ahora los textos largos se adaptan dentro del ancho disponible y no rompen el layout del contenedor.
- Se reorganizó internamente el contenido de cada opción para mantener jerarquía visual clara (letra de opción + contenido + estado) con mejor estabilidad en pantallas pequeñas.
- Se añadió prueba automatizada para blindar el ajuste de texto largo y prevenir regresiones en esta experiencia de juego.
- Footer/versionado actualizado a **v1.2.33** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.32
- Se mejoró la experiencia mobile-first en juego individual y desafíos para reducir el scroll al responder: tarjetas más compactas, menor padding vertical y bandeja de acción ajustada al safe-area para priorizar visibilidad inmediata de contenido clave.
- El indicador de pregunta actual ya no comunica error antes de responder: ahora se representa en **amarillo (pendiente actual)** y recién toma estado verde/rojo cuando la respuesta fue confirmada.
- Se reforzó la contención visual para evitar desbordes horizontales en contenedores (pregunta, opciones y barras de progreso), mejorando estabilidad y legibilidad en pantallas pequeñas.
- Se actualizaron pruebas automatizadas del progreso de preguntas y del layout móvil para cubrir estos comportamientos y prevenir regresiones.
- Footer/versionado actualizado a **v1.2.32** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.31
- Se fortaleció el pipeline de despliegue a GitHub Pages para reducir fallas intermitentes: el artefacto se construye una sola vez en el quality gate y luego se publica, evitando dobles builds inconsistentes.
- El workflow de deploy ahora se ejecuta únicamente cuando hay cambios relevantes de frontend o del propio pipeline, disminuyendo alertas innecesarias.
- Se unificó el chequeo de calidad de frontend en el script `npm run ci:quality` para estandarizar validación local/CI y simplificar el flujo interno del equipo.
- Se actualizó la prueba automatizada del workflow para blindar esta configuración y prevenir regresiones futuras en CI/CD.
- Footer/versionado actualizado a **v1.2.31** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.30
- Se creó un workflow dedicado de **deploy a GitHub Pages** con `quality gate` previo (lint + tests unitarios + build), para bloquear despliegues con regresiones antes de publicar.
- El despliegue ahora usa `concurrency` para cancelar ejecuciones simultáneas y reducir fallas intermitentes por carreras entre pushes.
- Se configuró el build para GitHub Pages con `VITE_BASE_PATH` dinámico por repositorio, evitando errores de carga de assets/rutas al publicar en `/<repo>/`.
- Se añadió prueba automatizada para blindar la existencia del flujo de deploy y la configuración del base path, evitando que futuras modificaciones rompan CI/CD.
- Footer/versionado actualizado a **v1.2.30** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.29
- Se optimizó la pantalla de juego individual para móviles en preguntas de silueta: la tarjeta de pregunta ahora usa un layout compacto (menos altura de imagen y tipografía ajustada) para responder sin necesidad de scroll en la mayoría de pantallas pequeñas.
- Se redujeron espacios verticales en el flujo de pregunta/respuesta para mantener el CTA principal más accesible con el pulgar y mejorar la continuidad de uso.
- Se agregó cobertura de pruebas en `GamePage` para validar la activación automática del modo compacto en la categoría `SILHOUETTE`.
- Footer/versionado actualizado a **v1.2.29** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.28
- Se ajustó el workflow `keep-backend-awake` para que, si el secret `BACKEND_HEALTHCHECK_URL` no está configurado, emita una advertencia y finalice sin error en lugar de romper la ejecución.
- Se mantiene el comportamiento de ping cada 10 minutos cuando el secret está presente, sin cambios en la URL de salud configurada.
- Footer/versionado actualizado a **v1.2.28** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.27
- Se corrigió un error de tipado en pruebas de `ResultsPage` que rompía el build de TypeScript en CI/deploy.
- Se ajustó el flujo async del test de compartir resultado para mantener cobertura sin sacrificar estabilidad del pipeline.
- Footer/versionado actualizado a **v1.2.27** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.26
- Se aplicaron **10+ mejoras de UX mobile-first** en `ChallengeGamePage`: header sticky con salida rápida, temporizador y puntuación más legibles, bandeja de acción fija inferior con safe-area y CTA principal con mejor jerarquía táctil.
- Se incorporó guía contextual dinámica por estado (sin selección, selección lista, tiempo crítico y post-respuesta) para acompañar al usuario de forma empática sin saturar la interfaz.
- Se añadió acción explícita **Cambiar selección** antes de confirmar para reducir errores por toques accidentales en móvil.
- Se reforzó la accesibilidad visual y semántica en progreso/temporizador/tarjeta de pregunta (roles, labels y contraste) y se mejoró el tratamiento responsive de alternativas para banderas en una sola columna en pantallas pequeñas.
- Se actualizaron traducciones ES/EN y pruebas de `ChallengeGamePage` para cubrir bandeja sticky, estado deshabilitado de confirmar y limpieza de selección.
- Footer/versionado actualizado a **v1.2.26** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.25
- Se aplicaron **10+ mejoras de UX mobile-first** en la pantalla de resultados: mayor jerarquía visual del puntaje, tarjeta principal con mejor contraste, barra de precisión más clara y tarjetas de métricas más legibles para lectura rápida.
- Se mejoró la usabilidad de acciones finales con una bandeja inferior sticky (Jugar de nuevo, Ver rankings, Volver al menú), targets táctiles más cómodos y soporte de safe-area en móviles con notch.
- El flujo de compartir ahora evita toques duplicados: el botón se deshabilita mientras comparte, muestra estado de carga y mantiene confirmación inline no intrusiva.
- En la pantalla de juego se reforzó el contexto durante la partida: encabezado con safe-area y estado de selección visible junto al progreso para reducir dudas antes de confirmar.
- Se añadieron/actualizaron pruebas en `ResultsPage` y `GamePage` para cubrir barra de precisión, estado de compartir en progreso y nuevo estado contextual de selección.
- Footer actualizado a **v1.2.25** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.24
- Se aplicó un refinamiento visual mobile-first en la pantalla de juego para alinearla con los pantallazos de referencia: tarjeta de pregunta más limpia, badges de dificultad con mejor contraste y botones de alternativa con mayor legibilidad táctil.
- Se mejoró la jerarquía del flujo de respuesta con CTA principal/deshabilitado más claro, panel de ayuda contextual más legible y bloque de acción inferior con mejor espaciado para pulgar.
- Se ajustó la barra de progreso para reforzar estados (actual/correcta/incorrecta) y mantener lectura cómoda en scroll horizontal en dispositivos pequeños.
- Se agregó/actualizó cobertura de pruebas en `GamePage` para validar que el botón **Confirmar** permanezca deshabilitado hasta seleccionar una alternativa y el nuevo espaciado inferior mobile.
- Footer actualizado a **v1.2.24** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.23
- Se mejoró la experiencia mobile-first en la modalidad individual: la guía de selección ahora se oculta automáticamente al mostrar el resultado, evitando mensajes duplicados y reduciendo ruido visual.
- Se reforzó la jerarquía visual del mapa y del bloque de distancia con contenedores más claros y espaciado consistente, para lectura rápida en pantallas pequeñas.
- Se ajustó la barra de progreso de preguntas con indicadores más cómodos para touch y scroll horizontal en móvil cuando sea necesario.
- Se agregaron/actualizaron pruebas de `GamePage` para validar que la guía contextual no aparezca durante la revisión de respuesta.
- Footer actualizado a **v1.2.23** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.22
- Se aplicó una mejora de usabilidad mobile-first en Juego individual y Duelo: la bandeja de acciones (Confirmar/Cambiar selección/Siguiente) ahora queda anclada al borde inferior con gradiente sutil, mejorando visibilidad y alcance con pulgar.
- Se añadió espacio inferior seguro (`safe-area`) y padding del contenido para evitar que la UI quede tapada en dispositivos con notch o barras del sistema.
- Se agregaron pruebas en `GamePage` y `DuelPage` para validar la bandeja fija y prevenir regresiones de UX.
- Footer actualizado a **v1.2.22** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.21
- Se aplicaron 3 mejoras en Duelo con enfoque mobile-first y empatía: contexto visible durante matchmaking (categoría activa, espera estimada y salida sin penalización), guía contextual dinámica antes de confirmar respuesta y alerta calmada cuando quedan pocos segundos.
- Se añadió una acción explícita de **Cambiar selección** para reducir envíos accidentales y dar más control al usuario en pantallas táctiles.
- Se actualizaron traducciones ES/EN y pruebas de `DuelPage` para cubrir estas mejoras de usabilidad.
- Footer actualizado a **v1.2.21** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.20
- Se aplicaron 3 mejoras de usabilidad y empatía en `GamePage` con enfoque mobile-first: guía contextual persistente antes de responder, aviso calmado de tiempo crítico (últimos 5 segundos) y acción explícita para cambiar selección antes de confirmar.
- Estas mejoras reducen errores por toques accidentales y acompañan mejor al usuario en momentos de presión sin recargar la interfaz.
- Se actualizaron traducciones ES/EN y pruebas automatizadas para cubrir los nuevos mensajes y el flujo de limpiar selección.
- Footer actualizado a **v1.2.20** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.19
- Se corrigió el fallo de build en TypeScript eliminando imports de APIs de Node en el test `qa-scripts` y reemplazándolos por import directo de `package.json`, compatible con el entorno de compilación web.
- Se mantiene la cobertura de QA para scripts de lint y E2E en local/CI sin depender de tipados de Node en el pipeline de despliegue.
- Footer actualizado a **v1.2.19** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.18
- Login reforzado con 3 mejoras de usabilidad mobile-first: botón de acceso deshabilitado hasta completar datos, ayuda contextual visible y toggle para mostrar/ocultar contraseña con targets táctiles cómodos.
- Se añadieron atributos de autocompletado y entrada optimizada para correo (`autoComplete`, `inputMode`, `autoFocus`) para reducir fricción en pantallas móviles.
- Los errores de login ahora se limpian cuando el usuario edita campos, evitando mensajes obsoletos y mejorando claridad.
- Se actualizaron pruebas de `LoginPage` para cubrir las nuevas funcionalidades de UX.
- Footer actualizado a **v1.2.18** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.16
- Menú mobile mejorado con una barra de **acciones rápidas** (Un Jugador, Duelo y Desafíos) para reducir pasos y facilitar partidas rápidas con una sola mano.
- Se recuerda automáticamente la última categoría elegida en el menú (`localStorage`) para evitar que el usuario repita la misma selección en cada ingreso.
- Home ahora muestra un mensaje de bienvenida contextual cuando el usuario está autenticado, reforzando cercanía y claridad de la acción principal.
- Se actualizaron pruebas automatizadas de Home y Menú para cubrir estas funcionalidades nuevas.
- Footer actualizado a **v1.2.16** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.15
- Se unificó el footer en un componente reutilizable (`AppFooter`) para reducir duplicidad y asegurar consistencia visual de la versión en Home y Menú.
- Home ahora incluye un **skip link** accesible (“Ir a las acciones principales”) para mejorar navegación con teclado y lectores de pantalla, especialmente en mobile con accesorios.
- Se añadió una línea de confianza breve en Home y una confirmación visible/`aria-live` de categoría activa en Menú para reducir fricción y reforzar claridad de estado.
- Se actualizaron pruebas de Home y Menú para cubrir las nuevas mejoras de usabilidad y accesibilidad.
- Footer actualizado a **v1.2.15** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.14
- Se añadió un workflow de GitHub Actions (`keep-backend-awake.yml`) que hace ping automático cada 10 minutos al endpoint de salud del backend para reducir los cold starts y evitar tener que “despertar” manualmente el servidor antes de jugar.
- Se incorporó un keep-alive silencioso en frontend que envía un ping cada 4 minutos mientras la app está abierta y visible, mejorando continuidad en sesiones móviles reales sin afectar la UI minimalista.
- Se agregaron pruebas automatizadas para validar el comportamiento del keep-alive en pestaña visible/oculta.
- Footer actualizado a **v1.2.14** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.13
- Se aplicaron 3 mejoras de estilo globales con enfoque mobile-first y coherencia visual: nuevo `app-shell` reutilizable, paneles `surface-panel` y footer unificado con badge de versión para reducir duplicidad entre pantallas clave.
- Se optimizó la usabilidad móvil en la grilla horizontal de categorías ocultando el scrollbar visual (`scrollbar-none`) sin perder desplazamiento táctil, manteniendo una UI más limpia y minimalista.
- Se incorporó soporte global de accesibilidad para usuarios con `prefers-reduced-motion`, reduciendo animaciones/transiciones para una experiencia más confortable sin afectar funcionalidad.
- Se actualizaron pruebas de Home y Menú para cubrir las nuevas clases globales y el badge de versión en footer.
- Footer actualizado a **v1.2.13** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.12
- Se corrigió el test E2E mobile de Home que fallaba en CI por depender de una versión fija (`v1.2.7`): ahora valida la versión real leyendo `frontend/package.json`, evitando obsolescencia en cada release.
- Con este ajuste, el check de footer sigue verificando trazabilidad de versión sin romper despliegues en GitHub Pages cuando subimos versión.
- Footer actualizado a **v1.2.12** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.11
- Se actualizaron los tests de páginas que usan `MemoryRouter` para adoptar los future flags de React Router v7 (`v7_startTransition` y `v7_relativeSplatPath`), eliminando advertencias deprecadas y dejando la suite alineada al comportamiento actual del enrutador.
- Se mantuvo la cobertura funcional existente sin datos mock adicionales, asegurando que los flujos clave de Home, Login y Menú sigan verificados con un enfoque mobile-first y minimalista.
- Footer actualizado a **v1.2.11** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.10
- Se rediseñó la arquitectura de enrutamiento para usar un único `AuthProvider` global, eliminando montajes repetidos por ruta que reiniciaban el estado de autenticación y podían disparar validaciones innecesarias de sesión durante el login.
- Se corrigió la latencia percibida al iniciar sesión: la conexión de socket ahora se ejecuta en segundo plano, evitando bloquear la navegación al menú cuando las credenciales son correctas.
- Se mejoró el feedback UX del login con estado local de envío y mensajes accionables ante rate limit (`retryAfterSeconds`), para que el usuario sepa exactamente cuándo reintentar.
- Se actualizaron pruebas automatizadas de routing y login para blindar la nueva estructura y el manejo de errores de autenticación.
- Footer actualizado a **v1.2.10** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.9
- Se corrigió un error crítico de compilación en backend que rompía deploys: las respuestas automáticas por timeout en duelos ahora incluyen `timeRemaining`, cumpliendo el contrato tipado de `AnswerResult`.
- Se centralizó la creación de respuestas vacías en un helper reutilizable para evitar futuras divergencias de tipo en flujos de juego en tiempo real.
- Se añadió una prueba automatizada específica para blindar la estructura mínima requerida de respuestas no contestadas.
- Se incorporó un workflow de CI para backend que ejecuta instalación, build TypeScript y tests en cada push/PR, previniendo que errores de compilación lleguen a producción.
- Footer actualizado a **v1.2.9** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.8
- Se corrigió la validación al crear desafíos para aceptar payloads parametrizados de forma robusta: categorías en minúsculas/mayúsculas y campos numéricos serializados como string ahora se normalizan antes de validar.
- Se evita el falso error de **"Datos inválidos"** cuando el cliente envía datos tipados de forma compatible pero no estrictamente idéntica (caso común en integraciones y formularios).
- Se añadió una prueba automatizada del esquema de creación de desafíos para prevenir regresiones de validación.
- Footer actualizado a **v1.2.8** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.7
- Se ajustó la protección de autenticación para evitar bloqueos injustos: el límite de intentos ahora se aplica solo a **login/registro**, sin impactar endpoints autenticados como `me` o `profile`.
- Se mejoró la experiencia ante límite excedido con un mensaje más claro y un campo `retryAfterSeconds` para guiar al usuario sobre cuándo reintentar.
- El backend ahora confía en proxy (`trust proxy`) para identificar correctamente la IP real en despliegues detrás de infraestructura intermedia.
- Se añadieron pruebas automatizadas para validar el cálculo de reintento del rate limit (sin mock data).
- Footer actualizado a **v1.2.7** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.6
- Se corrigió el build de frontend en CI/CD y GitHub Pages eliminando dependencias de APIs de Node en una prueba de QA (`node:fs`, `node:path`, `__dirname`) que no estaban disponibles en el entorno de compilación.
- La prueba de scripts QA ahora usa importación JSON tipada desde `package.json`, compatible con la configuración TypeScript del proyecto y con enfoque de mantenimiento simple.
- Se mantuvo cobertura automatizada de la funcionalidad QA existente, actualizando la implementación del test sin usar mock data.
- Footer actualizado a **v1.2.6** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.5
- Se corrigió la navegación de **Desafíos** para despliegues en GitHub Pages: el router ahora respeta `BASE_URL`, evitando redirecciones a rutas inservibles fuera del prefijo de la app.
- El acceso a **Desafíos** desde el menú ahora conserva la categoría elegida y abre la configuración directamente para parametrizar más rápido (flujo mobile-first con menor fricción).
- Se reforzó el manejo de redirecciones de autenticación para usar rutas internas de la app, evitando saltos rotos a `/login` fuera del contexto del despliegue.
- Se añadieron pruebas automatizadas para validar la preparametrización de desafíos desde menú y la creación con categoría inicial.
- Footer actualizado a **v1.2.5** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.4
- Se corrigió el flujo de cierre de partida en **Desafíos**: ahora existe una pantalla de resultados dedicada para `/challenges/:id/results`, evitando la navegación a una página inservible al terminar.
- Se mejoró la usabilidad al parametrizar y jugar desafíos grupales: si todavía no se completa el cupo de jugadores, el CTA se muestra deshabilitado y con estado de espera claro (sin redirecciones erróneas).
- Se añadieron/actualizaron pruebas automatizadas para cubrir la nueva ruta de resultados y el estado de espera del botón en desafíos pendientes.
- Footer actualizado a **v1.2.4** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.3
- Se simplificó la **Home** para mantener solo lo esencial: propuesta de valor clara, CTA principal y navegación directa, eliminando bloques de relleno visual.
- Se rediseñó el **Menú** con enfoque minimalista y mobile-first: menos ruido, categorías priorizadas y accesos rápidos a los tres modos clave.
- Se removieron elementos secundarios de baja utilidad (estadísticas y accesos redundantes) para reducir carga cognitiva y mejorar la toma de decisión del usuario.
- Pruebas automatizadas actualizadas para validar el nuevo layout mínimo y la versión vigente en footer.
- Footer actualizado a **v1.2.3** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.2
- Se mejoró la discoverabilidad para crear desafíos multijugador: ahora la pantalla de **Desafíos** muestra una sección destacada con CTA claro para configurar categorías, cupo y tiempo por pregunta.
- Cuando no existen desafíos en la pestaña activa, se muestra un estado vacío accionable con botón directo para crear un nuevo desafío multijugador.
- Se actualizaron traducciones ES/EN y pruebas automatizadas para validar la nueva llamada a la acción de creación.
- Footer actualizado a **v1.2.2** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.1
- Se completó el flujo de **Desafíos** para duelos grupales con enfoque mobile-first: creación guiada por categorías, cupo de jugadores (2-8) y tiempo por pregunta (10/20/30s) con resumen claro antes de publicar.
- Se mejoró la experiencia de quienes se quieren unir a una convocatoria: estado localizado, categorías legibles y visibilidad de cupos disponibles en cada desafío.
- Se añadieron nuevos textos i18n (ES/EN) para mantener consistencia entre creación y unión de desafíos multijugador.
- Se actualizaron pruebas automatizadas para cubrir la nueva selección de cupo y el flujo de unión desde la pestaña “Para unirme”.
- Footer actualizado a **v1.2.1** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.2.0
- La funcionalidad de **Desafíos** ahora soporta partidas multijugador (más de 2 personas) con cupo configurable de 2 a 8 jugadores.
- Al crear una convocatoria puedes definir categorías incluidas (multi-selección), tiempo por pregunta (10/20/30 segundos) y cantidad máxima de participantes.
- Nuevo flujo para unirse a convocatorias abiertas desde la pestaña “Para unirme”, con estado de cupos visibles y experiencia mobile-first.
- El modo de juego del desafío respeta el tiempo configurado por convocatoria para mantener consistencia entre creación y partida.
- Se añadieron pruebas automatizadas para validar la creación de desafíos multijugador con configuración completa.
- Footer actualizado a **v1.2.0** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.24
- Se reforzó la ejecución de calidad para que ESLint y Playwright se lancen siempre con comandos consistentes desde `package.json`, tanto en local como en CI.
- El workflow de frontend ahora ejecuta el script único `test:e2e:ci`, reduciendo fallos por diferencias de comandos entre entornos.
- Nueva prueba automatizada para validar la configuración mobile-first de Playwright y el arranque e2e (build + preview) y prevenir regresiones.
- Footer actualizado a **v1.1.24** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.23
- Corrección en duelos para preguntas consecutivas de tipo **MAP**: ahora el componente del mapa recibe `questionId`, permitiendo resetear correctamente el viewport (centro + zoom) al iniciar cada nueva pregunta y evitando arrastrar la vista anterior.
- Se añadió prueba automatizada en `DuelPage` para validar que el `questionId` se propaga al mapa y prevenir regresiones en este flujo.
- Footer actualizado a **v1.1.23** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.22
- Se configuró ESLint en frontend con una base estable para que `npm run lint` pueda ejecutarse de forma consistente en local y CI.
- Se añadió infraestructura de Playwright para e2e (`playwright.config.ts` + prueba mobile-first de Home) enfocada en validar el flujo principal sin mock data.
- Se incorporó workflow de GitHub Actions para ejecutar lint, pruebas unitarias y pruebas e2e de Playwright en cada push/PR.
- Footer actualizado a **v1.1.22** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.21
- Corrección visual mobile-first en pantalla de resultados: los badges de **Correctas/Incorrectas** ahora quedan contenidos dentro de sus tarjetas, evitando desbordes y mejorando legibilidad en pantallas pequeñas.
- Refuerzo global del componente `AnswerStatusBadge` para prevenir overflow en otros contextos (ancho máximo, truncado y espaciado más compacto).
- Mejora del bloque de compartir resultados con CTA más claro, jerarquía visual más limpia y feedback inline no intrusivo (sin `alert`).
- Mensaje de compartir actualizado para ser más útil y motivador, incluyendo puntaje, aciertos totales y precisión.
- Nueva prueba automatizada de `ResultsPage` para validar contención visual y flujo de compartir (texto copiado + confirmación).
- Footer actualizado a **v1.1.21** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.20
- Ajuste mobile-first de consistencia visual en Home y Menú: se reforzó la contención horizontal de layout (`overflow-x-clip`) para evitar desbordes involuntarios entre secciones en pantallas pequeñas.
- Se añadieron mejoras de coherencia en tarjetas y textos (`min-w-0` y `break-words`) para que el contenido interno respete los márgenes del contenedor y no se salga visualmente.
- Se ajustaron áreas seguras móviles en header/CTA inferior del menú para mejorar estabilidad visual en dispositivos con notch o barras del sistema.
- Pruebas automatizadas actualizadas para validar contención visual y versión del footer.
- Footer actualizado a **v1.1.20** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.19
- Mejora mobile-first en partida individual para categoría **Banderas**: las alternativas ahora se muestran en una sola columna en pantallas pequeñas, priorizando legibilidad y evitando toques accidentales cuando hay imagen de bandera en pantalla.
- En pantallas medianas o mayores se conserva la grilla de dos columnas para mantener densidad visual sin perder claridad.
- Se actualizó la suite de pruebas de `GamePage` incorporando un caso específico para categoría `FLAG` que valida este comportamiento responsive y previene regresiones.
- Footer actualizado a **v1.1.19** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.18
- Mejora mobile-first de navegación en menú: se aumentó el área táctil mínima de acciones clave (rankings, perfil, cerrar sesión y categorías) para facilitar interacción con pulgar y reducir toques erróneos.
- Se añadió una pista contextual en móvil para el carrusel de categorías ("Desliza para ver más categorías"), mejorando descubribilidad y usabilidad sin recargar la interfaz.
- Se actualizaron traducciones i18n (ES/EN) y pruebas automatizadas para validar la nueva pista mobile y mantener cobertura funcional.
- Footer actualizado a **v1.1.18** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.17
- Mejora mobile-first en el menú principal: selección de categoría convertida en carrusel horizontal con `snap`, reduciendo saturación visual y facilitando el alcance con pulgar en pantallas pequeñas.
- Se añadió un CTA fijo inferior para iniciar partida individual con la categoría activa visible, priorizando acción principal y disminuyendo fricción en móvil.
- El menú ahora incluye footer con versión de app para trazabilidad del despliegue en GitHub Pages, alineado con el resto de vistas.
- Pruebas automatizadas actualizadas para validar el CTA mobile y la versión visible en footer.
- Footer actualizado a **v1.1.17** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.16
- Recomendación aplicada: el badge principal del Home dejó de estar hardcodeado y ahora usa i18n (`home.badge`), mejorando consistencia multilenguaje y usabilidad para usuarios en inglés.
- Se añadieron/actualizaron pruebas para validar el texto del badge y la versión visible en el footer.
- Footer actualizado a **v1.1.16** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.15

- Se reforzó la estabilidad del inicio de duelos agregando un timeout de seguridad de "ready": si ambos jugadores quedan emparejados pero uno no confirma, el backend fuerza el arranque para evitar bloqueos en estado de espera.
- Se añadió un evento explícito (`duel:ready-timeout`) para dejar trazabilidad del arranque forzado y facilitar monitoreo/diagnóstico del matchmaking en producción.
- Nuevas pruebas automatizadas para blindar la lógica de timeout del estado `waiting` y prevenir regresiones en el flujo de inicio.
- Footer actualizado a **v1.1.15** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.14

- Mejora mobile-first en vistas de desafío y duelo: las alternativas ahora se renderizan en grilla de 2 columnas para mostrar todas las opciones más rápido y reducir el scroll en pantallas pequeñas.
- Se agregaron pruebas automatizadas nuevas para validar la grilla de alternativas en `ChallengeGamePage` y `DuelPage`, manteniendo cobertura de UX en flujos clave.
- Footer actualizado a **v1.1.14** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.13

- Se incorporó un bypass de autenticación **seguro y explícito para tests** que evita bloquear la ejecución automática cuando no hay sesión iniciada.
- El bypass requiere cabecera secreta (`x-test-auth-bypass`) y sólo se activa en entorno de testing o cuando se habilita por variables de entorno, manteniendo protección en producción.
- Se añadió utilitario de frontend para inyectar el bypass en pruebas y fallback de autenticación en `AuthContext` para mejorar estabilidad de tests E2E/integración.
- Nuevas pruebas automatizadas para validar la configuración del bypass en frontend y backend.
- Footer actualizado a **v1.1.13** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.12

- Reorganización mobile-first de alternativas en juego individual: ahora se muestran en una grilla de 2 columnas para reducir el scroll y mantener todas las opciones visibles más rápido en pantallas pequeñas.
- Ajuste visual minimalista en cada botón de alternativa (espaciado, tipografía y tamaños) para mejorar legibilidad y densidad sin perder accesibilidad.
- Nueva prueba automatizada en `GamePage` para validar la grilla de dos columnas y actualización de pruebas del botón de alternativa para el nuevo tamaño compacto.
- Footer actualizado a **v1.1.12** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.11

- Optimización mobile-first del bloque de alternativas para que entren mejor en pantalla sin scroll innecesario: menor altura mínima, padding más compacto y tipografía ajustada en pantallas pequeñas.
- Badge de selección adaptado para mobile con icono compacto, conservando el texto completo en pantallas mayores para mantener claridad y accesibilidad.
- Se actualizó la prueba del botón de alternativa para validar explícitamente la nueva configuración compacta orientada a móvil.
- Footer actualizado a **v1.1.11** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.10

- Se corrigieron y estandarizaron textos en español para respetar tildes, signos de apertura (¿, ¡) y ortografía en la experiencia completa.
- Se reforzó la calidad con una prueba automatizada nueva para validar traducciones críticas en español y prevenir regresiones de acentuación.
- Footer actualizado a **v1.1.10** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.9

- Se incorporó selección integral de categoría en duelos: ahora puedes buscar partidas de **solo banderas, solo capitales, solo mapas, solo siluetas o mixto** desde el menú principal.
- Matchmaking de duelos ajustado para respetar la categoría elegida por ambos jugadores, evitando cruces inconsistentes entre modos.
- El reintento de duelo conserva la categoría activa para mantener una experiencia coherente y predecible.
- Se agregaron pruebas automatizadas en frontend y backend para blindar el ruteo por categoría y el emparejamiento por tipo de duelo.
- Footer actualizado a **v1.1.9** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.8

- Se rediseñó el modelo de puntuación para que sea transversal, objetivo y coherente entre modos: ahora la velocidad de respuesta impacta de forma explícita en el puntaje en preguntas de opción múltiple y también en preguntas de mapa.
- En preguntas de mapa, el puntaje ya no depende solo de acertar/fallar: combina precisión geográfica (distancia) + rapidez para premiar mejor desempeño real.
- En duelos, además del score total, se agregó un desempate objetivo por tiempo restante acumulado cuando ambos jugadores terminan con el mismo puntaje.
- Se reforzaron pruebas automatizadas de scoring y de desempate en duelos para cubrir estos nuevos criterios y evitar regresiones.
- Footer actualizado a **v1.1.8** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.7

- Corregido el resumen de progreso en partida individual: ahora cada indicador solo se pinta verde/rojo si esa pregunta ya fue respondida, evitando que preguntas no respondidas aparezcan en rojo.
- Ajustada la lógica para que la pregunta activa se marque correctamente como actual incluso cuando el avance y los resultados llegan desfasados temporalmente.
- Se reforzó la suite de pruebas con un caso que reproduce este desajuste y previene regresiones en el indicador superior.
- Footer actualizado a **v1.1.7** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.6

- Estandarizados los indicadores de respuesta correcta/incorrecta en juego individual, duelo y resumen final usando un mismo componente visual reutilizable.
- Se alineó el feedback de selección y resultado entre botones de alternativas y paneles de resultado para mantener coherencia total en mobile y desktop.
- Se agregaron nuevas claves de i18n para etiquetas consistentes de estado de respuesta (correcta/incorrecta y opción seleccionada).
- Se incorporó una prueba automatizada para el nuevo badge de estado y se actualizaron pruebas existentes de botón/versión.
- Footer actualizado a **v1.1.6** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.5

- Auditoría de buenas prácticas aplicada al manejo de versión en frontend: el footer ahora consume automáticamente la versión real del paquete en build para evitar desalineación entre app y despliegue en GitHub Pages.
- Se tipó la constante global de versión (`__APP_VERSION__`) para mantener seguridad de tipos y evitar accesos implícitos.
- Se reforzó la prueba de Home para validar que el footer renderiza la versión activa esperada.
- Footer actualizado a **v1.1.5** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.4

- Corregida una condición de carrera en duelos que podía resolver la misma pregunta más de una vez bajo latencia/reintentos, provocando auto-respuestas aparentes en ambos jugadores.
- Se agregó un candado de resolución por índice de pregunta (`resolvingQuestionIndex`) para garantizar idempotencia del cierre por pregunta.
- Se añadió protección de respuesta en vuelo por jugador (`pendingQuestionIndex`) para evitar duplicados mientras se valida en backend.
- Se reforzó la suite de pruebas en backend para cubrir escenarios de auto-cierre y resolución única.
- Footer actualizado a **v1.1.4** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.3

- En preguntas de mapa, cada nueva pregunta ahora inicia desde una vista neutral global para evitar perder tiempo reubicando el mapa entre intentos consecutivos.
- Se corrigió el estado visual del resumen de progreso: cada burbuja ahora refleja el resultado real de su pregunta (verde/roja) en lugar de depender del total acumulado de aciertos.
- Se dejó explícito en backend el umbral de acierto para mapa (`< 500 km`) para mantener consistencia entre puntaje y estado correcto/incorrecto.
- Se agregaron pruebas automatizadas para cubrir el reset de viewport en mapa y la lógica de estado por pregunta en la barra de progreso.
- Footer actualizado a **v1.1.3** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.2

- Corregido un bug crítico en duelos: timers pendientes de preguntas anteriores podían auto-cerrar preguntas nuevas, haciendo que varias respuestas se marcaran solas sin interacción del jugador.
- Se agregó una guarda explícita de índice de pregunta para que cada timeout solo afecte a la pregunta para la que fue programado.
- Se incorporó una prueba automatizada para blindar este comportamiento y evitar regresiones en el flujo multijugador.
- Footer actualizado a **v1.1.2** para mantener trazabilidad con el despliegue en GitHub Pages.


## Novedades de la versión 1.1.1

- Corregido el flujo final de partida en modo individual: la pantalla de resultados ya no desaparece al instante y permanece visible para revisar puntaje, aciertos y acciones posteriores.
- Se agregó prueba automatizada del flujo de fin de partida para asegurar que no se resetee el estado al navegar a resultados.
- Footer actualizado a **v1.1.1** para mantener trazabilidad con el despliegue en GitHub Pages.

## Novedades de la versión 1.1.0

- Correcciones de ortografía y acentuación en español (incluye “Iniciar sesión”) para una experiencia más cuidada.
- Vista de login refinada para modo oscuro con CTA de “Entrar” más claro y apariencia inequívoca de botón en móvil.
- Pantalla de selección de modo de juego rediseñada (header y cuerpo) con enfoque mobile-first, mayor jerarquía visual y mejor legibilidad.
- Footer actualizado a **v1.1.0** para mantener trazabilidad con el despliegue en GitHub Pages.
- Mejorado el estado visual de alternativas en preguntas: selección más evidente (anillo, contraste y badge) para reducir dudas en móvil.
- Header de juego fijado arriba (sticky) para mantener el temporizador siempre visible mientras haces scroll en preguntas largas o mapas.
- Botones de login, registro y acciones de juego actualizados con apariencia de CTA clara y feedback de carga/press para mejor percepción de respuesta.
- Home refinado con layout mobile-first más compacto y jerarquía visual optimizada para primera interacción en teléfonos.
- Footer actualizado a **v1.0.9** para reflejar la versión desplegada en GitHub Pages.
- Reparado el flujo completo de duelos para evitar efectos secundarios de re-suscripción en sockets (causaban comportamientos erráticos de respuestas en pantalla) y mantener estado consistente al actualizar puntajes.
- Mejorado el envío de respuestas de mapa en duelos: ahora se incluyen coordenadas reales para validación correcta en backend.
- Footer de la app actualizado a **v1.0.9** para mantener trazabilidad con el despliegue en GitHub Pages.
- Corregido el flujo de fin de partida en modo individual: ahora `Ver resultado` mantiene el estado de la sesión y muestra la pantalla de resultados en lugar de redirigir al home/menu.
- Rediseño de la vista principal con enfoque **mobile-first**, mejor jerarquía visual y CTA más claros para mejorar la usabilidad inicial.
- Feedback visual mejorado al seleccionar alternativas (estado activo más claro con realce y etiqueta de selección), manteniendo un enfoque mobile-first y accesible.
- En preguntas de mapa, al mostrar un resultado incorrecto la vista ahora ajusta automáticamente el encuadre para mostrar tanto tu selección como la ubicación correcta, evitando que tengas que desplazar el mapa manualmente.

## Requisitos Previos

- **Node.js** v18 o superior
- **PostgreSQL** v14 o superior
- **Redis** v6 o superior (para leaderboards y duelos)

## Estructura del Proyecto

```
geochallenge/
├── backend/          # API Node.js + Express + Socket.IO
├── frontend/         # React + Vite + TypeScript
└── data/             # Datos de países (JSON)
```

---

## Paso 1: Configurar PostgreSQL

### Opción A: Con Docker (recomendado)
```bash
docker run --name geochallenge-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=geochallenge \
  -p 5432:5432 \
  -d postgres:14
```

### Opción B: Instalación local
1. Instalar PostgreSQL
2. Crear base de datos:
```sql
CREATE DATABASE geochallenge;
```

---

## Paso 2: Configurar Redis

### Opción A: Con Docker (recomendado)
```bash
docker run --name geochallenge-redis \
  -p 6379:6379 \
  -d redis:7
```

### Opción B: Instalación local
Instalar Redis y asegurarse de que esté corriendo en el puerto 6379.

---

## Paso 3: Configurar el Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo de variables de entorno
cp .env.example .env
```

### Editar el archivo `.env`:
```env
# Base de datos
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/geochallenge?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="tu-secreto-super-seguro-cambiar-en-produccion"

# Server
PORT=3001
NODE_ENV=development
```

### Ejecutar migraciones y seed:
```bash
# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# Poblar base de datos con preguntas (196 países × 4 categorías = 784 preguntas)
npm run seed
```

### Iniciar el servidor:
```bash
npm run dev
```

El backend estará disponible en: `http://localhost:3001`

---

## Paso 4: Configurar el Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Crear archivo de variables de entorno
cp .env.example .env
```

### Editar el archivo `.env`:
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### Iniciar el servidor de desarrollo:
```bash
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

---

## Paso 5: Crear un usuario de prueba

### Opción A: Usar el formulario de registro
1. Ir a `http://localhost:5173`
2. Click en "Registrarse"
3. Completar el formulario

### Opción B: Crear usuario via API (curl)
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@test.com",
    "password": "123456"
  }'
```

### Opción C: Modo desarrollo (bypass login)
Agregar `?dev=true` a la URL para activar el modo desarrollo:
```
http://localhost:5173?dev=true
```

---

## Comandos Útiles

### Backend
```bash
npm run dev          # Iniciar en modo desarrollo
npm run build        # Compilar TypeScript
npm run start        # Iniciar en producción
npm run seed         # Poblar base de datos
npm test             # Ejecutar tests
npx prisma studio    # Abrir GUI de base de datos
```

### Frontend
```bash
npm run dev          # Iniciar en modo desarrollo
npm run build        # Compilar para producción
npm run preview      # Vista previa de producción
npm test             # Ejecutar tests
```

---

## Troubleshooting

### Error: "Cannot connect to database"
- Verificar que PostgreSQL esté corriendo
- Verificar el `DATABASE_URL` en `.env`
- Probar conexión: `psql -U postgres -d geochallenge`

### Error: "Redis connection refused"
- Verificar que Redis esté corriendo
- Verificar el `REDIS_URL` en `.env`
- Probar conexión: `redis-cli ping`

### Error: "CORS error" en el frontend
- Verificar que el backend esté corriendo en el puerto 3001
- Verificar `VITE_API_URL` en el `.env` del frontend

### Error: "Invalid token" o "Unauthorized"
- Limpiar localStorage: `localStorage.clear()` en la consola del navegador
- Registrar un nuevo usuario

### Las preguntas no aparecen
- Ejecutar `npm run seed` en el backend
- Verificar en Prisma Studio: `npx prisma studio` y revisar la tabla `Question`


### En duelos se hace match pero no cargan preguntas
- Verificar que el frontend escuche eventos `duel:question`, `duel:questionResult` y `duel:finished` (no `game:*`).
- Verificar que al enviar respuesta se envíe `timeRemaining` en `duel:answer`.
- Verificar que ambos clientes emitan `duel:ready` tras el match para iniciar countdown.

---

## Modos de Juego

1. **Un Jugador**: Partida individual con 10 preguntas
2. **Duelo**: Competencia en tiempo real contra otro jugador
3. **Desafío**: Envía un desafío a un amigo para jugar de forma asíncrona

## Categorías

- **Banderas**: Identificar países por su bandera
- **Capitales**: Asociar países con sus capitales
- **Mapas**: Ubicar ciudades/capitales en el mapa mundial
- **Siluetas**: Identificar países por su forma geográfica
- **Mixto**: Combinación de todas las categorías

---

## Tecnologías

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- Socket.IO
- JWT Authentication
- bcrypt

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router v6
- i18next (ES/EN)
- Leaflet (mapas)
- Socket.IO Client
