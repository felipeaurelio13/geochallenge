import express from 'express';
import { AddressInfo } from 'node:net';
import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authRouter from '../controllers/auth.controller.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  passwordResetTokenCreate: vi.fn(),
  passwordResetTokenFindFirst: vi.fn(),
  passwordResetTokenUpdate: vi.fn(),
  passwordResetTokenUpdateMany: vi.fn(),
}));

vi.mock('../middleware/rateLimit.js', () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/email.service.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/database.js', () => {
  const prisma = {
    user: { findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    passwordResetToken: {
      create: mocks.passwordResetTokenCreate,
      findFirst: mocks.passwordResetTokenFindFirst,
      update: mocks.passwordResetTokenUpdate,
      updateMany: mocks.passwordResetTokenUpdateMany,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma };
});

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FRONTEND_URL = 'https://geochallenge-frontend.onrender.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responde 200 genérico cuando el usuario existe, y crea el token + intenta enviar el email', async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: 'user-1',
      email: 'existing@example.com',
      preferredLanguage: 'es',
    });
    mocks.passwordResetTokenCreate.mockResolvedValue({});

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'existing@example.com' }),
    });
    const body = (await response.json()) as { message: string };
    server.close();

    expect(response.status).toBe(200);
    expect(body.message).toMatch(/instrucciones/i);
    expect(mocks.passwordResetTokenCreate).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [to, resetUrl, lang] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    expect(to).toBe('existing@example.com');
    expect(resetUrl).toMatch(/^https:\/\/geochallenge-frontend\.onrender\.com\/reset-password\?token=/);
    expect(lang).toBe('es');
  });

  it('responde el mismo 200 genérico cuando el usuario NO existe (previene user enumeration)', async () => {
    mocks.userFindFirst.mockResolvedValue(null);

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    const body = (await response.json()) as { message: string };
    server.close();

    expect(response.status).toBe(200);
    expect(body.message).toMatch(/instrucciones/i);
    expect(mocks.passwordResetTokenCreate).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('un email mal formado también responde 200 genérico (no 400)', async () => {
    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const body = (await response.json()) as { message: string };
    server.close();

    expect(response.status).toBe(200);
    expect(body.message).toMatch(/instrucciones/i);
  });

  it('si el envío de email falla, igual responde 200 (nunca debe romper el flujo)', async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: 'user-1',
      email: 'existing@example.com',
      preferredLanguage: 'en',
    });
    mocks.passwordResetTokenCreate.mockResolvedValue({});
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('resend down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'existing@example.com' }),
    });
    const body = (await response.json()) as { message: string };
    server.close();

    expect(response.status).toBe(200);
    expect(body.message).toMatch(/instrucciones/i);
  });
});

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('token inválido responde 400 con code AUTH_RESET_TOKEN_INVALID', async () => {
    mocks.passwordResetTokenFindFirst.mockResolvedValue(null);

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'nonexistent-token', newPassword: 'newpass123' }),
    });
    const body = (await response.json()) as { code: string };
    server.close();

    expect(response.status).toBe(400);
    expect(body.code).toBe('AUTH_RESET_TOKEN_INVALID');
  });

  it('token expirado responde 400 con code AUTH_RESET_TOKEN_EXPIRED', async () => {
    mocks.passwordResetTokenFindFirst.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: crypto.createHash('sha256').update('raw-token').digest('hex'),
      expiresAt: new Date(Date.now() - 60_000), // expiró hace 1 min
      usedAt: null,
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'raw-token', newPassword: 'newpass123' }),
    });
    const body = (await response.json()) as { code: string };
    server.close();

    expect(response.status).toBe(400);
    expect(body.code).toBe('AUTH_RESET_TOKEN_EXPIRED');
  });

  it('token ya usado responde 400 con code AUTH_RESET_TOKEN_EXPIRED', async () => {
    mocks.passwordResetTokenFindFirst.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: crypto.createHash('sha256').update('raw-token').digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(), // ya usado
    });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'raw-token', newPassword: 'newpass123' }),
    });
    const body = (await response.json()) as { code: string };
    server.close();

    expect(response.status).toBe(400);
    expect(body.code).toBe('AUTH_RESET_TOKEN_EXPIRED');
  });

  it('token válido actualiza la contraseña, marca usedAt, e invalida otros tokens del usuario', async () => {
    mocks.passwordResetTokenFindFirst.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: crypto.createHash('sha256').update('raw-token').digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    mocks.userUpdate.mockResolvedValue({});
    mocks.passwordResetTokenUpdate.mockResolvedValue({});
    mocks.passwordResetTokenUpdateMany.mockResolvedValue({ count: 0 });

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'raw-token', newPassword: 'brandNewPass1' }),
    });
    const body = (await response.json()) as { message: string };
    server.close();

    expect(response.status).toBe(200);
    expect(body.message).toMatch(/actualizada/i);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    );
    expect(mocks.passwordResetTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'token-1' }, data: expect.objectContaining({ usedAt: expect.any(Date) }) })
    );
    expect(mocks.passwordResetTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', id: { not: 'token-1' } }),
      })
    );
  });

  it('newPassword corta (< 6 chars) responde 400 VALIDATION_FAILED', async () => {
    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'raw-token', newPassword: '123' }),
    });
    const body = (await response.json()) as { code: string };
    server.close();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mocks.passwordResetTokenFindFirst).not.toHaveBeenCalled();
  });
});
