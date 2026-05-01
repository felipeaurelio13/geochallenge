# Auditoría técnica de Duelos (2026-05-01)

## Alcance

- Backend Socket.IO de duelos.
- Cliente frontend de conexión, reconexión y estado de duelo.
- Riesgos de estado atascado (`duelo activo`) y percepción de pérdida de conexión.

## Hallazgos críticos

1. **Falso positivo de “duelo activo” después de reconexión breve (race de sockets por usuario).**
   - El backend guarda `playerDuels` por `userId` en memoria.
   - En `disconnect`, siempre termina el duelo si `playerDuels` tiene entrada para ese usuario, sin validar si el socket que se desconecta sigue siendo el socket vigente del jugador.
   - Si el usuario abre/recarga rápido o hay reconexión, un socket viejo puede disparar `disconnect` y cerrar duelo vigente.

2. **Doble flujo de listeners en frontend para eventos de conexión/desconexión.**
   - `SocketService.connect()` registra listeners de `connect/disconnect`.
   - `setupListeners()` vuelve a registrar `connect/disconnect` y además llama `removeAllListeners()`; esto borra también listeners externos registrados por la página.
   - `DuelPage` registra listeners directos sobre `socketService.socket` en paralelo al `SocketService`.
   - Resultado: mayor complejidad de orden de eventos, riesgo de condiciones no deterministas y reintentos duplicados.

3. **No existe “resume/sync state” explícito para duelo en curso tras reconectar.**
   - En reconexión, frontend muestra “syncing” pero no emite una acción de resync (`duel:resume` o equivalente).
   - Depende de que el backend siga emitiendo eventos futuros; si reconecta en ventana silenciosa, UX queda en espera sin recuperación activa.

4. **Estado in-memory no compartido entre instancias backend.**
   - `activeDuels`, `playerDuels`, `processingAnswers`, `readyTimeouts` están en memoria del proceso.
   - En despliegue multi-instancia (o reinicio), se pierde el estado y aparecen inconsistencias (`duelo activo`, cortes, finales abruptos).

## Hallazgos altos

5. **`removeAllListeners()` en socket cliente elimina suscripciones de terceros.**
   - Impacta especialmente a pantallas que agregan listeners directos (`DuelPage`).

6. **Reconexión del cliente limitada a 10 intentos con delay fijo de 1s.**
   - En redes móviles inestables, puede abandonar pronto y dejar la UX en estado ambiguo.

7. **No hay watchdog de duelo zombie para limpiar `playerDuels` huérfanos.**
   - Si algo falla antes de `endDuel` (crash parcial, reinicio), puede quedar mapeo residual percibido como “ya estás en duelo activo”.

## Hallazgos medios

8. **Rate limit por `socketId:event` puede penalizar reconexiones con spam involuntario de reintentos.**
9. **No hay métrica estructurada de ciclo de vida del duelo (join, match, ready, start, finish, disconnect reason).**
10. **No se ve handshake de versión/contrato entre frontend-backend para detectar drift temprano.**

## Hipótesis raíz de tus síntomas

- **“Pierde conexión”**: combinación de red móvil + reconexión no robusta + listeners duplicados + falta de resync explícito.
- **“Ya estás en duelo activo” al intentar duelo nuevo**: mapeo `playerDuels` residual o cierre/estado inconsistente por desconexión de socket viejo y limpieza tardía/no determinista.

## Plan de remediación priorizado (world-class)

### Fase 0 (hotfix, bajo riesgo)

1. Validar en `disconnect` que el socket desconectado sea el socket vigente del jugador en el duelo antes de terminarlo.
2. Evitar `removeAllListeners()` global en cliente; remover sólo listeners propios por nombre.
3. Unificar suscripción de eventos: preferir `socketService.setHandlers()` y evitar listeners directos mezclados.
4. Agregar evento `duel:resume` + respuesta `duel:state` para resync explícito.

### Fase 1 (fiabilidad)

5. Persistir estado mínimo de duelo en Redis (o adapter de Socket.IO + store de sesión de duelo).
6. Añadir TTL/heartbeat por jugador para distinguir desconexión transitoria vs abandono real.
7. Implementar garbage collector de duelos/zombies para limpiar `playerDuels` huérfanos.

### Fase 2 (operación)

8. Telemetría y trazas: `duel_id`, `user_id`, `socket_id`, `event`, `latency_ms`, `disconnect_reason`.
9. Dashboard SLO: match success rate, reconnect recovery rate, duels aborted %, false-active-duel errors.
10. Tests E2E de reconexión y multi-tab.

## Casos de prueba recomendados

1. Usuario A recarga navegador durante `playing` en <2s: no debe perder duelo ni bloquearse.
2. Usuario A abre dos tabs y cierra una: la sesión válida no debe auto-terminar.
3. Reconexión tras 5–20s offline: debe recuperar pregunta/tiempo/score o finalizar con razón consistente.
4. Reinicio de backend en medio de duelo: degradación controlada y limpieza segura.
5. Saturación de eventos `duel:answer`: sin doble respuesta ni deadlocks.

## KPIs objetivo

- Recuperación exitosa tras reconexión > **99%**.
- Error “duelo activo” falso < **0.1%** de intentos de cola.
- Abandono por causa técnica < **0.5%** de duelos.
- MTTR incidentes de duelo < **15 min** con dashboards/alertas.

## Implementación sugerida mínima (primer PR)

- Backend: guard de socket vigente en `disconnect`.
- Frontend: reemplazar listeners directos en `DuelPage` por API de handlers centralizada.
- Backend+Frontend: `duel:resume`/`duel:state` (contrato aditivo).
- Tests: unit + integración de reconexión, y test de tab duplicada.
