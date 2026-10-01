import express from 'express';
import { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import telemetryRouter from '../controllers/telemetry.controller.js';

const mocks = vi.hoisted(() => ({
  insertClientEvents: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/telemetry.service.js', () => ({
  insertClientEvents: mocks.insertClientEvents,
}));

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/telemetry', telemetryRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

function eventWith(occurredAt: string) {
  return { eventKey: 'k1', name: 'app_open', clientSessionId: 's1', occurredAt };
}

async function send(baseUrl: string, occurredAt: string) {
  const res = await fetch(`${baseUrl}/api/telemetry/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events: [eventWith(occurredAt)] }),
  });
  return { status: res.status, body: (await res.json()) as { code?: string } };
}

describe('POST /api/telemetry/events — occurredAt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertClientEvents.mockResolvedValue({ inserted: 1 });
  });

  it('acepta ISO 8601 (Z y offset)', async () => {
    const { server, baseUrl } = startServer();
    const a = await send(baseUrl, new Date().toISOString());
    const b = await send(baseUrl, '2026-10-01T12:00:00+02:00');
    server.close();
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it('rechaza strings que no son fecha (Invalid Date) con 400 VALIDATION_FAILED', async () => {
    const { server, baseUrl } = startServer();
    const results = await Promise.all([send(baseUrl, 'not-a-date'), send(baseUrl, '2026-13-45T99:99:99Z'), send(baseUrl, '1')]);
    server.close();
    for (const r of results) {
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_FAILED');
    }
    expect(mocks.insertClientEvents).not.toHaveBeenCalled();
  });
});
