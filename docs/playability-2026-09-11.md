# Primera partida, repaso y repetición

GeoChallenge permite probar cinco preguntas reales sin cuenta y empezar otra partida desde el resultado. El despliegue usa el workflow de GitHub Pages al publicar el commit en `master`.

## Diagnóstico y plan

La portada exigía entrar o registrarse antes de jugar. En resultados, «Jugar de nuevo» llevaba al menú, la práctica mostraba dos botones principales y categoría y filtros se perdían al cerrar la partida. El pasaporte vacío tampoco ofrecía una salida jugable.

La entrega conecta entrada, partida, resultado y repetición. Reutiliza las sesiones y la corrección del servidor, `GameProvider`, `GamePage`, los componentes de ronda, la práctica adaptativa y la telemetría existentes. No agrega tablas, servicios, dependencias ni contratos de backend. No modifica versiones ni configuración de despliegue.

## Implementación

- **Prueba sin cuenta:** `/play` inicia cinco preguntas de banderas con dificultad fácil. La corrección usa `/game/answer`; las soluciones no se agregan al payload inicial. `/play/results` muestra los resultados ya corregidos sin llamar a `/game/finish` ni consultar el ranking privado. Se puede repetir sin registrarse. Las visitas con sesión iniciada van al menú; si faltan preguntas, la prueba muestra un error y no reduce el total anunciado.
- **Cierre de partida:** resultado, objetivo cercano y mejor racha de la sesión preceden a una única acción principal. Repetir conserva categoría, modalidad, continente, dificultad, filtros de países y el país de una práctica dirigida. Los filtros viajan en la URL; no se introduce otro estado persistente.
- **Repaso:** las preguntas falladas muestran la solución del servidor. Al expandirlas aparecen la imagen disponible y la respuesta elegida, o la distancia en preguntas de mapa. El acceso a práctica usa el historial existente; no promete repetir exactamente las preguntas falladas ni atribuye mejoras de dominio que no se han medido.
- **Navegación:** el pasaporte incluye regreso al menú y una acción para empezar cuando está vacío. El encabezado limita la marca al espacio disponible. La prueba usa el viewport de juego sin footer global. Un ajuste de un píxel en la grilla compartida evita el recorte del borde de la cuarta alternativa por redondeo de alturas en el iPhone SE, tanto en prueba como en partidas con cuenta. Se conserva el componente de ronda existente.
- **Menú y medición:** las consultas para habilitar alternativas de filtros se ejecutan al abrir el drawer. La telemetría usa `VITE_API_URL`, como el cliente de API, en lugar del origen del frontend estático. Repetir registra `mode_selected` con `source: results`.

## Operación y rollback

`VITE_GUEST_TRIAL_ENABLED` está activado por defecto. Para retirar únicamente la entrada sin cuenta, establecerlo en `false` y reconstruir el frontend: desaparece el CTA y ambas rutas de prueba redirigen al inicio. Se reutiliza el sistema de feature flags porque esta entrega cambia la entrada pública al juego. Las mejoras de navegación y resultados no requieren un flag adicional.

Las partidas de prueba no se guardan al crear una cuenta; la interfaz lo informa expresamente. El pasaporte y el ranking empiezan a recibir las siguientes partidas autenticadas. La sesión temporal conserva la expiración y los controles del servidor existente.

Para revertir la entrega completa, revertir su diff en los archivos enumerados abajo. Se recuperan la portada de acceso, los resultados anteriores y la navegación previa. No hay migraciones que revertir. El documento preexistente `docs/quality-ux-audit-2026-09-04.md` no pertenece a esta entrega.

## Validación

- Suite completa de frontend: 50 archivos y 308 tests aprobados.
- ESLint: cero errores; conserva advertencias de estilo del repositorio.
- Pruebas añadidas o ajustadas: rutas de invitado, bloqueo para usuarios autenticados, cinco preguntas sin reducción automática, guardado de partidas normales, repetición con filtros, repaso de respuestas y telemetría hacia el backend configurado.
- Se corrigió una carrera en el test de competencia: ahora espera la posición cargada antes de comprobar la calibración. La lógica de esa página no cambió.
- Revisión delegada a agentes `gpt-5.6-luna`: telemetría y casos borde del recorrido. Sus hallazgos se corrigieron y se integraron con la validación principal.
- Revisión de textos ES/EN con el comprobador de `felipe-writing`: sin hallazgos determinísticos.

- Playwright: 28 casos aprobados en iPhone SE/WebKit y Android/Chromium. Cubre portada, cinco preguntas, repaso, repetición, bloqueo para usuarios autenticados, guardado con filtros, pasaporte vacío, consultas del drawer, transición a mapa, feedback diario y capturas de ronda. La prueba inicial se valida en ES/EN y temas claro/oscuro; los CTA y la cuarta alternativa deben quedar completamente visibles.

- `npm run predeploy`: aprobado con `✓ predeploy: builds limpios`. Incluye TypeScript, build de Vite y la suite completa de frontend. El build mantiene la advertencia de chunks mayores a 500 kB y el aviso de actualización de Browserslist.

Las pruebas de navegador usan fixtures controladas sin `correctAnswer` en las preguntas iniciales. No prueban persistencia contra una base real. El backend local no estaba disponible en `localhost:3001`; no se alteró ni consultó la base de producción.

## Riesgos y siguientes comprobaciones

El efecto en ganas de repetir y retorno requiere observar jugadores y medir uso real. No hay evidencia suficiente para afirmar que el juego será un éxito comercial. La prueba inicial cubre banderas; los demás modos conservan sus reglas.

Quedan fuera de esta entrega el guardado retroactivo de la prueba después del registro, la recuperación de una partida al recargar, una revancha entre los mismos rivales y nuevas explicaciones geográficas editoriales. Los resultados de prueba no generan `game_finished` del servidor porque no pasan por el endpoint de guardado; no usar ese evento para medir su tasa de finalización sin distinguir estas sesiones.

## Archivos

Modificados:

- `frontend/src/App.tsx`
- `frontend/src/__tests__/app-routing.test.tsx`
- `frontend/src/__tests__/competition-page.test.tsx`
- `frontend/src/__tests__/game-page-streak.test.tsx`
- `frontend/src/__tests__/game-page.test.tsx`
- `frontend/src/__tests__/home-page.test.tsx`
- `frontend/src/__tests__/passport-page.test.tsx`
- `frontend/src/__tests__/results-page.test.tsx`
- `frontend/src/components/Screen.tsx`
- `frontend/src/components/organisms/Header.tsx`
- `frontend/src/config/featureFlags.ts`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/es.json`
- `frontend/src/index.css`
- `frontend/src/pages/GamePage.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/MenuPage.tsx`
- `frontend/src/pages/PassportPage.tsx`
- `frontend/src/pages/ResultsPage.tsx`
- `frontend/src/utils/uxTelemetry.ts`

Nuevos:

- `docs/playability-2026-09-11.md`
- `frontend/src/__tests__/ux-telemetry.test.ts`
- `frontend/tests/e2e/play-again.spec.ts`
