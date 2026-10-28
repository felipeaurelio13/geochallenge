# Mejoras — GeoChallenge

Revisión completa del juego (frontend, backend y experiencia de partida) con un ciclo de mejora incremental: una oportunidad por commit, verificada y documentada.

## Criterios de la revisión

- Priorizar lo que el jugador siente en cada ronda: claridad, ritmo, aprendizaje y recuperación ante errores.
- Corregir primero riesgos de integridad (respuestas duplicadas, puntajes inconsistentes, estados perdidos).
- Mantener compatibilidad con contratos HTTP/Socket.IO y con los flujos actuales.
- Cambios pequeños, reversibles y con tests proporcionales.
- Mobile-first, sin overflow, con safe areas y sin degradar las 4 alternativas ni los CTA.

## Leyenda

- ✅ Desarrollada
- ⬜ Pendiente

---

## 1. Evitar respuestas duplicadas por doble disparo del temporizador o de Enter — ✅ Desarrollada

**Área:** integridad de partida / `GamePage`.

**Problema:** el temporizador puede llamar `onComplete` dos veces en el mismo tick (en el intervalo y en el efecto de `timeRemaining <= 0`), y Enter o un doble toque pueden disparar dos envíos antes de que React actualice `isSubmitting`. El backend es idempotente, pero el cliente suma dos veces la respuesta en `results` y en `score`.

**Propuesta:** bloquear el envío con una ref síncrona, liberar el bloqueo solo al pasar de pregunta o al fallar el envío. Mantener `isSubmitting` como estado visual.

**Aceptación:** dos intentos inmediatos producen una sola llamada a `submitAnswer` y el marcador avanza una sola vez.

**Entrega:** commit `mejora 1: evitar respuestas duplicadas`.

---

## 2. Datos curiosos para banderas y siluetas — ✅ Desarrollada

**Área:** aprendizaje / `utils/funFacts.ts`.

**Problema:** `generateFunFact` devuelve `null` para FLAG y SILHOUETTE aunque `questionData` ya contiene el país, así que la ronda de banderas —la más jugada— nunca enseña contexto después de responder.

**Propuesta:** leer el país desde `questionData` cuando la categoría sea FLAG o SILHOUETTE y generar el mismo contexto de región, insularidad y población que ya se usa en capitales y mapas. El dato se muestra solo con el resultado revelado.

**Aceptación:** una bandera de Chile muestra un dato en ES y EN después de responder; nunca antes de confirmar.

**Entrega:** commit `mejora 2: datos curiosos para banderas y siluetas`.

---

## 3. Reintento en línea cuando falla el envío de una respuesta — ✅ Desarrollada

**Área:** resiliencia / `GamePage`.

**Problema:** un corte de red al confirmar reemplaza toda la ronda por una pantalla de error. El jugador pierde la selección, el tiempo y la posibilidad de reintentar sin reiniciar.

**Propuesta:** conservar la pregunta y la selección, pausar el temporizador y mostrar un aviso dentro de la ronda con “Reintentar”. Reutilizar el mismo envío y el bloqueo de la mejora 1.

**Aceptación:** un fallo de red no borra la selección ni la pregunta; “Reintentar” envía la misma respuesta y, si funciona, la partida continúa.

**Entrega:** commit `mejora 3: reintento en línea al fallar el envío`.

---

## 4. Corregir el radio visual de acierto en preguntas de mapa — ✅ Desarrollada

**Área:** justicia percibida / `MapInteractive`.

**Problema:** el backend considera correcta una ubicación a menos de 500 km, pero el círculo verde dibujado sobre el mapa tiene 150 km de radio. El jugador ve “incorrecto” dentro de un área que la interfaz sugiere como válida.

**Propuesta:** derivar el radio del círculo de `GAME_CONSTANTS.MAP_CORRECT_THRESHOLD_KM` para que la representación visual y la regla de puntaje coincidan.

**Aceptación:** el círculo usa 500 km y sigue funcionando en ambos temas y en móvil.

**Entrega:** commit `mejora 4: radio de acierto coherente en el mapa`.

---

## 5. Mostrar el desglose de puntos en el feedback de la ronda — ✅ Desarrollada

**Área:** transparencia / `GamePage`, `RoundActionTray`.

**Problema:** al responder solo se muestra `+puntos`. El jugador no sabe cuánto aportó la velocidad, la precisión o la racha, y no puede mejorar su estrategia.

**Propuesta:** añadir una línea compacta con el desglose real que devuelve el servidor (`base`, `velocidad`, `racha`, `precisión`) bajo el resultado, reutilizando las etiquetas existentes.

**Aceptación:** una respuesta correcta muestra el total y sus componentes; una incorrecta no muestra un desglose vacío.

**Entrega:** commit `mejora 5: desglose de puntos en la ronda`.

---

## 6. Anunciar el resultado de la ronda a lectores de pantalla en todos los modos — ✅ Desarrollada

**Área:** accesibilidad / `RoundActionTray`, `AnswerStatusBadge`.

**Problema:** el modo piloto anuncia el resultado con `aria-live`, pero el resto de los modos no. Un usuario de lector de pantalla puede no enterarse de si acertó ni de cuál era la respuesta correcta.

**Propuesta:** envolver el bloque de resultado en una región `role="status"` con `aria-live="polite"` y texto completo (correcto/incorrecto + respuesta). Evitar dobles anuncios cuando el foco ya está en el botón.

**Aceptación:** el resultado se anuncia una vez, en ES y EN, sin interrumpir la navegación por teclado.

**Entrega:** commit `mejora 6: anuncio accesible del resultado`. Región `role="status"` persistente en `RoundActionTray`, con resultado y respuesta correcta; desactivada en el piloto para no duplicar el anuncio existente.

---

## 7. Gestionar el foco al revelar el resultado y al pasar de pregunta — ✅ Desarrollada

**Área:** accesibilidad / `GamePage`, `QuestionCard`.

**Problema:** al confirmar, el foco queda en el botón de confirmar (que desaparece) o en una alternativa deshabilitada; al pasar de pregunta, el foco puede quedar en el botón “Siguiente” que ya no existe. Teclado y lectores de pantalla pierden el hilo.

**Propuesta:** enfocar el botón “Siguiente” al revelar el resultado y el encabezado de la pregunta (`tabIndex=-1`) al cargar una pregunta nueva. Respetar `prefers-reduced-motion` y no robar foco si el usuario está escribiendo.

**Aceptación:** el foco sigue un orden predecible en una partida completa solo con teclado.

**Entrega:** commit `mejora 7: foco predecible entre ronda y ronda`. El enunciado es enfocable (`tabIndex=-1`) al cargar la pregunta y la acción de continuar recibe el foco al revelar el resultado, sin alterar el orden de tabulación normal.

---

## 8. Hacer descubribles los atajos de teclado — ✅ Desarrollada

**Área:** accesibilidad / `OptionButton`, `GamePage`.

**Problema:** existen atajos 1–4/A–D y Enter, pero solo se descubren por prueba y error. Los botones no declaran `aria-keyshortcuts` y no hay una pista visual en escritorio.

**Propuesta:** añadir `aria-keyshortcuts` a cada alternativa y una pista discreta no intrusiva en la primera ronda (`1–4 o A–D para elegir · Enter para confirmar`), oculta en pantallas táctiles.

**Aceptación:** la pista no consume altura en móvil, no tapa ninguna alternativa y desaparece tras la primera respuesta.

**Entrega:** commit `mejora 8: atajos de teclado descubribles`. Cada alternativa declara `aria-keyshortcuts` solo cuando los atajos están activos y la pista aparece en la primera pregunta únicamente en dispositivos con puntero fino.

---

## 9. Permitir reintentar el inicio de partida sin salir al menú — ✅ Desarrollada

**Área:** recuperación / `GamePage`.

**Problema:** si falla el arranque (red, sesión o disponibilidad transitoria), la pantalla de error solo ofrece volver. Hay que repetir toda la selección desde el menú.

**Propuesta:** usar `FullScreenError.onRetry` con una función que reinicie la carga y conserve categoría, modo y filtros. Evitar bucles automáticos y mantener el botón de salida.

**Aceptación:** un fallo transitorio se resuelve con “Reintentar” sin perder la configuración; si vuelve a fallar, la pantalla sigue ofreciendo salida.

**Entrega:** commit `mejora 9: reintentar el inicio de partida`. `FullScreenError` recibe un reintento explícito que relanza la carga con la misma categoría, modo y filtros, manteniendo la salida al menú.

---

## 10. Mostrar un indicador de racha en partida clásica — ✅ Desarrollada

**Área:** engagement / `GamePage`.

**Problema:** el modo clásico solo muestra la puntuación. La racha de aciertos —que ya se calcula para el desglose y los resultados— no se ve durante la partida, así que el jugador no percibe su momentum.

**Propuesta:** mostrar un badge compacto de racha cuando hay 2 o más aciertos consecutivos, reutilizando `StreakCombo`, sin competir con el temporizador ni con el progreso.

**Aceptación:** el badge aparece desde el segundo acierto, se reinicia al fallar y no aparece en móvil si reduce el espacio de las alternativas.

**Entrega:** commit `mejora 10: indicador de racha en clásico`. El badge reutiliza `StreakCombo`, aparece desde el segundo acierto consecutivo y solo se muestra desde `sm` para no quitar altura a las alternativas en móvil.

---

## 11. Resumen de precisión por categoría en resultados — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** al terminar una partida mixta el jugador ve una nota global, pero no qué tipo de pregunta le está costando (banderas, capitales, mapas, siluetas o monumentos). Sin ese dato, la siguiente práctica es a ciegas.

**Propuesta:** calcular la precisión por categoría con las preguntas y resultados reales de la sesión y mostrarla en una sección compacta, solo cuando haya al menos dos categorías y un mínimo de respuestas por categoría.

**Aceptación:** la suma coincide con el total de la partida; no aparece con una sola categoría; el detalle es legible en móvil y con lector de pantalla.

**Entrega:** commit `mejora 11: precisión por categoría en resultados`. La sección se calcula con las respuestas reales, ordena de menor a mayor precisión y solo aparece cuando hay al menos dos categorías.

---

## 12. Decir cuánto progreso se pierde al salir de la partida — ✅ Desarrollada

**Área:** claridad / `GamePage`.

**Problema:** el diálogo de salida dice “perderás tu progreso”, pero no cuánto. En una partida larga el jugador no sabe si abandona la ronda 1 o la 9, y decide a ciegas.

**Propuesta:** incluir en el mensaje el número de respuestas ya confirmadas y el total (`Llevas 4 de 10 respuestas`). Reutilizar `useConfirmDialog` y las claves i18n existentes, sin añadir otro diálogo.

**Aceptación:** el mensaje refleja el estado real; con cero respuestas no habla de progreso perdido; sigue funcionando en ES/EN.

**Entrega:** commit `mejora 12: confirmación de salida con progreso concreto`. El diálogo muestra respuestas confirmadas y total; con cero respuestas usa un mensaje distinto que no habla de progreso perdido.

---

## 13. Avisar que la pregunta actual es la última — ✅ Desarrollada

**Área:** ritmo / `GamePage`.

**Problema:** el jugador descubre que era la última pregunta recién al ver “Ver resultados”. Ese cambio de expectativa llega tarde y corta la sensación de cierre.

**Propuesta:** mostrar una etiqueta discreta “Última pregunta” junto al contador de ronda cuando `currentIndex` sea el último, sin reemplazar el contador ni el CTA.

**Aceptación:** aparece solo en la última pregunta, en ES/EN, y no altera la altura del header ni la visibilidad de las alternativas en móvil.

**Entrega:** commit `mejora 13: aviso de última pregunta`. La etiqueta se integra en la línea del contador en el piloto y en la fila de progreso en el resto, sin añadir altura ni tocar el CTA.

---

## 14. Identificar en el mapa cuál pin es tu respuesta y cuál la correcta — ✅ Desarrollada

**Área:** claridad / `MapInteractive`.

**Problema:** al revelar el resultado aparecen dos pines (azul y verde) y un círculo, pero nada indica cuál es la ubicación elegida y cuál la correcta. El color por sí solo no basta, especialmente con daltonismo.

**Propuesta:** añadir una leyenda breve sobre el mapa con los dos marcadores y sus etiquetas (“Tu respuesta”, “Lugar correcto”), visible solo en el resultado y sin tapar el mapa en móvil.

**Aceptación:** la leyenda no intercepta clics, se lee en ES/EN y no aparece antes de confirmar.

**Entrega:** commit `mejora 14: leyenda de marcadores del mapa`. La leyenda aparece solo con el resultado y ambos puntos, usa los mismos colores de los pines y no intercepta clics (`pointer-events-none`).

---

## 15. Mostrar el tiempo medio por respuesta en resultados — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** la pantalla final muestra precisión y puntos, pero no si el jugador respondió con calma o contra reloj. Esa información explica por qué perdió el bonus de velocidad y ayuda a ajustar el ritmo.

**Propuesta:** calcular el tiempo medio por respuesta con las respuestas reales de la sesión y el tiempo configurado, y mostrarlo junto a precisión, puntos y mejor racha. No inventar datos si faltan respuestas.

**Aceptación:** el promedio es coherente con la duración configurada; se muestra redondeado y en ES/EN; no aparece en partidas sin respuestas registradas.

**Entrega:** commit `mejora 15: tiempo medio por respuesta en resultados`. El tiempo se registra al confirmar cada respuesta y se resume bajo las métricas; si una sesión antigua no trae tiempos, la línea no se muestra.

---

## 16. Evitar spoilers en el repaso de preguntas falladas — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el repaso de fallos ya existe y es colapsable, pero el resumen de cada fila muestra la respuesta correcta antes de abrirla. El jugador no puede intentar recordarla y el repaso pierde valor como refuerzo.

**Propuesta:** dejar en el resumen solo el número y el enunciado; mostrar la respuesta elegida, la correcta y el contexto dentro del detalle desplegado. Mantener el orden de la partida y el botón de practicar fallos.

**Aceptación:** con la fila cerrada no se lee la respuesta correcta; al abrirla aparece una sola vez junto con la respuesta del jugador; sigue siendo legible en móvil y con lector de pantalla.

**Entrega:** commit `mejora 16: repaso sin spoilers`. El resumen conserva solo el número y el enunciado; la respuesta correcta queda dentro del detalle desplegable, junto al resto de la explicación.

---

## 17. Pausar el temporizador mientras el diálogo de salida está abierto — ✅ Desarrollada

**Área:** justicia / `GamePage`, `Timer`.

**Problema:** al pulsar salir se abre una confirmación, pero el temporizador de la ronda sigue corriendo. Si el jugador duda o cancela, puede encontrarse con menos tiempo —o con la ronda enviada por timeout— solo por haber abierto el diálogo.

**Propuesta:** incluir `isConfirmDialogOpen` en la condición `isActive` del `Timer` y reanudar con el tiempo restante exacto al cerrar el diálogo. No pausar por otros diálogos ni por perder foco de la ventana.

**Aceptación:** el tiempo no baja mientras la confirmación está abierta; al cancelar se reanuda desde el mismo valor; el envío por timeout no se dispara durante la pausa.

**Entrega:** commit `mejora 17: pausa del timer en el diálogo de salida`. El temporizador se detiene mientras la confirmación está abierta y retoma desde el mismo valor al cancelar.

---

## 18. Anunciar el número de pregunta al enfocar el enunciado — ✅ Desarrollada

**Área:** accesibilidad / `QuestionCard`.

**Problema:** desde la mejora 7 el foco llega al enunciado al empezar cada ronda, pero el lector de pantalla solo lee el texto de la pregunta. El contador visual de progreso no se anuncia, así que el jugador no sabe en qué punto de la partida está.

**Propuesta:** incluir dentro del encabezado enfocable un texto `sr-only` con “Pregunta X de Y”, reutilizando la clave `game.questionOf`. Mantener el contador visual sin cambios y evitar duplicarlo en el `aria-label` del contenedor.

**Aceptación:** al enfocar el enunciado se escucha una sola vez el número y el texto de la pregunta, en ES/EN; no cambia la altura ni el layout visible.

**Entrega:** commit `mejora 18: número de pregunta en el enunciado accesible`. El “Pregunta X de Y” vive dentro del `h2` enfocable como texto `sr-only`; el contenedor ya no repite la etiqueta.

---

## 19. Confirmar la salida al usar el botón atrás del navegador — ✅ Desarrollada

**Área:** integridad de partida / `GamePage`.

**Problema:** el botón de salir pide confirmación, pero el botón atrás del navegador abandona la partida en curso sin avisar. El jugador puede perder el progreso por un gesto accidental, sobre todo en móvil.

**Propuesta:** bloquear la navegación fuera de la ruta de juego mientras la partida esté activa y reutilizar el mismo diálogo de confirmación. Permitir salir sin fricción cuando la partida ya terminó o se está en resultados.

**Aceptación:** atrás pide confirmación solo durante una partida activa; cancelar mantiene la ronda y el tiempo; confirmar sale y registra el abandono una sola vez.

**Entrega:** commit `mejora 19: confirmación al abandonar con el botón atrás`. `useBlocker` retiene la navegación durante la partida, reutiliza el diálogo de salida y solo registra el abandono si se confirma; los flujos de fin de partida quedan exentos.

---

## 20. Mostrar la categoría de cada fallo en el repaso — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el repaso de fallos muestra la pregunta y las respuestas, pero no el tipo de pregunta. En una partida mixta cuesta ver si los errores se concentran en banderas, capitales, mapas o siluetas, y la práctica posterior vuelve a ser a ciegas.

**Propuesta:** añadir una etiqueta compacta con la categoría localizada en cada fila del repaso, reutilizando las etiquetas de categoría existentes. Mantenerla fuera del resumen si revela información de la respuesta.

**Aceptación:** cada fallo muestra su categoría en ES/EN, no altera el orden ni el detalle desplegable y no aparece en partidas sin fallos.

**Entrega:** commit `mejora 20: categoría en el repaso de fallos`. La etiqueta se integra en el resumen de cada fila, no revela la respuesta y desaparece cuando no hay fallos.

---

## 21. Incluir el dato curioso en el repaso de fallos — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el repaso muestra la respuesta correcta, pero no el contexto que ya se enseña al responder (región, insularidad, población). El jugador corrige el dato, pero no se lleva el porqué ni un ancla para recordarlo.

**Propuesta:** reutilizar `generateFunFact` con la pregunta y la respuesta correcta de cada fallo y mostrarlo dentro del detalle desplegado, después de la respuesta correcta.

**Aceptación:** cada fallo con dato disponible lo muestra en ES/EN; los fallos sin dato no dejan un hueco vacío; no se revela nada con la fila cerrada.

**Entrega:** commit `mejora 21: dato curioso en el repaso de fallos`. El dato se calcula con la misma utilidad de la ronda y se muestra dentro del detalle, después de la respuesta correcta; si no hay contexto disponible, no deja un hueco.

---

## 22. Llevar el foco al resumen al entrar en resultados — ✅ Desarrollada

**Área:** accesibilidad / `ResultsPage`.

**Problema:** al terminar la partida se navega a resultados, pero el foco se queda en el documento o en el botón que ya no existe. Un usuario de lector de pantalla no recibe confirmación de que la partida terminó ni del resultado obtenido.

**Propuesta:** enfocar el encabezado principal de resultados al montar la pantalla (`tabIndex=-1`), de forma que se anuncie el titular y quede disponible la navegación por secciones. No mover el foco si el usuario ya está interactuando con la página.

**Aceptación:** al entrar se anuncia el titular una vez; el foco sigue un orden lógico hacia las acciones y el repaso; no hay salto visual ni scroll inesperado.

**Entrega:** commit `mejora 22: foco en el resumen de resultados`. El titular recibe foco al montar con `preventScroll` y sin mover el foco si el usuario ya estaba interactuando con la página.

---

## 23. Reflejar el progreso de la ronda en el título de la pestaña — ✅ Desarrollada

**Área:** orientación / `GamePage`.

**Problema:** el título de la pestaña no cambia durante la partida. Si el jugador cambia de pestaña o vuelve al navegador, no puede saber en qué ronda está sin entrar de nuevo al juego.

**Propuesta:** actualizar `document.title` mientras la partida está activa con la pregunta actual y el total; restaurar el título de la app al salir, terminar o desmontar la pantalla.

**Aceptación:** el título muestra “Pregunta X de Y · GeoChallenge” en ES/EN, se actualiza al avanzar, no se queda pegado en resultados y no rompe el título base en otras rutas.

**Entrega:** commit `mejora 23: progreso en el título de la pestaña`. El título se actualiza durante la partida y vuelve al nombre base al terminar, salir o desmontar la pantalla.

---

## 24. Ofrecer jugar la categoría más floja desde resultados — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el desglose por categoría muestra dónde falla el jugador, pero no ofrece una acción directa. Para practicar esa debilidad hay que volver al menú, elegir la categoría y configurar otra partida.

**Propuesta:** añadir un atajo junto al desglose que abra una partida individual con la categoría de menor precisión, reutilizando la ruta y los parámetros existentes. Se descartó la práctica adaptativa porque su contrato actual no filtra por categoría.

**Aceptación:** el atajo solo aparece con al menos dos categorías y una precisión menor al 100%; abre la categoría más floja; funciona en ES/EN y no desplaza las acciones principales.

**Entrega:** commit `mejora 24: practicar la categoría más floja`. La acción reutiliza `category` y `gameType=single`; el resto de filtros no se arrastra para no reabrir una partida demasiado restringida.

---

## 25. Mostrar el tiempo dedicado en cada fallo del repaso — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el repaso ya explica qué falló, pero no cuánto tiempo se dedicó a esa pregunta. Sin ese dato no se distingue un error de conocimiento de uno por apuro o por duda prolongada.

**Propuesta:** mostrar el tiempo registrado junto a cada fallo del repaso, reutilizando el dato de la sesión y el mismo formato localizado del tiempo medio. Si el fallo no tiene tiempo registrado, omitir la etiqueta.

**Aceptación:** cada fallo con tiempo lo muestra dentro del detalle desplegable; no aparece en filas sin dato; no revela la respuesta con la fila cerrada y no altera el orden del repaso.

**Entrega:** commit `mejora 25: tiempo por fallo en el repaso`. El dato se muestra dentro del detalle con el mismo formato localizado del tiempo medio y se omite si la sesión no lo registró.

---

## 26. Expandir o contraer todo el repaso con un solo control — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** cuando hay varios fallos, revisar uno por uno exige abrir cada fila. Para comparar errores o leer el repaso completo, el jugador repite el mismo gesto varias veces.

**Propuesta:** añadir un control compacto que abra o cierre todas las filas del repaso a la vez, con una etiqueta que refleje la acción disponible. Mantener el estado por fila y no reordenar el contenido.

**Aceptación:** el control aparece solo con dos o más fallos; alterna todas las filas; se anuncia en ES/EN; funciona con teclado y no mueve el foco fuera del control al usarlo.

**Entrega:** commit `mejora 26: expandir todo el repaso`. El control aparece con dos o más fallos, alterna todas las filas y mantiene el estado por fila cuando se abre un detalle manualmente.

---

## 27. Identificar el modo y la categoría de la partida en resultados — ✅ Desarrollada

**Área:** orientación / `ResultsPage`.

**Problema:** el resumen final celebra el resultado, pero no recuerda qué partida se acaba de jugar. Si el jugador vuelve más tarde o comparte la pantalla, el contexto depende de la memoria o de las métricas por categoría.

**Propuesta:** añadir una etiqueta breve bajo el titular con el modo y la categoría localizados, reutilizando las etiquetas existentes. Mantenerla fuera del bloque de acciones y sin duplicar la información del repaso.

**Aceptación:** la etiqueta aparece en ES/EN; distingue partida normal, práctica y trial; no se muestra si falta configuración; no añade altura al bloque de acciones ni desplaza el CTA principal.

**Entrega:** commit `mejora 27: contexto de la partida en resultados`. La línea bajo el titular combina modo y categoría localizados y cubre single, práctica, racha y trial.

---

## 28. Mostrar la categoría de la ronda actual en el encabezado — ✅ Desarrollada

**Área:** orientación / `GamePage`.

**Problema:** en una partida mixta el encabezado solo muestra el número de pregunta. El jugador descubre el tipo de desafío al mirar el enunciado, y no puede anticipar si viene un mapa, una bandera o una capital.

**Propuesta:** añadir una etiqueta compacta con la categoría localizada junto al contador de progreso, reutilizando las etiquetas de categoría y sin añadir una fila nueva en móvil.

**Aceptación:** la etiqueta se actualiza al avanzar; se lee en ES/EN; no tapa el temporizador ni el botón de salida; no aparece en modos donde la categoría es sensible o no está definida.

**Entrega:** commit `mejora 28: categoría de la ronda en el encabezado`. La etiqueta se integra en el contador del piloto y en la fila de progreso del resto de modos; las claves de categoría se movieron a `utils/categoryLabels.ts` para reutilizarlas entre juego y resultados.

---

## 29. Repetir solo las preguntas falladas de esta partida — ⬜ Pendiente

**Área:** aprendizaje / `ResultsPage`, práctica.

**Problema:** el repaso identifica los fallos, pero la práctica posterior vuelve a mezclar preguntas del historial. El jugador no puede reforzar exactamente los errores que acaba de cometer.

**Propuesta:** añadir una acción que inicie una práctica con los `questionId` de los fallos de la sesión actual, reutilizando el flujo de práctica y sin alterar el contrato de partidas normales. Si no hay fallos, no mostrar la acción.

**Aceptación:** la práctica contiene solo preguntas falladas de la partida; no duplica preguntas; funciona en ES/EN; conserva el orden del repaso y no afecta el botón principal.

**Entrega:** commit `mejora 29: practicar solo los fallos de la partida`.

---

## 30. Anunciar cuántos fallos hay en el repaso — ✅ Desarrollada

**Área:** accesibilidad / `ResultsPage`.

**Problema:** el título “Llévate estas respuestas” no dice cuántas preguntas fallaron. Un lector de pantalla debe recorrer la lista para descubrir su tamaño, y un vistazo rápido tampoco revela cuánto queda por revisar.

**Propuesta:** incluir el número de fallos en el encabezado del repaso, con una clave i18n que contemple singular y plural, sin alterar el texto descriptivo ni la lista.

**Aceptación:** el encabezado anuncia el total correcto en ES/EN; se actualiza si cambia el número de fallos; no aparece cuando no hay fallos; no duplica el número en cada fila.

**Entrega:** commit `mejora 30: total de fallos en el repaso`. El encabezado suma un contador con formas singular y plural y mantiene el título y la descripción existentes.

---

## 31. Señalar la pregunta más lenta de la partida — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el tiempo medio indica el ritmo global, pero no qué ronda concentró la duda. Una sola pregunta muy lenta puede explicar la pérdida de bonus y no se distingue del resto.

**Propuesta:** identificar la respuesta con mayor tiempo registrado y mostrarla junto al tiempo medio, con el enunciado localizado y los segundos dedicados. Ocultarla cuando no hay tiempos o cuando todas las rondas comparten el mismo valor.

**Aceptación:** la ronda señalada es la de mayor tiempo real; el texto se lee en ES/EN; no revela la respuesta correcta; no aparece en sesiones sin datos de tiempo.

**Entrega:** commit `mejora 31: pregunta más lenta de la partida`. Bajo el tiempo medio aparece el enunciado localizado y los segundos de la ronda con mayor tiempo; se omite sin datos o cuando todas las rondas comparten el mismo valor.

---

## 32. Volver al resumen desde el final de resultados — ✅ Desarrollada

**Área:** navegación / `ResultsPage`.

**Problema:** con varios fallos y el desglose de puntos, la página de resultados se alarga. Después de revisar el final, volver a las acciones principales exige un scroll largo, especialmente en móvil.

**Propuesta:** añadir al final un control “Volver al resumen” que desplace la vista al titular y devuelva el foco a él, respetando `prefers-reduced-motion`. Mantener las acciones principales donde están.

**Aceptación:** el control aparece solo cuando la página tiene contenido suficiente; el foco termina en el titular; el scroll es instantáneo con reducción de movimiento; funciona con teclado y en ES/EN.

**Entrega:** commit `mejora 32: volver al resumen de resultados`. El control aparece solo si el contenedor desborda, desplaza el titular a la vista y le devuelve el foco; con movimiento reducido usa scroll instantáneo.

---

## 33. Llevar el progreso de ronda al título en los demás modos de juego — ✅ Desarrollada

**Área:** orientación / duelos, retos y modos rápidos.

**Problema:** la partida individual ya muestra la ronda en la pestaña, pero duelos, retos diarios y modos rápidos conservan el título genérico. Al cambiar de pestaña, esos modos siguen sin contexto.

**Propuesta:** reutilizar la misma clave `game.tabProgress` y el mismo patrón de restauración en las pantallas de juego restantes, respetando el total propio de cada modo.

**Aceptación:** cada modo activo muestra “Pregunta X de Y · GeoChallenge”; el título se restaura al terminar o salir; no se pisan títulos entre pantallas montadas a la vez; funciona en ES/EN.

**Entrega:** commit `mejora 33: progreso en el título de los demás modos`. Se extrajo `useProgressDocumentTitle` y ahora lo usan partida individual, duelo clásico/GeoRetos y GeoRetos diarios; la limpieza solo restaura el título si nadie más lo cambió. Supervivencia queda fuera porque no conoce el total de rondas hasta el final.

---

## 34. Permitir elegir cualquier categoría del desglose, no solo la más floja — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el atajo actual solo apunta a la categoría con menor precisión. Si el jugador quiere reforzar una categoría concreta —porque le interesa o porque empató con otra— debe volver al menú y configurarla a mano.

**Propuesta:** convertir cada fila del desglose en una acción compacta que abra una partida individual de esa categoría, reutilizando el mismo destino del atajo actual y manteniendo la fila legible en móvil.

**Aceptación:** cada fila permite jugar su categoría; el botón tiene nombre accesible en ES/EN; no tapa el porcentaje; no cambia el orden por precisión; funciona con teclado.

**Entrega:** commit `mejora 34: jugar cualquier categoría del desglose`. Cada fila suma una acción compacta “Jugar” con nombre accesible que incluye la categoría, reutiliza el destino del atajo a la más floja y se oculta en la partida de prueba.

---

## 35. Ordenar el repaso por tiempo dedicado — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el repaso conserva el orden de la partida, pero el tiempo dedicado revela otro patrón: fallos por apuro frente a fallos por duda. Sin una forma de ordenarlos, ese dato queda aislado en cada fila.

**Propuesta:** añadir un control compacto que alterne entre el orden original y el tiempo dedicado de mayor a menor, dejando al final los fallos sin tiempo registrado. Mantener el número original de cada pregunta.

**Aceptación:** el orden original sigue siendo el inicial; el control se anuncia en ES/EN; los fallos sin tiempo no se mezclan con los que sí lo tienen; no se pierde el estado del control al abrir un detalle.

**Entrega:** commit `mejora 35: ordenar el repaso por tiempo`. El repaso alterna entre orden de partida y tiempo descendente con `aria-pressed`; los fallos sin tiempo quedan al final y cada fila conserva su número original.

---

## 36. Anunciar el efecto de expandir o contraer todo el repaso — ✅ Desarrollada

**Área:** accesibilidad / `ResultsPage`.

**Problema:** el control cambia varias filas a la vez, pero un usuario de lector de pantalla no recibe confirmación del cambio: el foco sigue en el botón y no sabe cuántos detalles se abrieron o cerraron.

**Propuesta:** añadir una región `aria-live="polite"` que anuncie la acción realizada y el número de respuestas afectadas, sin mover el foco ni repetir el contenido de los detalles.

**Aceptación:** el anuncio aparece solo tras usar el control; informa la acción y el total; se lee en ES/EN; no se dispara al abrir una fila individual; no altera el layout visible.

**Entrega:** commit `mejora 36: anuncio de expandir todo el repaso`. Una región `role="status"` informa la acción y el número de respuestas; permanece vacía al abrir una fila individual y no mueve el foco.

---

## 37. Incluir la dificultad de la partida en el resumen final — ✅ Desarrollada

**Área:** orientación / `ResultsPage`.

**Problema:** el resumen ya identifica modo y categoría, pero no la dificultad configurada. Un 60% en fácil y un 60% en difícil cuentan historias distintas, y el jugador no puede interpretar el resultado sin recordar la configuración.

**Propuesta:** sumar la dificultad localizada a la línea de contexto cuando exista, reutilizando las etiquetas de dificultad y los parámetros actuales de la partida. Omitirla si no se configuró.

**Aceptación:** la dificultad aparece en ES/EN; no se inventa cuando falta; no desplaza las métricas ni las acciones; se actualiza al repetir la partida con otro nivel.

**Entrega:** commit `mejora 37: dificultad en el resumen final`. La línea de contexto añade la dificultad localizada solo si el parámetro es EASY/MEDIUM/HARD; valores desconocidos se omiten.

---

## 38. Mantener la categoría visible también en la última pregunta — ✅ Desarrollada

**Área:** orientación / `GamePage`.

**Problema:** la categoría de la ronda se oculta en la última pregunta para dejar espacio al aviso “Última pregunta”. El jugador pierde el contexto justo en la ronda decisiva, y el encabezado cambia de contenido sin explicación.

**Propuesta:** reorganizar la línea del contador para mostrar ambos datos sin desbordar en móvil, por ejemplo con la categoría en una línea secundaria compacta o con un formato abreviado que no compita con el aviso.

**Aceptación:** la categoría y “Última pregunta” se ven a la vez en la última ronda; no se corta ni se desborda en 320 px; no aumenta la altura del header en el resto de rondas; funciona en ES/EN.

**Entrega:** commit `mejora 38: categoría en la última pregunta`. El contador conserva la categoría y añade el aviso de última ronda en una segunda línea compacta, solo cuando corresponde.

---

## 39. Incluir la categoría en el anuncio accesible de la pregunta — ✅ Desarrollada

**Área:** accesibilidad / `QuestionCard`.

**Problema:** el encabezado muestra la categoría visualmente, y el enunciado enfocable anuncia “Pregunta X de Y” y el texto, pero no el tipo de pregunta. Un usuario de lector de pantalla no recibe ese contexto.

**Propuesta:** sumar la categoría localizada al texto `sr-only` que ya vive dentro del encabezado enfocable, reutilizando `CATEGORY_LABEL_KEYS`. Mantener el anuncio en una sola pasada y sin duplicarlo en el contenedor.

**Aceptación:** al enfocar el enunciado se escuchan número, categoría y texto; no se altera el layout visible; funciona en ES/EN para todas las categorías, incluida la mixta.

**Entrega:** commit `mejora 39: categoría en el anuncio accesible`. El `sr-only` del `h2` encadena número, categoría y enunciado en una sola lectura, sin cambios visuales.

---

## 40. Incluir la dificultad en el anuncio accesible de la pregunta — ✅ Desarrollada

**Área:** accesibilidad / `QuestionCard`.

**Problema:** la dificultad aparece como badge visual en algunas categorías, pero no forma parte del texto que se anuncia al enfocar el enunciado. Un usuario de lector de pantalla no sabe si la ronda es fácil, media o difícil.

**Propuesta:** añadir la dificultad localizada al `sr-only` del encabezado, solo cuando la pregunta la tenga, reutilizando `game.difficulty.*` y sin duplicar el badge visual.

**Aceptación:** el anuncio incluye la dificultad cuando existe; se omite si falta; no cambia el layout; se lee en ES/EN y no repite la etiqueta visual como texto suelto.

**Entrega:** commit `mejora 40: dificultad en el anuncio accesible`. La dificultad se suma al `sr-only` solo si existe y se mantiene el badge visual sin cambios.

---

## 41. Evitar que la dificultad se anuncie dos veces con lector de pantalla — ✅ Desarrollada

**Área:** accesibilidad / `QuestionCard`.

**Problema:** la dificultad ya se anuncia dentro del encabezado enfocable, pero el badge visual sigue expuesto como texto suelto en el árbol accesible. Al recorrer la tarjeta, un lector de pantalla puede leerla otra vez sin contexto.

**Propuesta:** marcar los badges visuales de dificultad como `aria-hidden="true"` cuando su información ya está incluida en el anuncio del encabezado, sin ocultarlos visualmente ni afectar a las pruebas de layout.

**Aceptación:** la dificultad se escucha una sola vez al enfocar el enunciado; el badge sigue visible; no se oculta ninguna información que no esté ya anunciada; funciona en todas las categorías con badge.

**Entrega:** commit `mejora 41: badge de dificultad sin duplicado accesible`. Los badges visuales quedan `aria-hidden`; la dificultad sigue disponible en el anuncio del encabezado.

---

## 42. Mostrar una pista visible de los controles del mapa — ✅ Desarrollada

**Área:** accesibilidad / `MapInteractive`.

**Problema:** el mapa se puede mover con flechas, hacer zoom con `+`/`-` y marcar con Enter, pero esas instrucciones solo existen para lectores de pantalla. Un usuario vidente que llega con teclado no descubre los controles y depende del ratón.

**Propuesta:** mostrar una pista compacta y descartable sobre o bajo el mapa en la primera pregunta de mapa, reutilizando `map.keyboardInstructions` y ocultándola cuando el resultado ya está visible.

**Aceptación:** la pista no tapa el mapa ni el crosshair; no aparece en preguntas que no son de mapa; se puede cerrar o ignora en móvil táctil; se lee en ES/EN; no intercepta clics.

**Entrega:** commit `mejora 42: pista visible de controles del mapa`. La partida individual muestra la pista sobre el mapa en su primera ronda de mapa, con botón de cierre y sin solaparlo; se oculta al mostrar el resultado.

---

## 43. Filtrar el repaso por categoría — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** en una partida mixta con varios fallos, el repaso mezcla banderas, capitales, mapas y siluetas. Aunque cada fila ya muestra su categoría, no se puede aislar un tipo de error para concentrarse en él.

**Propuesta:** añadir filtros compactos por categoría sobre la lista de fallos, derivados de las categorías presentes. Mantener “Todos” como estado inicial y no cambiar el orden interno de cada grupo.

**Aceptación:** los filtros solo muestran categorías con fallos; el contador del encabezado refleja el filtro activo; no se pierde el estado de expansión; funciona con teclado y en ES/EN; no aparece con una sola categoría.

**Entrega:** commit `mejora 43: filtros de categoría en el repaso`. Los filtros derivan de las categorías con fallos, usan `aria-pressed`, actualizan el contador y ocultan filas sin desmontarlas para conservar su estado de expansión.

---

## 44. Resumir el tiempo total dedicado a la partida — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el tiempo medio y la ronda más lenta describen el ritmo, pero no cuánto duró realmente la partida. Un jugador que quiere comparar sesiones o controlar su ritmo no tiene una cifra total a la vista.

**Propuesta:** sumar los tiempos registrados y mostrar el total junto a las métricas de tiempo, en formato compacto de minutos y segundos. Ocultarlo cuando no haya tiempos y no duplicar la información del repaso.

**Aceptación:** el total es la suma de los tiempos finitos registrados; se lee en ES/EN; se omite sin datos; no desplaza el CTA principal ni el desglose de puntos; no cambia el repaso.

**Entrega:** commit `mejora 44: tiempo total de la partida`. La suma de tiempos se muestra bajo la ronda más lenta en formato “X min Y s” o “X s”; se omite sin datos y reutiliza los tiempos ya filtrados.

---

## 45. Nombrar el landmark de resultados con el titular localizado — ✅ Desarrollada

**Área:** accesibilidad / `ResultsPage`.

**Problema:** el `<main>` de resultados usa `aria-label="results-summary"`, un texto fijo en inglés que no cambia con el idioma. Un lector de pantalla anuncia una etiqueta distinta al resto de la interfaz y no coincide con el titular visible.

**Propuesta:** quitar la etiqueta fija y asociar el landmark con el `h1` existente mediante `aria-labelledby`, reutilizando el texto ya localizado y sin añadir una nueva clave de traducción.

**Aceptación:** el nombre accesible del `main` coincide con el titular visible en ES/EN; no se anuncia dos veces; no hay cambios visuales; los tests siguen usando el titular como referencia.

**Entrega:** commit `mejora 45: landmark de resultados con titular localizado`. El `main` usa `aria-labelledby` hacia el `h1`, que ahora tiene id; se eliminó la etiqueta fija en inglés y no se añadieron claves nuevas.

---

## 46. Mostrar la ronda de supervivencia en la pestaña sin inventar el total — ✅ Desarrollada

**Área:** orientación / `SurvivalPage`.

**Problema:** supervivencia no conoce el total de rondas hasta que termina la partida, así que quedó fuera del título de progreso. Al cambiar de pestaña, el modo activo sigue mostrando el título genérico aunque la ronda sí se conoce.

**Propuesta:** añadir una clave compacta tipo “Ronda {{current}} · GeoChallenge” y usarla solo mientras el modo está jugando, sin fabricar un total. Restaurar el título al salir y mantener `game.tabProgress` para los modos que sí conocen el total.

**Aceptación:** el título muestra la ronda actual durante la partida; no aparece “de 0” ni un total inventado; se restaura al terminar o salir; funciona en ES/EN; no altera los títulos de los demás modos.

**Entrega:** commit `mejora 46: ronda actual en el título de supervivencia`. El hook acepta un total opcional y usa `game.tabRound` cuando no existe; supervivencia muestra “Ronda X · GeoChallenge” durante la partida y restaura el título al salir.

---

## 47. Copiar el repaso de fallos como texto de estudio — ✅ Desarrollada

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el repaso es interactivo y se pierde al salir de la página. Un jugador que quiere repasar sin conexión o llevar sus fallos a notas debe transcribirlos a mano, uno por uno.

**Propuesta:** añadir una acción secundaria en el repaso que copie un texto plano con categoría, enunciado, respuesta del jugador y respuesta correcta de cada fallo. Mostrar confirmación inline con `aria-live` y reutilizar el patrón de copiado existente.

**Aceptación:** el texto respeta el idioma activo; incluye todos los fallos visibles; no se ofrece sin fallos; el botón no tapa el contador ni el control de expandir; funciona con teclado y en móvil.

**Entrega:** commit `mejora 47: copiar el repaso de fallos`. El botón copia solo las filas visibles con categoría, enunciado, respuesta del jugador y respuesta correcta; muestra confirmación o error inline y limpia el aviso a los 3 s.

---

## 48. Anunciar el nuevo orden del repaso al cambiarlo — ⬜ Pendiente

**Área:** accesibilidad / `ResultsPage`.

**Problema:** el control de orden cambia la lista y expone `aria-pressed`, pero un usuario de lector de pantalla no recibe confirmación de que las filas se reordenaron ni bajo qué criterio. El foco sigue en el botón y el cambio puede pasar inadvertido.

**Propuesta:** añadir una región `aria-live="polite"` que anuncie “Repaso ordenado por tiempo” o “Repaso en orden de partida” al alternar, sin mover el foco ni repetir el anuncio al abrir detalles.

**Aceptación:** el anuncio solo ocurre tras una acción del usuario; se lee en ES/EN; no duplica el nombre del botón; no interfiere con `aria-pressed`; no aparece en el DOM inicial si no se ha cambiado el orden.

**Entrega:** commit `mejora 48: anuncio del orden del repaso`.

---

## 49. Mostrar la dificultad de cada fallo en el repaso — ⬜ Pendiente

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el repaso identifica la categoría de cada fallo, pero no su dificultad. Un fallo en una pregunta difícil y otro en una fácil se leen igual, aunque exigen estrategias distintas.

**Propuesta:** añadir al resumen de cada fila un badge compacto con la dificultad cuando la pregunta la traiga, reutilizando `game.difficulty.*` y el estilo de los badges existentes. Ocultarlo si falta el dato.

**Aceptación:** el badge solo aparece cuando existe dificultad; no duplica el texto del enunciado; el resumen sigue siendo legible en móvil; se lee en ES/EN; no altera el orden ni el contador del repaso.

**Entrega:** commit `mejora 49: dificultad por fallo en el repaso`.

---

## 50. Conservar los filtros al practicar una categoría desde resultados — ⬜ Pendiente

**Área:** continuidad / `ResultsPage`.

**Problema:** el atajo a una categoría del desglose construye el destino solo con categoría y modo. Si la partida era de Europa en difícil, la práctica pierde esos filtros y cambia las condiciones sin avisar.

**Propuesta:** reutilizar los parámetros de configuración que ya conserva “Jugar de nuevo” (`continent`, `difficulty`, `isInsular`, `isLandlocked`, `countryCode`) al abrir la práctica de una categoría, manteniendo la categoría elegida como reemplazo de la anterior.

**Aceptación:** la práctica conserva los filtros compatibles presentes en la URL; no arrastra la categoría anterior; sigue funcionando sin filtros; no cambia el destino de “Jugar de nuevo”; se cubre con tests.

**Entrega:** commit `mejora 50: filtros al practicar una categoría`.

---

## 51. Incluir la duración en el texto de compartir resultados — ⬜ Pendiente

**Área:** compartir / `ResultsPage`.

**Problema:** el texto compartido resume puntos, aciertos y precisión, pero no cuánto duró la partida. Quien compara un resultado rápido con uno pausado pierde ese contexto fuera de la app.

**Propuesta:** añadir la duración total al `shareText` cuando la sesión tenga tiempos registrados, reutilizando el formato compacto del resumen. Mantener el texto actual si no hay datos para no inventar una duración.

**Aceptación:** el texto incluye la duración solo con tiempos válidos; se lee en ES/EN; no duplica la duración si ya estuviera presente; no cambia el texto cuando no hay datos; los tests de compartir cubren ambos casos.

**Entrega:** commit `mejora 51: duración en el texto de compartir`.

---

## 52. Reservar espacio para el ranking mientras carga — ⬜ Pendiente

**Área:** estabilidad visual / `ResultsPage`.

**Problema:** al final de resultados, la fila de ranking aparece después de una petición asíncrona. Mientras carga solo se ve un spinner pequeño y, al llegar el dato, el bloque cambia de altura y puede empujar el contenido en móvil.

**Propuesta:** reservar una altura mínima estable para la fila de ranking y mostrar el spinner dentro de ese espacio. Si la petición falla o no hay ranking, mantener la altura sin dejar un hueco visible.

**Aceptación:** el bloque no cambia de altura entre cargando, con ranking y sin ranking; el spinner sigue siendo perceptible; no afecta a los modos que no piden ranking; se cubre con un test de estructura.

**Entrega:** commit `mejora 52: espacio estable para el ranking`.

---

## 53. Incluir el número de pregunta en la ronda más lenta — ⬜ Pendiente

**Área:** aprendizaje / `ResultsPage`.

**Problema:** la línea de la ronda más lenta muestra el enunciado y los segundos, pero no su posición en la partida. Si dos preguntas comparten un enunciado parecido o el texto es largo, no queda claro a qué ronda volver en el repaso.

**Propuesta:** añadir el número original de la pregunta al texto de la ronda más lenta, reutilizando el índice que ya calcula el repaso. Mantener el resto del formato y las mismas condiciones de ocultado.

**Aceptación:** el número coincide con la posición real de la ronda; el texto sigue sin revelar la respuesta correcta; se lee en ES/EN; no cambia cuando la ronda más lenta no se muestra; no afecta al repaso.

**Entrega:** commit `mejora 53: número de la ronda más lenta`.

---

## 54. Llevar la pista de controles del mapa a duelos y retos — ⬜ Pendiente

**Área:** accesibilidad / `DuelPage`, `GeoChallengesPage`, `SurvivalPage`.

**Problema:** la pista visible de controles del mapa solo se activa en la partida individual. En duelos, GeoRetos y supervivencia el mapa sigue dependiendo de instrucciones solo accesibles o del descubrimiento casual del teclado.

**Propuesta:** reutilizar `showKeyboardHint` en las demás pantallas con mapa, mostrándola en la primera ronda de mapa de cada partida y descartándola tras el primer uso o cierre. Mantener el comportamiento táctil sin cambios.

**Aceptación:** la pista aparece una sola vez por partida con mapa; no se muestra en rondas sin mapa ni tras el resultado; no tapa el mapa; se puede cerrar con teclado; funciona en ES/EN en los tres modos.

**Entrega:** commit `mejora 54: pista del mapa en duelos y retos`.

---

## 55. Mostrar el número de fallos en cada filtro de categoría — ⬜ Pendiente

**Área:** aprendizaje / `ResultsPage`.

**Problema:** los filtros del repaso muestran solo el nombre de la categoría. Antes de elegir uno, el jugador no sabe si va a ver un fallo o cinco, y “Todos” tampoco anticipa el total.

**Propuesta:** añadir el conteo entre paréntesis a cada filtro, derivado de la misma lista de fallos, incluyendo “Todos”. Mantener el nombre accesible completo y el estado `aria-pressed`.

**Aceptación:** cada conteo coincide con las filas de esa categoría; “Todos” suma el total; el texto se lee en ES/EN; no cambia el layout de forma abrupta; no aparecen filtros sin fallos.

**Entrega:** commit `mejora 55: conteo en los filtros del repaso`.

---

## 56. Incluir el dato curioso en el repaso copiado — ⬜ Pendiente

**Área:** aprendizaje / `ResultsPage`.

**Problema:** el texto copiado resume pregunta, respuesta del jugador y respuesta correcta, pero deja fuera el dato curioso que la interfaz ya muestra. Quien estudia fuera de la app pierde el contexto que ayuda a recordar el país.

**Propuesta:** añadir el dato curioso al bloque de cada fallo cuando exista, reutilizando `generateFunFact` y la etiqueta ya localizada. Mantener el formato plano y omitirlo cuando no haya dato.

**Aceptación:** el dato copiado coincide con el visible; solo aparece cuando existe; no duplica la respuesta correcta; se lee en ES/EN; no cambia el texto cuando no hay dato; el copiado sigue respetando el filtro activo.

**Entrega:** commit `mejora 56: dato curioso en el repaso copiado`.
