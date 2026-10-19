# GeoChallenge: mejoras de calidad y experiencia

Fecha: 4 de septiembre de 2026. Código revisado: `831605b`.

La mayor oportunidad es conectar la primera partida con un progreso que el jugador pueda reconocer y continuar. GeoChallenge ya tiene práctica adaptativa, pasaporte, recorrido diario, desafíos y competencia. Hoy esas funciones ofrecen varias entradas, pero el cierre de una partida explica poco sobre lo aprendido y dificulta comenzar la siguiente.

Recomiendo empezar por resultados, navegación y medición; después, probar una primera partida antes del registro y conectar los errores con el pasaporte. La renovación visual reciente sirve como base para estas entregas.

## Diagnóstico y alcance

La revisión incluyó código de frontend y backend, auditorías anteriores, pruebas unitarias, diez casos E2E móviles y un recorrido local con respuestas de API controladas. Se inspeccionaron visualmente inicio, menú, práctica, feedback y resultados. Se verificó también el estado vacío del pasaporte.

Los hallazgos de interfaz describen el build local. No se consultaron cuentas, métricas ni bases de datos de producción. Los datos de las capturas son fixtures de prueba; no representan actividad real. Las propuestas de conversión y retención son hipótesis que requieren medir comportamiento de jugadores.

La base reutilizable incluye `GameRoundScaffold`, `RoundActionTray`, los botones y tokens compartidos, los contratos de respuesta autoritativa del servidor, `MasteryAttempt`, la selección adaptativa y la telemetría existente. El commit revisado ya separa rutas y Leaflet en cargas diferidas; esa mejora no se plantea nuevamente como trabajo pendiente.

## Prioridades

| Orden | Entrega | Resultado esperado | Esfuerzo relativo |
| --- | --- | --- | --- |
| 1 | Resultados y navegación sin interrupciones | La siguiente partida empieza desde el resultado y conserva la configuración | Bajo a medio |
| 2 | Telemetría y consultas del menú | Medir el recorrido completo y reducir solicitudes innecesarias | Bajo a medio |
| 3 | Primera partida antes del registro | El visitante conoce el juego antes de crear una cuenta | Medio |
| 4 | Errores, aprendizaje y pasaporte conectados | Cada sesión muestra avances concretos y propone qué repasar | Medio a alto, por etapas |
| 5 | Competencia con acciones claras | «Revancha» y la espera de rival cumplen una expectativa precisa | Medio; depende del uso real |

El esfuerzo es una comparación de alcance, no una estimación de calendario.

## 1. Terminar una partida debe invitar a continuar

**Observaciones verificadas.** `handlePlayAgain` borra el estado y navega a `/menu`. En práctica aparecen dos botones primarios: «Jugar de nuevo» y «Seguir practicando». El recorrido local reprodujo ambos comportamientos. Los resultados mantienen ranking y compartir por encima de esas acciones incluso en práctica.

Además, `GamePage` llega a resultados sin trasladar categoría y filtros. `ResultsPage` toma `MIXED` como categoría si no recibe el parámetro. Esto afecta la continuidad de las rachas y el contexto usado al compartir.

Fuentes: [acción de repetir](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/ResultsPage.tsx:149), [acciones de práctica](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/ResultsPage.tsx:310), [navegación a resultados](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/GamePage.tsx:417).

**Cambio propuesto.** Un CTA principal por contexto: «Otra partida» en clásico, «Otra racha» en racha y «Seguir practicando» en práctica. Reutilizar la configuración de `GameContext` para conservar modo, categoría, dificultad y filtros. Colocar la acción después del resumen esencial; dejar el desglose y compartir más abajo. En práctica, mostrar avance por países y habilidades antes que posición competitiva.

Hay dos correcciones de navegación que caben en esta entrega:

- El pasaporte con cero sellos muestra un mensaje, pero no ofrece botones ni enlaces. La prueba local encontró cero controles de navegación. Agregar una acción para empezar y un regreso visible reutilizando los componentes existentes. [Estado vacío](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/PassportPage.tsx:111).
- En el menú de 393 px de ancho, la marca se superpone aproximadamente 4,5 px con el bloque de acciones. No genera necesariamente overflow horizontal: requiere comprobar intersección y legibilidad. Limitar el ancho de la marca y llevar «Cerrar sesión» al contexto de cuenta permitiría recuperar espacio. [Header](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/components/organisms/Header.tsx:24).

**Criterios de aceptación.** Repetir inicia una partida con la misma configuración; práctica tiene un único CTA principal; un jugador nuevo puede entrar y salir del pasaporte; marca y controles no se superponen en móvil, ES/EN y ambos temas. Mantener las cuatro alternativas y las safe areas durante el juego.

**Medición.** Porcentaje de partidas terminadas que llevan a una segunda partida en la misma sesión y tiempo entre resultado y siguiente pregunta.

## 2. Medir el recorrido y reducir el trabajo del menú

**Observaciones verificadas.** La telemetría usa la ruta fija `/api/telemetry/events`, mientras el servicio principal usa `VITE_API_URL`. El recorrido local confirmó que ambas llamadas salen a orígenes distintos. Con la arquitectura documentada de GitHub Pages y backend separado, la ruta fija apunta al servidor estático. Falta verificar recepción en producción, pero el desacople de configuración está confirmado.

El menú emite 12 consultas de disponibilidad al abrir un panel: una base, dos por condición geográfica, seis por continente y tres por dificultad. El recorrido local contó las 12. El efecto también depende de los filtros, categoría y panel activo.

Fuentes: [endpoint de telemetría](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/utils/uxTelemetry.ts:24), [configuración de API](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/services/api.ts:45), [consultas de disponibilidad](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/MenuPage.tsx:201).

**Cambio propuesto.** Reutilizar la URL base configurada también en los envíos normales y de cierre de telemetría. Conservar el buffer, la deduplicación y la separación entre eventos del cliente y eventos del servidor. Agregar al contrato existente los eventos mínimos de entrada, registro y repetición: `app_open` hoy se dispara desde el menú autenticado y no describe la llegada de un visitante nuevo.

En disponibilidad, mantener la consulta de la selección actual y ejecutar las sondas de opciones cuando se abra el drawer de filtros. Revisar solicitudes obsoletas y parámetros repetidos. Evaluar un endpoint agregado solo si este cambio resulta insuficiente; no hace falta empezar con otro servicio o sistema de caché.

**Criterios de aceptación.** Un evento real llega al backend desde una URL equivalente a Pages; abrir el panel con filtros cerrados hace una sola consulta de disponibilidad; las opciones del drawer siguen siendo correctas al cambiar selección. Medir los tiempos de carga de pregunta y validación de respuesta con red lenta.

**Medición.** Visita → primera pregunta → primera partida terminada → segunda partida, con eventos del servidor como fuente para inicio y finalización. Separar usuarios nuevos y recurrentes, dispositivo y modo. Para rendimiento web, usar como referencia LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1 en el percentil 75; son objetivos propuestos, no resultados de esta auditoría. [Referencia de Web Vitals](https://web.dev/articles/vitals).

## 3. Mostrar el juego antes de pedir una cuenta

**Observación.** La portada ofrece «Iniciar sesión» y «Registrarse», sin una pregunta o partida accesible. Todas las rutas de juego del frontend requieren usuario. Por eso un visitante debe crear una cuenta antes de comprobar si le gusta jugar.

Hay una base que reduce el alcance: `/game/start` y la validación de respuestas aceptan autenticación opcional. `/game/finish` requiere cuenta y ya contiene lógica para vincular una sesión que comenzó antes del login. La práctica adaptativa requiere historial y no sería la entrada adecuada para un invitado.

Fuentes: [portada](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/HomePage.tsx:44), [rutas protegidas](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/App.tsx:39), [inicio opcionalmente autenticado](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/backend/src/controllers/game.controller.ts:167), [vinculación al guardar](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/backend/src/controllers/game.controller.ts:674).

**Experimento propuesto.** «Probar una partida» inicia cinco preguntas reales y accesibles del flujo clásico, con selección sencilla. Introducir la ayuda al realizar la primera acción. Después del resumen, ofrecer crear cuenta para guardar el avance. El visitante puede volver a jugar sin que un modal lo obligue a registrarse.

La implementación debe resolver explícitamente cómo mostrar el resumen sin llamar al guardado autenticado, conservar la sesión durante registro y reclamarla una sola vez. Reutilizar las sesiones del servidor y su evaluación de respuestas. No incluir respuestas correctas en el payload inicial ni enviar puntuaciones anónimas al ranking.

**Criterios de aceptación.** Un visitante completa el recorrido sin cuenta; quien se registra puede guardar esa sesión sin duplicar progreso; las rutas autenticadas existentes conservan su comportamiento. Una bandera de configuración tendría sentido aquí porque cambia la entrada al producto.

**Medición.** Tiempo hasta la primera respuesta, finalización de la prueba y conversión a cuenta después de jugar. Comparar cohortes; no asumir que más registros equivalen a mejores jugadores retenidos.

## 4. Hacer visible lo aprendido

**Observaciones.** La selección adaptativa ya prioriza bajo dominio y errores recientes, y reduce la repetición de preguntas vistas durante el último día. El pasaporte permite practicar un país. Falta que los resultados comuniquen ese vínculo y muestren el avance de la sesión.

El feedback contextual está incompleto: `generateFunFact` devuelve vacío para banderas y siluetas, y `null` para monumentos. En capitales y mapas produce contexto geográfico general. Mostrar la respuesta correcta resuelve la ronda, pero todavía hay espacio para explicar una confusión concreta.

Fuentes: [selección adaptativa](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/backend/src/services/mastery.service.ts:374), [práctica por país](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/PassportPage.tsx:242), [feedback contextual](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/utils/funFacts.ts:55).

**Cambio propuesto, por etapas.** Primero, añadir al resultado un resumen de países vistos, habilidades mejoradas y errores que conviene repasar, calculado con la información real de la sesión y el dominio existente. Ofrecer práctica dirigida desde ese resumen. Después, añadir explicaciones breves y revisadas a grupos de confusión frecuentes: banderas parecidas, capitales y ubicación de países. Entregar esa información después de responder.

El pasaporte puede ganar una vista geográfica que permita ver dónde se concentra el avance, con la lista accesible como alternativa. Probar primero una vista ligera por regiones y una meta cercana basada en progreso real. Mostrar un porcentaje mundial como única meta deja muy lejos el siguiente hito para quien recién parte.

La comprobación con jugadores debe resolver si el repaso inmediato y las explicaciones ayudan a recordar. No cambiar el algoritmo de dominio ni agregar repetición espaciada formal antes de evaluar el mecanismo actual.

**Criterios de aceptación.** El resumen diferencia lo ya conocido de lo mejorado; el repaso se basa en errores reales; las explicaciones están en ES/EN y no revelan respuestas antes de tiempo; completar una sesión no crea registros duplicados.

**Medición.** Inicio de práctica desde resultados, recuperación de errores en sesiones posteriores y retorno al día siguiente y a los siete días. Evitar premiar una racha por sí sola si no hay señales de aprendizaje o disfrute.

## 5. Precisar la experiencia competitiva

**Observaciones de código.** La búsqueda de duelo admite una espera de hasta 120 segundos. La acción denominada «Revancha» vuelve a la cola general; no solicita jugar contra el mismo rival. El producto ya tiene desafíos asíncronos y recuperación de conexión en duelos, que conviene reutilizar.

Fuentes: [límite de espera](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/DuelPage.tsx:64), [acción de revancha](/Users/felipelorca/Desktop/Proyectos/PERSONAL-PROYECTOS/geochallenge/frontend/src/pages/DuelPage.tsx:807).

**Cambio propuesto.** Si la acción sigue entrando a la cola, llamarla «Buscar otro rival». Una revancha real requiere aceptación de ambos jugadores y es una entrega distinta. Medir la espera por modalidad antes de decidir nuevos emparejamientos; si hay poca concurrencia, dar una salida temprana hacia un desafío asíncrono existente.

**Criterios de aceptación.** Cada etiqueta describe la acción que ejecuta. La salida de la cola cancela la búsqueda. Una futura revancha no conserva respuestas, temporizadores ni estado del duelo anterior.

**Medición.** Tiempo hasta encontrar rival, cancelaciones de búsqueda, duelos terminados y repetición entre los mismos jugadores. No se validó aquí un duelo real entre dos cuentas.

## Plan de entrega

1. **Correcciones comprobables:** repetición y configuración, CTA de práctica, pasaporte vacío, encabezado, URL de telemetría y consultas del menú. PRs pequeños, con regresiones específicas. Los cambios de navegación y presentación son reversibles y no requieren una capa nueva de flags.
2. **Primera sesión:** prueba de cinco preguntas, transición a registro y guardado de esa sesión. Ejecutar como experimento después de verificar la medición.
3. **Aprendizaje visible:** resumen de avance, práctica dirigida, explicaciones revisadas y vista geográfica del pasaporte. Empezar por resultados y usar esa experiencia para decidir el alcance de la vista.
4. **Competencia:** ajustar etiquetas y priorizar el resto según espera y uso real.

Antes de la segunda entrega, observar a un grupo pequeño de personas que nunca haya jugado: empezar una partida, responder una pregunta de mapa, explicar qué cambió al terminar y elegir qué hacer después. Esto valida comprensión; no sustituye una medición de retención.

## Tests y límites de verificación

| Comprobación ejecutada | Resultado |
| --- | --- |
| `npm --prefix frontend run test` | 49 archivos, 297 tests aprobados |
| Backend con Node 20 y `--pool=forks --maxWorkers=2 --minWorkers=1` | 53 archivos, 553 tests aprobados |
| E2E: home, game-layout, game-layout-darkmode y perfect-round-screenshots | 5 casos en Android Medium y 5 en iPhone SE; 10 aprobados |
| Build de frontend usado por Playwright | TypeScript y Vite completados; advertencia de chunks mayores a 500 kB |
| Recorrido local adicional | 12 consultas de disponibilidad, dos CTA primarios de práctica, regreso al menú, superposición de header y pasaporte vacío sin controles |

La suite del backend con el pool de hilos se interrumpió con código 139, tanto en Node 24 como en Node 20. Cambiar solo la ejecución a procesos separados permitió terminarla. Queda pendiente identificar la causa; estos resultados no equivalen a que el comando por defecto haya pasado.

Las capturas de Playwright y los mocks prueban presentación y comportamiento local, no el contrato completo con el backend desplegado. Quedan pendientes red móvil real, dispositivos físicos, lector de pantalla, navegación completa con teclado, contraste medido y una partida multijugador real. No se ejecutó `predeploy`: esta entrega solo agrega documentación y no incluye push.

Mantener el objetivo del repositorio de controles táctiles de al menos 44 px. No confundirlo con el mínimo AA de WCAG 2.2, que establece 24 × 24 CSS px o excepciones de separación; esta revisión no certifica cumplimiento. [Criterio de tamaño de objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Implementación y documentación

Esta entrega registra diagnóstico, prioridades, fuentes y criterios de aceptación. No implementa las propuestas en el juego. Los archivos de aplicación, dependencias, versiones y despliegue permanecen sin cambios.

La evidencia temporal de la inspección está en `/tmp/geochallenge-ux-audit/`: capturas de las pantallas revisadas, textos extraídos, `observations.json` y el script de reproducción con fixtures. No forma parte del producto ni contiene datos de jugadores.

## Riesgos y follow-ups

- El impacto en conversión y retención requiere una línea base de producción. La prioridad propuesta combina problemas reproducidos con hipótesis de producto.
- El flujo invitado debe respetar expiración, pertenencia y guardado único de la sesión. La implementación debe reutilizar los controles actuales del servidor.
- Una vista de pasaporte con mapa puede aumentar peso y complejidad. La primera versión debe preservar la lista y comprobar carga e interacción antes de ampliarse.
- El estado de partida individual vive en memoria del cliente. Evaluar recuperación tras recarga o cierre del navegador como tarea posterior, reutilizando la sesión canónica; la confirmación de salida no resuelve un cierre forzado del sistema.
- Diagnosticar el código 139 del runner por defecto y agregar E2E de contrato real para los recorridos elegidos. Un resultado verde con fixtures no prueba persistencia ni reconexión real.

## Rollback y archivos tocados

Archivo nuevo en el repositorio: `docs/quality-ux-audit-2026-09-04.md`. Archivos existentes modificados: ninguno.

Rollback de esta entrega: eliminar este documento. No cambia el comportamiento del juego. Las implementaciones propuestas deben ir en commits independientes para poder revertir cada entrega; ninguna requiere una migración destructiva como punto de partida.
