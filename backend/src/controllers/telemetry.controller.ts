import { Router, Response } from 'express';
import { z } from 'zod';
import { optionalAuth, AuthRequest } from '../middleware/auth.js';
import { insertClientEvents } from '../services/telemetry.service.js';

const router = Router();

const MAX_EVENTS_PER_REQUEST = 50;

const clientEventSchema = z.object({
  eventKey: z.string().min(1).max(128),
  name: z.string().min(1).max(64),
  clientSessionId: z.string().min(1).max(128),
  occurredAt: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
});

const batchSchema = z.object({
  events: z.array(clientEventSchema).min(1).max(MAX_EVENTS_PER_REQUEST),
});

const CLIENT_EVENT_WHITELIST = [
  'app_open',
  'mode_selected',
  'game_abandoned',
  'round_timeout',
  'option_mis_tap',
  'offline_practice_started',
  'ui_error',
];

const FORBIDDEN_EVENTS = [
  'game_started',
  'question_answered',
  'mechanic_used',
  'game_finished',
];

router.post('/events', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = batchSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        details: validation.error.errors,
      });
      return;
    }

    const { events } = validation.data;

    for (const e of events) {
      if (FORBIDDEN_EVENTS.includes(e.name)) {
        res.status(400).json({
          error: `Cliente no puede reportar evento server-side: ${e.name}`,
          code: 'TELEMETRY_FORBIDDEN_EVENT',
        });
        return;
      }
      if (!CLIENT_EVENT_WHITELIST.includes(e.name)) {
        res.status(400).json({
          error: `Evento no reconocido: ${e.name}`,
          code: 'TELEMETRY_UNKNOWN_EVENT',
        });
        return;
      }
    }

    // Assign userId from JWT. Ignore any userId sent by client.
    const userId = req.user?.userId;

    const eventsWithUser = events.map((e) => ({
      ...e,
      properties: userId
        ? { ...(e.properties || {}), userId }
        : e.properties,
    }));

    const result = await insertClientEvents(eventsWithUser);

    res.json({ inserted: result.inserted });
  } catch (error) {
    console.error('[telemetry] POST /events error:', error);
    res.status(500).json({ error: 'Error interno', code: 'TELEMETRY_INTERNAL' });
  }
});

export default router;
