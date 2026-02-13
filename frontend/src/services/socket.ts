import { io, Socket } from 'socket.io-client';
import type { Category, Question, DuelOpponent, DuelResult, AnswerResult } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

type DuelEventHandlers = {
  onQueued?: (data: { message: string; queueSize: number }) => void;
  onCancelled?: (data: { message: string }) => void;
  onMatched?: (data: {
    duelId: string;
    questionsCount: number;
    timePerQuestion: number;
    category: Category;
    opponent: DuelOpponent;
  }) => void;
  onOpponent?: (opponent: DuelOpponent) => void;
  onCountdown?: (data: { seconds: number }) => void;
  onStart?: (data: { message: string }) => void;
  onQuestion?: (data: {
    questionIndex: number;
    totalQuestions: number;
    question: Question;
    timeLimit: number;
  }) => void;
  onPlayerAnswered?: (data: { userId: string; questionIndex: number }) => void;
  onQuestionResult?: (data: {
    questionIndex: number;
    correctAnswer: string;
    results: {
      userId: string;
      username: string;
      answer: AnswerResult;
      totalScore: number;
    }[];
  }) => void;
  onFinished?: (data: {
    reason: 'completed' | 'opponent_disconnected' | 'cancelled';
    winnerId: string | null;
    isDraw: boolean;
    results: DuelResult[];
    myScore?: number;
    opponentScore?: number;
  }) => void;
  onError?: (data: { message: string }) => void;
  onOpponentDisconnected?: () => void;
};

class SocketService {
  public socket: Socket | null = null;
  private handlers: DuelEventHandlers = {};

  connect(token?: string): void {
    const authToken = token || localStorage.getItem('token');

    if (!authToken) {
      console.warn('No auth token available for socket connection');
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.setupListeners();
    });

    // Re-register listeners on reconnection
    this.socket.io.on('reconnect', () => {
      console.log('Socket reconnected');
      this.setupListeners();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  setHandlers(handlers: DuelEventHandlers): void {
    this.handlers = handlers;
  }

  private setupListeners(): void {
    if (!this.socket) return;

    // Remove all existing listeners before re-registering to avoid duplicates
    this.socket.removeAllListeners();

    // Re-register connection events
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.setupListeners();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    // Duel events — backend emits duel:* prefix for all duel events
    this.socket.on('duel:queued', (data) => {
      this.handlers.onQueued?.(data);
    });

    this.socket.on('duel:cancelled', (data) => {
      this.handlers.onCancelled?.(data);
    });

    this.socket.on('duel:matched', (data) => {
      this.handlers.onMatched?.(data);
    });

    this.socket.on('duel:opponent', (data) => {
      this.handlers.onOpponent?.(data);
    });

    this.socket.on('duel:countdown', (data) => {
      this.handlers.onCountdown?.(data);
    });

    this.socket.on('duel:start', (data) => {
      this.handlers.onStart?.(data);
    });

    this.socket.on('duel:question', (data) => {
      this.handlers.onQuestion?.(data);
    });

    this.socket.on('duel:playerAnswered', (data) => {
      this.handlers.onPlayerAnswered?.(data);
    });

    this.socket.on('duel:questionResult', (data) => {
      this.handlers.onQuestionResult?.(data);
    });

    this.socket.on('duel:finished', (data) => {
      this.handlers.onFinished?.(data);
    });

    this.socket.on('duel:error', (data) => {
      this.handlers.onError?.(data);
    });

    this.socket.on('duel:opponent-disconnected', () => {
      this.handlers.onOpponentDisconnected?.();
    });
  }

  // Duel actions
  joinQueue(category?: Category): void {
    this.socket?.emit('duel:queue', { category });
  }

  joinDuelQueue(category?: Category): void {
    this.joinQueue(category);
  }

  cancelQueue(): void {
    this.socket?.emit('duel:cancel');
  }

  cancelDuelQueue(): void {
    this.cancelQueue();
  }

  ready(): void {
    this.socket?.emit('duel:ready');
  }

  sendAnswer(data: {
    questionId: string;
    answer: string;
    timeRemaining: number;
    coordinates?: { lat: number; lng: number };
  }): void {
    this.socket?.emit('duel:answer', data);
  }

  submitDuelAnswer(
    questionId: string,
    answer: string,
    timeRemaining: number,
    coordinates?: { lat: number; lng: number }
  ): void {
    this.socket?.emit('duel:answer', {
      questionId,
      answer,
      timeRemaining,
      coordinates,
    });
  }
}

export const socketService = new SocketService();
