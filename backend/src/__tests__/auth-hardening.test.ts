import express from 'express';
import { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authRouter from '../controllers/auth.controller.js';

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock('../middleware/rateLimit.js', () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1' };
    next();
  },
  generateToken: () => 'token',
}));

vi.mock('../services/email.service.js', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst, create: mocks.userCreate, update: mocks.userUpdate },
  },
}));

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

async function post(baseUrl: string, path: string, body: unknown, method = 'POST') {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { code?: string } };
}

describe('POST /api/auth/login — igualdad de trabajo bcrypt con usuario inexistente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usuario inexistente: ejecuta bcrypt.compare contra un hash dummy y responde 401 genérico', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    const compareSpy = vi.spyOn(bcrypt, 'compare');
    const { server, baseUrl } = startServer();
    const res = await post(baseUrl, '/api/auth/login', { email: 'nadie@example.com', password: 'whatever1' });
    server.close();

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(compareSpy).toHaveBeenCalledTimes(1);
    const [, hashUsed] = compareSpy.mock.calls[0] as [string, string];
    expect(hashUsed).toMatch(/^\$2[aby]\$12\$/);
    compareSpy.mockRestore();
  });

  it('usuario existente con contraseña errónea: mismo 401', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    mocks.userFindFirst.mockResolvedValue({ id: 'u1', username: 'u', email: 'u@example.com', passwordHash });
    const { server, baseUrl } = startServer();
    const res = await post(baseUrl, '/api/auth/login', { email: 'u@example.com', password: 'wrong-password' });
    server.close();

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

describe('P2002 (carrera check-then-write) se mapea a los códigos *_TAKEN', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const registerBody = { username: 'newuser', email: 'new@example.com', password: 'secret123' };

  it('register: P2002 sobre email → 400 AUTH_EMAIL_TAKEN', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userCreate.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });
    const { server, baseUrl } = startServer();
    const res = await post(baseUrl, '/api/auth/register', registerBody);
    server.close();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('register: P2002 sobre username → 400 AUTH_USERNAME_TAKEN', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userCreate.mockRejectedValue({ code: 'P2002', meta: { target: ['username'] } });
    const { server, baseUrl } = startServer();
    const res = await post(baseUrl, '/api/auth/register', registerBody);
    server.close();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AUTH_USERNAME_TAKEN');
  });

  it('register: otros errores de Prisma siguen siendo 500', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userCreate.mockRejectedValue(new Error('boom'));
    const { server, baseUrl } = startServer();
    const res = await post(baseUrl, '/api/auth/register', registerBody);
    server.close();

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL');
  });

  it('profile: P2002 sobre username → 400 AUTH_USERNAME_TAKEN', async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userUpdate.mockRejectedValue({ code: 'P2002', meta: { target: ['username'] } });
    const { server, baseUrl } = startServer();
    const res = await post(baseUrl, '/api/auth/profile', { username: 'taken_name' }, 'PUT');
    server.close();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AUTH_USERNAME_TAKEN');
  });
});
