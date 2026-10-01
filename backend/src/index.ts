import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase, prisma } from './config/database.js';
import { getRedis, disconnectRedis } from './config/redis.js';


// Controllers
import authController from './controllers/auth.controller.js';
import gameController from './controllers/game.controller.js';
import flagMasterController from './controllers/flagMaster.controller.js';
import leaderboardController from './controllers/leaderboard.controller.js';
import challengeController from './controllers/challenge.controller.js';
import geoChallengeController from './controllers/geoChallenge.controller.js';
import telemetryController from './controllers/telemetry.controller.js';
import masteryController from './controllers/mastery.controller.js';
import competitionController from './controllers/competition.controller.js';
import worldEventController from './controllers/worldEvent.controller.js';
import { globalLimiter } from './middleware/rateLimit.js';

// Socket handlers
import { setupSocketHandlers } from './sockets/index.js';

const app = express();
const buildSha = process.env.GIT_SHA || process.env.BUILD_SHA || 'unknown';
app.set('trust proxy', 1);
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.frontend.url,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontend.url,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// Health check with dependency verification.
app.get('/health', async (_req, res) => {
  let pingTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redis = getRedis();
    const pingPromise = redis.ping();
    pingPromise.catch(() => {}); // si gana el timeout, evita unhandledRejection
    await Promise.race([
      pingPromise,
      new Promise((_resolve, reject) => {
        pingTimer = setTimeout(() => reject(new Error('redis ping timeout')), 1500);
      }),
    ]);
    res.json({ status: 'ok', db: 'ok', redis: 'ok', sha: buildSha, timestamp: new Date().toISOString() });
  } catch (error) {
    // El detalle (host/puerto de DB, etc.) solo va al log, nunca a la respuesta.
    console.error('[health] dependency check failed:', error);
    res.status(503).json({ status: 'degraded', error: 'Dependency check failed', sha: buildSha, timestamp: new Date().toISOString() });
  } finally {
    clearTimeout(pingTimer);
  }
});

// Rate limit applies only to application routes.
app.use('/api', globalLimiter);

// API Routes
app.use('/api/auth', authController);
app.use('/api/game/flag-master', flagMasterController);
app.use('/api/game/geo-challenges', geoChallengeController);
app.use('/api/game', gameController);
app.use('/api/leaderboard', leaderboardController);
app.use('/api/challenges', challengeController);
app.use('/api/telemetry', telemetryController);
app.use('/api/mastery', masteryController);
app.use('/api/competition', competitionController);
app.use('/api/events', worldEventController);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler
app.use((err: Error & { status?: number; statusCode?: number; type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  // Errores de cliente (JSON malformado, body demasiado grande, etc.): 4xx sin stack en logs.
  const candidate = err.status ?? err.statusCode;
  if (typeof candidate === 'number' && candidate >= 400 && candidate < 500) {
    if (err.type === 'entity.parse.failed') {
      res.status(candidate).json({ error: 'JSON inválido', code: 'INVALID_JSON' });
    } else if (err.type === 'entity.too.large') {
      res.status(candidate).json({ error: 'Payload demasiado grande', code: 'PAYLOAD_TOO_LARGE' });
    } else {
      res.status(candidate).json({ error: 'Solicitud inválida', code: 'BAD_REQUEST' });
    }
    return;
  }

  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Startup
async function start() {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize Redis
    getRedis();

    // Start server
    httpServer.listen(config.port, () => {
      console.log(`
🌍 GeoChallenge Backend
========================
🚀 Server running on port ${config.port}
📦 Environment: ${config.nodeEnv}
🔗 Frontend URL: ${config.frontend.url}
      `);

    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nShutting down...');

  // Si algo se cuelga (conexiones abiertas, DB), forzamos la salida.
  const forceExitTimer = setTimeout(() => {
    console.error(`Shutdown did not finish within ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  let exitCode = 0;
  try {
    // Dejar de aceptar conexiones y cerrar sockets antes de soltar DB/Redis.
    httpServer.close();
    await new Promise<void>((resolve) => {
      // io.close() desconecta los clientes y resuelve cuando el http server cerró
      // (el callback puede recibir un error si ya estaba cerrándose; da igual).
      io.close(() => resolve());
      httpServer.closeIdleConnections?.();
    });
    await disconnectDatabase();
    await disconnectRedis();
  } catch (error) {
    console.error('Error during shutdown:', error);
    exitCode = 1;
  }
  clearTimeout(forceExitTimer);
  process.exit(exitCode);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Red de seguridad: en Node >= 15 un rechazo sin manejar mata el proceso.
// Loggear con contexto en vez de morir en silencio.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason, promise);
});

start();

export { io };
