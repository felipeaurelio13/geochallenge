import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase, prisma } from './config/database.js';
import { getRedis, disconnectRedis } from './config/redis.js';
import { rebuildAllLeaderboards } from './services/leaderboard.service.js';

// Controllers
import authController from './controllers/auth.controller.js';
import gameController from './controllers/game.controller.js';
import leaderboardController from './controllers/leaderboard.controller.js';
import challengeController from './controllers/challenge.controller.js';
import { globalLimiter } from './middleware/rateLimit.js';

// Socket handlers
import { setupSocketHandlers } from './sockets/index.js';

const app = express();
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

// Lightweight ping for keep-alive (no DB/Redis round-trip).
// NO rate-limit: BackendKeepAlive en el cliente lo invoca periódicamente
// y consumiría cupo del jugador.
app.get('/ping', (_req, res) => {
  res.json({ status: 'ok' });
});

// Health check (with dependency verification). Sin rate-limit por la misma razón.
// El ping a Redis se acota a 1.5s: el keep-alive del cliente invoca /health a
// menudo, y un /health lento satura el pool de 6 conexiones del navegador y
// bloquea requests reales (p.ej. el ranking deja de cargar).
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
    res.json({ status: 'ok', db: 'ok', redis: 'ok', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(503).json({ status: 'degraded', error: error.message, timestamp: new Date().toISOString() });
  } finally {
    clearTimeout(pingTimer);
  }
});

// Rate limit aplica sólo a las rutas /api (no a /ping ni /health, para que
// keep-alives no consuman el cupo y dejen al usuario sin poder jugar).
app.use('/api', globalLimiter);

// API Routes
app.use('/api/auth', authController);
app.use('/api/game', gameController);
app.use('/api/leaderboard', leaderboardController);
app.use('/api/challenges', challengeController);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

      // Rebuild retroactivo en cada arranque:
      //   1. Recomputa User.highScore desde GameResult (corrige desincronizaciones históricas).
      //   2. Repuebla Redis global desde DB.
      //   3. Repuebla Redis para CADA temporada con actividad.
      // Es idempotente y rápido (groupBy + updateMany solo cuando hay diff). Para deshabilitarlo
      // (e.g. debugging), setear DISABLE_LEADERBOARD_AUTOREBUILD=true.
      if (process.env.DISABLE_LEADERBOARD_AUTOREBUILD === 'true') {
        console.log('ℹ️  Leaderboard auto-rebuild disabled by env flag');
      } else {
        void rebuildAllLeaderboards()
          .then((r) => {
            console.log(
              `✅ Leaderboards rebuilt: highScores+${r.highScoresUpdated}, global=${r.globalLoaded}, seasons=[${r.seasonsLoaded
                .map((s) => `${s.seasonId}:${s.loaded}`)
                .join(', ')}]`
            );
          })
          .catch((err) => console.error('⚠️  Leaderboard rebuild failed (non-fatal):', err));
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down...');
  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();

export { io };
