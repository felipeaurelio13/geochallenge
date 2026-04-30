import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Question,
  GameResult,
  LeaderboardEntry,
  Category,
  GameType,
  GameConfig,
  MechanicUsage,
  DuelMatchRecord,
  DuelPeriodStats,
  DuelOpponent,
  HeadToHeadData,
  DuelPeriod,
} from '../types';
import { testAuthBypass } from '../utils/testAuthBypass';
import { toAppPath } from '../utils/routing';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export type ApiErrorCode = 'network' | 'noServer' | 'timeout' | 'auth' | 'forbidden' | 'notFound' | 'rateLimit' | 'server' | 'http' | 'unknown';

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number | null;
  serverMessage: string | null;

  constructor(message: string, code: ApiErrorCode, status: number | null = null, serverMessage: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

function classifyError(error: AxiosError): ApiError {
  if (error.code === 'ECONNABORTED') {
    return new ApiError('La solicitud tardó demasiado. Reintenta en un momento.', 'timeout');
  }

  if (!error.response) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return new ApiError('Sin conexión a internet. Verifica tu red.', 'network');
    }
    return new ApiError('No pudimos contactar al servidor. Reintenta en un momento.', 'noServer');
  }

  const status = error.response.status;
  const data = error.response.data as { error?: string; message?: string } | undefined;
  const serverMessage = data?.error || data?.message || null;

  if (status === 401) return new ApiError(serverMessage || 'Tu sesión expiró. Vuelve a iniciar sesión.', 'auth', 401, serverMessage);
  if (status === 403) return new ApiError(serverMessage || 'No tienes permisos para esta acción.', 'forbidden', 403, serverMessage);
  if (status === 404) return new ApiError(serverMessage || 'No encontramos lo que buscabas.', 'notFound', 404, serverMessage);
  if (status === 429) return new ApiError(serverMessage || 'Demasiados intentos. Espera un momento y vuelve a intentar.', 'rateLimit', 429, serverMessage);
  if (status >= 500) return new ApiError(serverMessage || 'El servidor está teniendo problemas. Estamos en eso.', 'server', status, serverMessage);
  if (status >= 400) return new ApiError(serverMessage || 'El servidor no aceptó la solicitud.', 'http', status, serverMessage);

  return new ApiError(serverMessage || 'Algo salió mal. Reintenta en un momento.', 'unknown', status, serverMessage);
}

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (testAuthBypass.isEnabled && testAuthBypass.isConfigured && testAuthBypass.secret) {
        config.headers['x-test-auth-bypass'] = testAuthBypass.secret;
      }

      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          const isAuthPage = [toAppPath('/login'), toAppPath('/register')].includes(window.location.pathname);
          const hasBypass = testAuthBypass.isEnabled && testAuthBypass.isConfigured;
          if (!isAuthPage && !hasBypass) {
            localStorage.removeItem('token');
            window.location.href = toAppPath('/login');
          }
        }
        return Promise.reject(classifyError(error));
      }
    );
  }

  // Generic HTTP methods for direct usage
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  // Auth endpoints
  async register(data: { username: string; email: string; password: string }) {
    const response = await this.client.post<{
      user: User;
      token: string;
      message: string;
    }>('/auth/register', data);
    return response.data;
  }

  async login(data: { email: string; password: string }) {
    const response = await this.client.post<{
      user: User;
      token: string;
      message: string;
    }>('/auth/login', data);
    return response.data;
  }

  async getMe() {
    const response = await this.client.get<{ user: User }>('/auth/me');
    return response.data.user;
  }

  async updateProfile(data: { username?: string; preferredLanguage?: 'es' | 'en' }) {
    const response = await this.client.put<{ user: User }>('/auth/profile', data);
    return response.data.user;
  }

  // Game endpoints
  async startGame(
    category?: Category,
    questionCount?: number,
    gameType?: GameType,
    excludeIds?: string[],
    excludeQuestionKeys?: string[]
  ) {
    const response = await this.client.get<{
      gameConfig: GameConfig;
      questions: Question[];
    }>('/game/start', {
      params: { category, questionCount, gameType, excludeIds, excludeQuestionKeys },
    });
    return response.data;
  }

  async startFlashGame(category?: string) {
    const response = await this.client.get<{
      gameConfig: GameConfig & { durationSeconds?: number };
      questions: Question[];
    }>('/game/flash/start', { params: { category } });
    return response.data;
  }

  async submitFlashAnswer(data: {
    questionId: string;
    answer: string;
    combo: number;
    mechanicUsage?: MechanicUsage;
  }) {
    const response = await this.client.post<{
      isCorrect: boolean;
      correctAnswer: string;
      points: number;
      basePoints?: number;
      comboBonus?: number;
    }>('/game/answer', {
      ...data,
      timeRemaining: 0,
      gameType: 'flash',
    });
    return response.data;
  }

  async submitAnswer(data: {
    questionId: string;
    answer: string;
    timeRemaining: number;
    mechanicUsage?: MechanicUsage;
    coordinates?: { lat: number; lng: number };
  }) {
    const response = await this.client.post<{
      isCorrect: boolean;
      correctAnswer: string;
      points: number;
      basePoints?: number;
      timeBonus?: number;
      comboBonus?: number;
      accuracyBonus?: number;
      distance?: number;
    }>('/game/answer', data);
    return response.data;
  }

  async finishGame(data: {
    answers: {
      questionId: string;
      answer: string;
      timeRemaining: number;
      coordinates?: { lat: number; lng: number };
    }[];
    category?: Category;
  }) {
    const response = await this.client.post<GameResult>('/game/finish', data);
    return response.data;
  }

  async getGameHistory(limit?: number) {
    const response = await this.client.get<{ history: any[] }>('/game/history', {
      params: { limit },
    });
    return response.data.history;
  }

  // Leaderboard endpoints
  async getLeaderboard(limit?: number, scope: 'global' | 'weekly' | 'friends' = 'global') {
    const response = await this.client.get<{
      leaderboard: LeaderboardEntry[];
      totalPlayers: number;
      topScore: number | null;
      avgScore?: number | null;
      season?: string | null;
      window?: string | null;
      generatedAt?: string;
      queryMeta?: {
        requestedScope: 'global' | 'weekly' | 'friends';
        effectiveScope: 'global' | 'weekly' | 'friends';
        fallbackApplied: boolean;
      };
      userRank: { rank: number; score: number } | null;
    }>('/leaderboard', {
      params: { limit, scope },
    });
    return response.data;
  }

  async getMyRank() {
    const response = await this.client.get<{
      userRank: LeaderboardEntry | null;
      neighbors: LeaderboardEntry[];
    }>('/leaderboard/me');
    return response.data;
  }

  // Health check for cold start detection
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { baseURL: API_URL.replace('/api', ''), timeout: 30000 });
      return true;
    } catch {
      return false;
    }
  }

  // Duel history endpoints
  async getDuelHistory(period: DuelPeriod = 'all', page: number = 1, pageSize: number = 20) {
    const response = await this.client.get<{ matches: DuelMatchRecord[]; total: number }>(
      '/game/duel-history',
      { params: { period, page, pageSize } }
    );
    return response.data;
  }

  async getDuelStats() {
    const response = await this.client.get<DuelPeriodStats>('/game/duel-stats');
    return response.data;
  }

  async getDuelOpponents(search?: string) {
    const response = await this.client.get<{ opponents: DuelOpponent[] }>(
      '/game/duel-opponents',
      { params: search ? { search } : {} }
    );
    return response.data.opponents;
  }

  async getDuelH2H(opponentId: string) {
    const response = await this.client.get<HeadToHeadData>(`/game/duel-h2h/${opponentId}`);
    return response.data;
  }
}

export const api = new ApiService();
