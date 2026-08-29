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
  } catch (error: any) {
    res.status(503).json({ status: 'degraded', error: error.message, sha: buildSha, timestamp: new Date().toISOString() });
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
