import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JwtPayload } from '../middleware/auth.js';
import { setupDuelHandlers, MatchmakingQueue } from './duel.handler.js';
import { setupSurvivalHandlers } from './survival.handler.js';

// Extend Socket type to include user info
declare module 'socket.io' {
  interface Socket {
    user?: JwtPayload;
  }
}

// Global matchmaking queue
export const matchmakingQueue = new MatchmakingQueue();

// Map of userId to socketId for notifications
export const userSockets = new Map<string, string>();

/**
 * Middleware para autenticar sockets
 */
function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error('Token de autenticación requerido'));
  }

  try {
    const decoded = jwt.verify(token as string, config.jwt.secret) as JwtPayload;
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Token inválido'));
  }
}

/**
 * Configura los handlers de Socket.IO
 */
export function setupSocketHandlers(io: SocketIOServer) {
  // Middleware de autenticación
  io.use(authenticateSocket);

  io.on('connection', (socket: Socket) => {
    const user = socket.user!;
    console.log(`🔌 Usuario conectado: ${user.username} (${socket.id})`);

    // Registrar socket del usuario
    userSockets.set(user.userId, socket.id);

    // Setup duel handlers
    setupDuelHandlers(io, socket, matchmakingQueue);

    // Setup survival handlers
    setupSurvivalHandlers(io, socket);

    // Handler de desconexión
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Usuario desconectado: ${user.username} - ${reason}`);
      userSockets.delete(user.userId);

      // Remover de cola de matchmaking si estaba esperando
      matchmakingQueue.removePlayer(user.userId);
    });

    // Ping para mantener conexión viva
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  console.log('✅ Socket.IO handlers configurados');
}

/**
 * Envía un evento a un usuario específico por su ID
 */
export function emitToUser(
  io: SocketIOServer,
  userId: string,
  event: string,
  data: any
): boolean {
  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
    return true;
  }
  return false;
}
