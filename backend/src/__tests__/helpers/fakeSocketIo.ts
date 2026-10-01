import { vi } from 'vitest';

export interface Emission {
  to?: string;
  event: string;
  data: any;
}

export interface FakeSocket {
  id: string;
  user: { userId: string; username: string };
  handlers: Map<string, (...args: any[]) => any>;
  emitted: Emission[];
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  on: (event: string, handler: (...args: any[]) => any) => void;
  emit: (event: string, data?: any) => void;
  to: (room: string) => { emit: (event: string, data?: any) => void };
  /** Dispara un listener registrado y espera su promesa (si la hay). */
  fire: (event: string, ...args: any[]) => Promise<void>;
  /** Último payload emitido para el evento (o undefined). */
  last: (event: string) => any;
}

export function makeFakeSocket(userId: string, socketId = `sock-${userId}`): FakeSocket {
  const handlers = new Map<string, (...args: any[]) => any>();
  const emitted: Emission[] = [];
  const socket: FakeSocket = {
    id: socketId,
    user: { userId, username: `user-${userId}` },
    handlers,
    emitted,
    join: vi.fn(),
    leave: vi.fn(),
    on: (event, handler) => {
      handlers.set(event, handler);
    },
    emit: (event, data) => {
      emitted.push({ event, data });
    },
    to: () => ({ emit: () => undefined }),
    fire: async (event, ...args) => {
      const handler = handlers.get(event);
      if (!handler) throw new Error(`no listener for ${event}`);
      await handler(...args);
    },
    last: (event) => [...emitted].reverse().find((e) => e.event === event)?.data,
  };
  return socket;
}

export function makeFakeIo(sockets: FakeSocket[]) {
  const emitted: Emission[] = [];
  const socketMap = new Map<string, FakeSocket>(sockets.map((s) => [s.id, s]));
  const io = {
    emitted,
    sockets: { sockets: socketMap },
    to: (target: string) => ({
      emit: (event: string, data?: any) => {
        emitted.push({ to: target, event, data });
      },
    }),
    /** Emisiones dirigidas a un socket id concreto. */
    forSocket: (socketId: string, event: string) =>
      emitted.filter((e) => e.to === socketId && e.event === event).map((e) => e.data),
    /** Todas las emisiones de un evento (cualquier destino). */
    ofEvent: (event: string) => emitted.filter((e) => e.event === event),
  };
  return io;
}
