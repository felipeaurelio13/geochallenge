import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JwtPayload } from '../middleware/auth.js';
import { setupDuelHandlers, MatchmakingQueue, startDuelWatchdog } from './duel.handler.js';
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
 * Constantes y límites para rate limiting de Socket.IO
 */
export const SOCKET_RATE_LIMIT = {
  MAX_CONCURRENT_PER_IP: 30,  // máx 30 conexiones activas simultáneas por IP
  MAX_CONCURRENT_PER_USER: 5, // máx 5 conexiones activas simultáneas por usuario
};

// Tracking de sockets activos concurrentes: IP -> Set<socketId>
export const activeSocketsByIp = new Map<string, Set<string>>();

// Tracking de sockets activos concurrentes: userId -> Set<socketId>
export const activeSocketsByUser = new Map<string, Set<string>>();

/**
 * Obtiene la IP del cliente del socket respetando headers de proxy y fallback a handshake.address
 */
export function getSocketClientIp(socket: Socket): string {
  const forwarded = socket.handshake?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return socket.handshake?.address || '127.0.0.1';
}

/**
 * Restablece el tracking de sockets activos (útil para tests)
 */
export function resetActiveSockets(): void {
  activeSocketsByIp.clear();
  activeSocketsByUser.clear();
}

/**
 * Registra un socket activo una vez completado el handshake y conexión
 */
export function registerActiveSocket(ip: string, userId: string, socketId: string): void {
  let ipSockets = activeSocketsByIp.get(ip);
  if (!ipSockets) {
    ipSockets = new Set();
    activeSocketsByIp.set(ip, ipSockets);
  }
  ipSockets.add(socketId);

  let userSocketsSet = activeSocketsByUser.get(userId);
  if (!userSocketsSet) {
    userSocketsSet = new Set();
    activeSocketsByUser.set(userId, userSocketsSet);
  }
  userSocketsSet.add(socketId);
}

/**
 * Desregistra un socket activo al desconectarse
 */
export function unregisterActiveSocket(ip: string, userId: string, socketId: string): void {
  const ipSockets = activeSocketsByIp.get(ip);
  if (ipSockets) {
    ipSockets.delete(socketId);
    if (ipSockets.size === 0) {
      activeSocketsByIp.delete(ip);
    }
  }

  const userSocketsSet = activeSocketsByUser.get(userId);
  if (userSocketsSet) {
    userSocketsSet.delete(socketId);
    if (userSocketsSet.size === 0) {
      activeSocketsByUser.delete(userId);
    }
  }
}

/**
 * Middleware para limitar conexiones simultáneas por IP
 */
export function limitConcurrentSockets(socket: Socket, next: (err?: Error) => void) {
  const ip = getSocketClientIp(socket);
  const activeCount = activeSocketsByIp.get(ip)?.size ?? 0;
  if (activeCount >= SOCKET_RATE_LIMIT.MAX_CONCURRENT_PER_IP) {
    return next(new Error('Límite de conexiones simultáneas por IP alcanzado'));
  }
  next();
}

/**
 * Middleware para autenticar sockets y verificar límite de conexiones por usuario
 */
export function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Token de autenticación requerido'));
  }

  try {
    const decoded = jwt.verify(token as string, config.jwt.secret) as JwtPayload;

    // Verificar límite de sockets concurrentes por usuario
    const userActiveCount = activeSocketsByUser.get(decoded.userId)?.size ?? 0;
    if (userActiveCount >= SOCKET_RATE_LIMIT.MAX_CONCURRENT_PER_USER) {
      return next(new Error('Límite de conexiones simultáneas por usuario alcanzado'));
    }

    socket.user = decoded;
    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Límite de conexiones')) {
      return next(error);
    }
    next(new Error('Token inválido'));
  }
}

/**
 * Configura los handlers de Socket.IO
 */
export function setupSocketHandlers(io: SocketIOServer) {
  // Middleware de límite de conexiones simultáneas por IP
  io.use(limitConcurrentSockets);

  // Middleware de autenticación y concurrencia por usuario
  io.use(authenticateSocket);

  // Watchdog de duelos zombies y limpieza de cola (barrido periódico)
  startDuelWatchdog(io, matchmakingQueue);

  io.on('connection', (socket: Socket) => {
    const user = socket.user!;
    const ip = getSocketClientIp(socket);

    // Registrar socket activo
    registerActiveSocket(ip, user.userId, socket.id);

    console.log(`🔌 Usuario conectado: ${user.username} (${socket.id})`);

    // Registrar socket del usuario
    userSockets.set(user.userId, socket.id);

    // Setup duel handlers
    setupDuelHandlers(io, socket, matchmakingQueue);

    // Setup survival handlers
    setupSurvivalHandlers(io, socket);

    // Handler de desconexión
    socket.on('disconnect', (reason) => {
      unregisterActiveSocket(ip, user.userId, socket.id);
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
