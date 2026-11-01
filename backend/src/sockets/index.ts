import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JwtPayload, ALLOWED_JWT_ALGORITHMS } from '../middleware/auth.js';
import { setupDuelHandlers, MatchmakingQueue, startDuelWatchdog } from './duel.handler.js';
import { setupSurvivalHandlers } from './survival.handler.js';
import { createSocketEventRateLimiter } from './rateLimiter.js';

// Extend Socket type to include user info
declare module 'socket.io' {
  interface Socket {
    user?: JwtPayload;
  }
}

// Global matchmaking queue
export const matchmakingQueue = new MatchmakingQueue();

// Map of userId to socketId for notifications (mantenido por compatibilidad)
export const userSockets = new Map<string, string>();

/**
 * Retorna el nombre de sala Socket.IO para un usuario específico.
 */
export function getUserRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Middleware para autenticar sockets
 */
export function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Token de autenticación requerido'));
  }

  try {
    const decoded = jwt.verify(token as string, config.jwt.secret, {
      algorithms: ALLOWED_JWT_ALGORITHMS,
    }) as JwtPayload;
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

  // Watchdog de duelos zombies y limpieza de cola (barrido periódico)
  startDuelWatchdog(io, matchmakingQueue);

  io.on('connection', (socket: Socket) => {
    const user = socket.user!;
    console.log(`🔌 Usuario conectado: ${user.username} (${socket.id})`);

    // Unir socket a la sala del usuario (soporta multi-pestaña y reconexiones)
    socket.join(getUserRoom(user.userId));

    // Registrar socket del usuario (mapa en memoria para compatibilidad hacia atrás)
    userSockets.set(user.userId, socket.id);

    // Throttling de eventos a nivel de socket (OWASP API4:2023)
    socket.use(createSocketEventRateLimiter(socket));

    // Setup duel handlers
    setupDuelHandlers(io, socket, matchmakingQueue);

    // Setup survival handlers
    setupSurvivalHandlers(io, socket);

    // Handler de desconexión
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Usuario desconectado: ${user.username} - ${reason}`);
      if (userSockets.get(user.userId) === socket.id) {
        userSockets.delete(user.userId);
      }

      // Remover de cola de matchmaking solo si la entrada es de ESTE socket
      // (un disconnect tardío de un socket viejo no debe borrar la del nuevo).
      matchmakingQueue.removePlayerIfSocket(user.userId, socket.id);
    });

    // Ping para mantener conexión viva
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  console.log('✅ Socket.IO handlers configurados');
}

/**
 * Envía un evento a un usuario específico por su ID.
 * Emite a la sala `user:${userId}`, entregando el mensaje a todas las conexiones activas
 * del usuario (soporta múltiples pestañas simultáneas y escalabilidad horizontal vía adapter).
 */
export function emitToUser(
  io: SocketIOServer,
  userId: string,
  event: string,
  data: any
): boolean {
  const room = getUserRoom(userId);
  const rooms = io.sockets?.adapter?.rooms;
  const hasRoomSockets = rooms ? Boolean(rooms.get(room)?.size) : false;
  const hasUserSocket = userSockets.has(userId);

  if (hasRoomSockets || hasUserSocket) {
    io.to(room).emit(event, data);
    return true;
  }
  return false;
}
