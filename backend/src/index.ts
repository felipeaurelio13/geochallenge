import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase, prisma } from './config/database.js';
import { getRedis, disconnectRedis } from './config/redis.js';

// Controllers
import authController from './controllers/auth.controller.js';
import gameController from './controllers/game.controller.js';
import leaderboardController from './controllers/leaderboard.controller.js';
import challengeController from './controllers/challenge.controller.js';

// Socket handlers
import { setupSocketHandlers } from './sockets/index.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.frontend.url,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación, intenta de nuevo más tarde' },
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
app.use(globalLimiter);

// Health check (with dependency verification)
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redis = getRedis();
    await redis.ping();
    res.json({ status: 'ok', db: 'ok', redis: 'ok', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(503).json({ status: 'degraded', error: error.message, timestamp: new Date().toISOString() });
  }
});

// API Routes
app.use('/api/auth', authLimiter, authController);
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
