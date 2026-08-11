import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/database.js', () => ({
  prisma: {
    telemetryEvent: {
      create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

import { prisma } from '../config/database.js';
import { trackServerEvent, insertClientEvents } from '../services/telemetry.service.js';
import * as telemetryModule from '../services/telemetry.service.js';
import { TelemetrySource, GameMode, GameVariant } from '@prisma/client';

function mc() { return prisma.telemetryEvent.create as ReturnType<typeof vi.fn>; }
function mcm() { return prisma.telemetryEvent.createMany as ReturnType<typeof vi.fn>; }

beforeEach(() => {
  vi.clearAllMocks();
  (mc() as any).mockReturnValue(Promise.resolve({ id: 'evt-1' }));
  (mcm() as any).mockReturnValue(Promise.resolve({ count: 1 }));
});

describe('trackServerEvent', () => {
  it('emits game_started with deterministic eventKey', () => {
    trackServerEvent({
      name: 'game_started',
      userId: 'user-1',
      runId: 'run-1',
      gameMode: GameMode.SINGLE,
      variant: GameVariant.CLASSIC,
    });

    expect(mc()).toHaveBeenCalledTimes(1);
    const call = mc().mock.calls[0][0];
    expect(call.data.eventKey).toBe('server:run-1:started:user-1');
    expect(call.data.name).toBe('game_started');
    expect(call.data.source).toBe(TelemetrySource.SERVER);
  });

  it('emits game_finished with deterministic eventKey', () => {
    trackServerEvent({
      name: 'game_finished',
      userId: 'user-1',
      runId: 'run-1',
    });

    expect(mc()).toHaveBeenCalledTimes(1);
    const call = mc().mock.calls[0][0];
    expect(call.data.eventKey).toBe('server:run-1:finished:user-1');
  });

  it('emits question_answered with questionId in eventKey', () => {
    trackServerEvent({
      name: 'question_answered',
      userId: 'user-1',
      runId: 'run-1',
      questionId: 'q-42',
    });

    expect(mc()).toHaveBeenCalledTimes(1);
    const call = mc().mock.calls[0][0];
    expect(call.data.eventKey).toBe('server:run-1:answer:q-42:user-1');
  });

  it('uses anon for null userId', () => {
    trackServerEvent({
      name: 'game_started',
      userId: null,
      runId: 'run-1',
    });

    expect(mc()).toHaveBeenCalledTimes(1);
    const call = mc().mock.calls[0][0];
    expect(call.data.eventKey).toBe('server:run-1:started:anon');
  });

  it('ignores P2002 duplicate key errors silently', () => {
    mc().mockRejectedValueOnce({ code: 'P2002' });

    trackServerEvent({
      name: 'game_started',
      userId: 'user-1',
      runId: 'run-1',
    });

    expect(mc()).toHaveBeenCalledTimes(1);
  });

  it('does not throw on prisma errors (fail-closed)', () => {
    mc().mockRejectedValueOnce(new Error('DB down'));

    expect(() => {
      trackServerEvent({
        name: 'game_started',
        userId: 'user-1',
        runId: 'run-1',
      });
    }).not.toThrow();
  });

  it('rejects non-server event names silently', () => {
    trackServerEvent({
      name: 'app_open' as any,
      userId: 'user-1',
    });

    expect(mc()).not.toHaveBeenCalled();
  });

  it('sanitizes forbidden properties: no email, answer, coordinates', () => {
    trackServerEvent({
      name: 'game_started',
      userId: 'user-1',
      runId: 'run-1',
      properties: {
        email: 'test@test.com',
        correctAnswer: 'Paris',
        userLat: 48.8566,
        userLng: 2.3522,
        isCorrect: true,
        points: 100,
      },
    });

    expect(mc()).toHaveBeenCalledTimes(1);
    const call = mc().mock.calls[0][0];
    const props = call.data.properties as Record<string, unknown>;
    expect(props).toBeDefined();
    expect(props.email).toBeUndefined();
    expect(props.correctAnswer).toBeUndefined();
    expect(props.userLat).toBeUndefined();
    expect(props.userLng).toBeUndefined();
    expect(props.isCorrect).toBe(true);
    expect(props.points).toBe(100);
  });
});

describe('insertClientEvents', () => {
  it('inserts valid client events', async () => {
    const result = await insertClientEvents([
      {
        eventKey: 'clt-1',
        name: 'app_open',
        clientSessionId: 'sess-1',
        occurredAt: new Date().toISOString(),
      },
    ]);

    expect(result.inserted).toBe(1);
    expect(mcm()).toHaveBeenCalledTimes(1);
  });

  it('rejects server-side events from client', async () => {
    const result = await insertClientEvents([
      {
        eventKey: 'clt-1',
        name: 'game_finished',
        clientSessionId: 'sess-1',
        occurredAt: new Date().toISOString(),
      },
    ]);

    expect(result.inserted).toBe(0);
  });

  it('rejects mechanic_used from client', async () => {
    const result = await insertClientEvents([
      {
        eventKey: 'clt-1',
        name: 'mechanic_used',
        clientSessionId: 'sess-1',
        occurredAt: new Date().toISOString(),
      },
    ]);

    expect(result.inserted).toBe(0);
  });

  it('handles mixed valid and invalid events', async () => {
    const result = await insertClientEvents([
      {
        eventKey: 'clt-1',
        name: 'app_open',
        clientSessionId: 'sess-1',
        occurredAt: new Date().toISOString(),
      },
      {
        eventKey: 'clt-2',
        name: 'game_started',
        clientSessionId: 'sess-1',
        occurredAt: new Date().toISOString(),
      },
      {
        eventKey: 'clt-3',
        name: 'mode_selected',
        clientSessionId: 'sess-1',
        occurredAt: new Date().toISOString(),
      },
    ]);

    expect(result.inserted).toBe(1);
  });

  it('survives DB errors gracefully', async () => {
    mcm().mockRejectedValueOnce(new Error('DB down'));

    const result = await insertClientEvents([
      {
        eventKey: 'clt-1',
        name: 'app_open',
        clientSessionId: 'sess-1',
        occurredAt: new Date().toISOString(),
      },
    ]);

    expect(result.inserted).toBe(0);
  });

  it('handles empty events array', async () => {
    const result = await insertClientEvents([]);
    expect(result.inserted).toBe(0);
  });
});

describe('distanceBucket', () => {
  it('produces correct buckets', () => {
    const { distanceBucket } = telemetryModule;
    expect(distanceBucket(50)).toBe('<100km');
    expect(distanceBucket(250)).toBe('100-500km');
    expect(distanceBucket(750)).toBe('500-1000km');
    expect(distanceBucket(1500)).toBe('1000-2000km');
    expect(distanceBucket(3000)).toBe('>2000km');
    expect(distanceBucket(undefined)).toBeUndefined();
  });
});
