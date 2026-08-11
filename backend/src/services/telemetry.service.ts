import { prisma } from '../config/database.js';
import { TelemetrySource, GameMode, GameVariant, Category, Prisma } from '@prisma/client';

const CLIENT_EVENT_NAMES = [
  'app_open',
  'mode_selected',
  'game_abandoned',
  'round_timeout',
  'option_mis_tap',
  'offline_practice_started',
  'ui_error',
] as const;

type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

const SERVER_EVENT_NAMES = [
  'game_started',
  'question_answered',
  'mechanic_used',
  'game_finished',
] as const;

type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];

function isServerEvent(name: string): name is ServerEventName {
  return (SERVER_EVENT_NAMES as readonly string[]).includes(name);
}

function isClientEvent(name: string): name is ClientEventName {
  return (CLIENT_EVENT_NAMES as readonly string[]).includes(name);
}

const VALID_GAME_MODES = new Set<string>(Object.values(GameMode));
const VALID_VARIANTS = new Set<string>(Object.values(GameVariant));
const VALID_CATEGORIES = new Set<string>(Object.values(Category));

function parseEnum<T extends string>(value: unknown, valid: Set<string>): T | undefined {
  if (typeof value !== 'string') return undefined;
  return valid.has(value) ? (value as T) : undefined;
}

interface ServerEventParams {
  name: ServerEventName;
  userId?: string | null;
  runId?: string;
  questionId?: string;
  gameMode?: GameMode;
  variant?: GameVariant;
  category?: Category;
  properties?: Record<string, unknown>;
}

interface ClientEventInput {
  eventKey: string;
  name: ClientEventName;
  clientSessionId: string;
  occurredAt: string;
  properties?: Record<string, unknown>;
}

interface InsertClientEventsOptions {
  userId: string | null;
}

export function distanceBucket(distanceKm?: number): string | undefined {
  if (distanceKm === undefined || distanceKm === null) return undefined;
  if (distanceKm < 100) return '<100km';
  if (distanceKm < 500) return '100-500km';
  if (distanceKm < 1000) return '500-1000km';
  if (distanceKm < 2000) return '1000-2000km';
  return '>2000km';
}

function sanitizeProperties(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const forbidden = new Set([
    'email', 'username', 'token', 'jwt', 'answer', 'correctAnswer',
    'userAnswer', 'userLat', 'userLng', 'lat', 'lng',
    'correctLocation', 'coordinates', 'password',
  ]);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();
    if (forbidden.has(key) || forbidden.has(lower)) continue;
    sanitized[key] = value;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function trackServerEvent(params: ServerEventParams): void {
  try {
    const {
      name,
      userId,
      runId,
      questionId,
      gameMode,
      variant,
      category,
      properties: rawProperties,
    } = params;

    if (!isServerEvent(name)) {
      return;
    }

    const occurredAt = new Date();
    let eventKey: string;

    const userSegment = userId || 'anon';

    if (runId) {
      switch (name) {
        case 'game_started':
          eventKey = `server:${runId}:started:${userSegment}`;
          break;
        case 'game_finished':
          eventKey = `server:${runId}:finished:${userSegment}`;
          break;
        case 'question_answered':
          eventKey = questionId
            ? `server:${runId}:answer:${questionId}:${userSegment}`
            : `server:${runId}:answer:${userSegment}`;
          break;
        case 'mechanic_used':
          eventKey = questionId
            ? `server:${runId}:mechanic:${questionId}:${JSON.stringify(rawProperties?.mechanic)}:${userSegment}`
            : `server:${runId}:mechanic:${userSegment}`;
          break;
        default:
          eventKey = `server:${runId}:${name}:${userSegment}`;
      }
    } else {
      eventKey = `server:${name}:${userSegment}:${occurredAt.getTime()}`;
    }

    const properties = sanitizeProperties(rawProperties);

    void prisma.telemetryEvent
      .create({
        data: {
          eventKey,
          name,
          source: TelemetrySource.SERVER,
          userId: userId || null,
          runId: runId || null,
          gameResultId: null,
          gameMode: gameMode || null,
          variant: variant || null,
          category: category || null,
          questionId: questionId || null,
          properties: properties ? (properties as Prisma.InputJsonValue) : Prisma.JsonNull,
          occurredAt,
        },
      })
      .catch((err) => {
        if ((err as { code?: string }).code === 'P2002') return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('[telemetry] Failed to persist server event:', message);
      });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[telemetry] Unexpected error:', message);
  }
}

export function trackServerEventSync(params: ServerEventParams): void {
  trackServerEvent(params);
}

export async function insertClientEvents(
  events: ClientEventInput[],
  opts: InsertClientEventsOptions,
): Promise<{ inserted: number }> {
  const { userId } = opts;

  const validEvents: Array<{
    eventKey: string;
    name: string;
    source: TelemetrySource;
    userId: string | null;
    clientSessionId: string;
    occurredAt: Date;
    gameMode: GameMode | null;
    variant: GameVariant | null;
    category: Category | null;
    properties: Record<string, unknown> | undefined;
  }> = [];

  for (const e of events) {
    if (!isClientEvent(e.name)) {
      console.warn(`[telemetry] Rejected non-client event from client: ${e.name}`);
      continue;
    }

    const props = sanitizeProperties(e.properties);
    const gameMode = parseEnum<GameMode>(props?.gameMode, VALID_GAME_MODES) ?? null;
    const variant = parseEnum<GameVariant>(props?.variant, VALID_VARIANTS) ?? null;
    const category = parseEnum<Category>(props?.category, VALID_CATEGORIES) ?? null;

    // Strip userId from properties — never trust client-provided userId.
    if (props?.userId) {
      delete props.userId;
    }

    validEvents.push({
      eventKey: e.eventKey,
      name: e.name,
      source: TelemetrySource.CLIENT,
      userId,
      clientSessionId: e.clientSessionId,
      occurredAt: new Date(e.occurredAt),
      gameMode,
      variant,
      category,
      properties: Object.keys(props || {}).length > 0 ? props : undefined,
    });
  }

  if (validEvents.length === 0) return { inserted: 0 };

  const result = await prisma.telemetryEvent.createMany({
    data: validEvents.map((e) => ({
      eventKey: e.eventKey,
      name: e.name,
      source: e.source,
      userId: e.userId,
      clientSessionId: e.clientSessionId,
      occurredAt: e.occurredAt,
      gameMode: e.gameMode,
      variant: e.variant,
      category: e.category,
      properties: e.properties ? (e.properties as Prisma.InputJsonValue) : Prisma.JsonNull,
    })),
    skipDuplicates: true,
  });

  return { inserted: result.count };
}
