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

## 5. Mostrar el desglose de puntos en el feedback de la ronda — ⬜ Pendiente

**Área:** transparencia / `GamePage`, `RoundActionTray`.

**Problema:** al responder solo se muestra `+puntos`. El jugador no sabe cuánto aportó la velocidad, la precisión o la racha, y no puede mejorar su estrategia.

**Propuesta:** añadir una línea compacta con el desglose real que devuelve el servidor (`base`, `velocidad`, `racha`, `precisión`) bajo el resultado, reutilizando las etiquetas existentes.

**Aceptación:** una respuesta correcta muestra el total y sus componentes; una incorrecta no muestra un desglose vacío.

**Entrega:** commit `mejora 5: desglose de puntos en la ronda`.

---

## 6. Anunciar el resultado de la ronda a lectores de pantalla en todos los modos — ⬜ Pendiente

**Área:** accesibilidad / `RoundActionTray`, `AnswerStatusBadge`.

**Problema:** el modo piloto anuncia el resultado con `aria-live`, pero el resto de los modos no. Un usuario de lector de pantalla puede no enterarse de si acertó ni de cuál era la respuesta correcta.

**Propuesta:** envolver el bloque de resultado en una región `role="status"` con `aria-live="polite"` y texto completo (correcto/incorrecto + respuesta). Evitar dobles anuncios cuando el foco ya está en el botón.

**Aceptación:** el resultado se anuncia una vez, en ES y EN, sin interrumpir la navegación por teclado.

**Entrega:** commit `mejora 6: anuncio accesible del resultado`.

---

## 7. Gestionar el foco al revelar el resultado y al pasar de pregunta — ⬜ Pendiente

**Área:** accesibilidad / `GamePage`, `QuestionCard`.

**Problema:** al confirmar, el foco queda en el botón de confirmar (que desaparece) o en una alternativa deshabilitada; al pasar de pregunta, el foco puede quedar en el botón “Siguiente” que ya no existe. Teclado y lectores de pantalla pierden el hilo.

**Propuesta:** enfocar el botón “Siguiente” al revelar el resultado y el encabezado de la pregunta (`tabIndex=-1`) al cargar una pregunta nueva. Respetar `prefers-reduced-motion` y no robar foco si el usuario está escribiendo.

**Aceptación:** el foco sigue un orden predecible en una partida completa solo con teclado.

**Entrega:** commit `mejora 7: foco predecible entre ronda y ronda`.

---

## 8. Hacer descubribles los atajos de teclado — ⬜ Pendiente

**Área:** accesibilidad / `OptionButton`, `GamePage`.

**Problema:** existen atajos 1–4/A–D y Enter, pero solo se descubren por prueba y error. Los botones no declaran `aria-keyshortcuts` y no hay una pista visual en escritorio.

**Propuesta:** añadir `aria-keyshortcuts` a cada alternativa y una pista discreta no intrusiva en la primera ronda (`1–4 o A–D para elegir · Enter para confirmar`), oculta en pantallas táctiles.

**Aceptación:** la pista no consume altura en móvil, no tapa ninguna alternativa y desaparece tras la primera respuesta.

**Entrega:** commit `mejora 8: atajos de teclado descubribles`.

---

## 9. Permitir reintentar el inicio de partida sin salir al menú — ⬜ Pendiente

**Área:** recuperación / `GamePage`.

**Problema:** si falla el arranque (red, sesión o disponibilidad transitoria), la pantalla de error solo ofrece volver. Hay que repetir toda la selección desde el menú.

**Propuesta:** usar `FullScreenError.onRetry` con una función que reinicie la carga y conserve categoría, modo y filtros. Evitar bucles automáticos y mantener el botón de salida.

**Aceptación:** un fallo transitorio se resuelve con “Reintentar” sin perder la configuración; si vuelve a fallar, la pantalla sigue ofreciendo salida.

**Entrega:** commit `mejora 9: reintentar el inicio de partida`.

---

## 10. Mostrar un indicador de racha en partida clásica — ⬜ Pendiente

**Área:** engagement / `GamePage`.

**Problema:** el modo clásico solo muestra la puntuación. La racha de aciertos —que ya se calcula para el desglose y los resultados— no se ve durante la partida, así que el jugador no percibe su momentum.

**Propuesta:** mostrar un badge compacto de racha cuando hay 2 o más aciertos consecutivos, reutilizando `StreakCombo`, sin competir con el temporizador ni con el progreso.

**Aceptación:** el badge aparece desde el segundo acierto, se reinicia al fallar y no aparece en móvil si reduce el espacio de las alternativas.

**Entrega:** commit `mejora 10: indicador de racha en clásico`.

---

## 11. Resumen de precisión por categoría en resultados — ⬜ Pendiente

**Área:** aprendizaje / `ResultsPage`.

**Problema:** al terminar una partida mixta el jugador ve una nota global, pero no qué tipo de pregunta le está costando (banderas, capitales, mapas, siluetas o monumentos). Sin ese dato, la siguiente práctica es a ciegas.

**Propuesta:** calcular la precisión por categoría con las preguntas y resultados reales de la sesión y mostrarla en una sección compacta, solo cuando haya al menos dos categorías y un mínimo de respuestas por categoría.

**Aceptación:** la suma coincide con el total de la partida; no aparece con una sola categoría; el detalle es legible en móvil y con lector de pantalla.

**Entrega:** commit `mejora 11: precisión por categoría en resultados`.

---

## 12. Decir cuánto progreso se pierde al salir de la partida — ⬜ Pendiente

**Área:** claridad / `GamePage`.

**Problema:** el diálogo de salida dice “perderás tu progreso”, pero no cuánto. En una partida larga el jugador no sabe si abandona la ronda 1 o la 9, y decide a ciegas.

**Propuesta:** incluir en el mensaje el número de respuestas ya confirmadas y el total (`Llevas 4 de 10 respuestas`). Reutilizar `useConfirmDialog` y las claves i18n existentes, sin añadir otro diálogo.

**Aceptación:** el mensaje refleja el estado real; con cero respuestas no habla de progreso perdido; sigue funcionando en ES/EN.

**Entrega:** commit `mejora 12: confirmación de salida con progreso concreto`.

---

## 13. Avisar que la pregunta actual es la última — ⬜ Pendiente

**Área:** ritmo / `GamePage`.

**Problema:** el jugador descubre que era la última pregunta recién al ver “Ver resultados”. Ese cambio de expectativa llega tarde y corta la sensación de cierre.

**Propuesta:** mostrar una etiqueta discreta “Última pregunta” junto al contador de ronda cuando `currentIndex` sea el último, sin reemplazar el contador ni el CTA.

**Aceptación:** aparece solo en la última pregunta, en ES/EN, y no altera la altura del header ni la visibilidad de las alternativas en móvil.

**Entrega:** commit `mejora 13: aviso de última pregunta`.

---

## 14. Identificar en el mapa cuál pin es tu respuesta y cuál la correcta — ⬜ Pendiente

**Área:** claridad / `MapInteractive`.

**Problema:** al revelar el resultado aparecen dos pines (azul y verde) y un círculo, pero nada indica cuál es la ubicación elegida y cuál la correcta. El color por sí solo no basta, especialmente con daltonismo.

**Propuesta:** añadir una leyenda breve sobre el mapa con los dos marcadores y sus etiquetas (“Tu respuesta”, “Lugar correcto”), visible solo en el resultado y sin tapar el mapa en móvil.

**Aceptación:** la leyenda no intercepta clics, se lee en ES/EN y no aparece antes de confirmar.

**Entrega:** commit `mejora 14: leyenda de marcadores del mapa`.
