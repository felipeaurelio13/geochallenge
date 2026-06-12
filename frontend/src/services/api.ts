import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  User,
  Question,
  GameResult,
  LeaderboardEntry,
  LeaderboardScope,
  Category,
  GameType,
  GameConfig,
  MechanicUsage,
  DuelMatchRecord,
  DuelPeriodStats,
  DuelOpponentSummary,
  HeadToHeadData,
  DuelPeriod,
  GameFilters,
  CategoryStat,
  DailyResult,
  EarnedAchievement,
  FlagMasterStartResponse,
  FlagMasterFinishResponse,
  FlagMasterAvailability,
} from '../types';
import { filtersToParams } from '../types';
import { testAuthBypass } from '../utils/testAuthBypass';
import { toAppPath } from '../utils/routing';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Reintentos para GETs idempotentes: el backend en Render free tier tiene
// cold starts de ~30s, así que un timeout o 502/503/504 transitorio no debe
// romper la experiencia. Backoff exponencial: 1s, 2s, 4s.
const MAX_GET_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

type RetryableConfig = InternalAxiosRequestConfig & { _retryCount?: number };

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
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          const isAuthPage = [toAppPath('/login'), toAppPath('/register')].includes(window.location.pathname);
          const hasBypass = testAuthBypass.isEnabled && testAuthBypass.isConfigured;
          if (!isAuthPage && !hasBypass) {
            localStorage.removeItem('token');
            window.location.href = toAppPath('/login');
          }
        }

        const config = error.config as RetryableConfig | undefined;
        const isTransient =
          !error.response || error.code === 'ECONNABORTED' || RETRYABLE_STATUS.has(error.response.status);
        const canRetry =
          config?.method === 'get' &&
          isTransient &&
          navigator.onLine !== false &&
          (config._retryCount ?? 0) < MAX_GET_RETRIES;

        if (config && canRetry) {
          config._retryCount = (config._retryCount ?? 0) + 1;
          const delay = RETRY_BASE_DELAY_MS * 2 ** (config._retryCount - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client.request(config);
        }

        if (error.code === 'ECONNABORTED') {
          return Promise.reject(new Error('La solicitud tardó demasiado. Verifica tu conexión.'));
        }
        if (!error.response) {
          return Promise.reject(new Error('Sin conexión a internet. Verifica tu red.'));
        }

        const responseData = error.response.data as { error?: string; message?: string } | undefined;
        const isShortGameAvailabilityError =
          typeof responseData?.error === 'string' &&
          typeof (responseData as { available?: unknown }).available === 'number' &&
          typeof (responseData as { requested?: unknown }).requested === 'number';

        if (isShortGameAvailabilityError) {
          return Promise.reject(error);
        }

        const backendMessage = responseData?.error || responseData?.message;
        if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
          return Promise.reject(new Error(backendMessage));
        }

        return Promise.reject(error);
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
    excludeQuestionKeys?: string[],
    filters?: GameFilters,
    acceptShortGame?: boolean
  ) {
    const response = await this.client.get<{
      gameConfig: GameConfig;
      questions: Question[];
    }>('/game/start', {
      params: { category, questionCount, gameType, excludeIds, excludeQuestionKeys, ...filtersToParams(filters), acceptShortGame },
    });
    return response.data;
  }

  async startFlashGame(category?: string, filters?: GameFilters) {
    const response = await this.client.get<{
      gameConfig: GameConfig & { durationSeconds?: number };
      questions: Question[];
    }>('/game/flash/start', { params: { category, ...filtersToParams(filters) } });
    return response.data;
  }

  async getGameAvailability(category?: Category, questionCount?: number, filters?: GameFilters) {
    const response = await this.client.get<{
      available: number;
      required: number;
      canPlay: boolean;
    }>('/game/availability', {
      params: { category, questionCount, ...filtersToParams(filters) },
    });
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
    gameType?: GameType;
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
  async getLeaderboard(
    limit?: number,
    scope: LeaderboardScope = 'global',
    filters?: import('../types').LeaderboardFilters
  ) {
    const response = await this.client.get<{
      leaderboard: LeaderboardEntry[];
      totalPlayers: number;
      topScore: number | null;
      avgScore?: number | null;
      season?: string | null;
      window?: string | null;
      generatedAt?: string;
      scope: LeaderboardScope;
      metric?: 'sum' | 'best';
      filters?: {
        mode: import('../types').LeaderboardModeFilter | null;
        category: import('../types').LeaderboardCategoryFilter | null;
        minGames: number;
      };
      queryMeta?: {
        requestedScope: LeaderboardScope;
        effectiveScope: LeaderboardScope;
        fallbackApplied: boolean;
      };
      userRank: { rank: number; score: number } | null;
    }>('/leaderboard', {
      params: {
        limit,
        scope,
        ...(filters?.mode ? { mode: filters.mode } : {}),
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.minGames && filters.minGames > 1 ? { minGames: filters.minGames } : {}),
      },
    });
    return response.data;
  }

  async getMyRank(
    scope: LeaderboardScope = 'global',
    filters?: import('../types').LeaderboardFilters
  ) {
    const response = await this.client.get<{
      userRank: LeaderboardEntry | null;
      neighbors: LeaderboardEntry[];
      scope: LeaderboardScope;
    }>('/leaderboard/me', {
      params: {
        scope,
        ...(filters?.mode ? { mode: filters.mode } : {}),
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.minGames && filters.minGames > 1 ? { minGames: filters.minGames } : {}),
      },
    });
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
    const response = await this.client.get<{ opponents: DuelOpponentSummary[] }>(
      '/game/duel-opponents',
      { params: search ? { search } : {} }
    );
    return response.data.opponents;
  }

  async getDuelH2H(opponentId: string) {
    const response = await this.client.get<HeadToHeadData>(`/game/duel-h2h/${opponentId}`);
    return response.data;
  }

  async getCategoryStats() {
    const response = await this.client.get<{ stats: CategoryStat[] }>('/game/category-stats');
    return response.data.stats;
  }

  async getDaily() {
    const response = await this.client.get<{
      questions: Question[];
      today: string;
      alreadyPlayed: boolean;
      result?: DailyResult;
    }>('/game/daily');
    return response.data;
  }

  async submitDaily(data: { answers: Array<{ questionId: string; answer: string }> }) {
    const response = await this.client.post<{
      result: DailyResult;
      newAchievements: string[];
      message: string;
    }>('/game/daily/submit', data);
    return response.data;
  }

  async getAchievements() {
    const response = await this.client.get<{ achievements: EarnedAchievement[] }>('/game/achievements');
    return response.data.achievements;
  }

  // ─── Flag Master ──────────────────────────────────────────────────────────

  async startFlagMaster() {
    const response = await this.client.post<FlagMasterStartResponse>('/game/flag-master/start');
    return response.data;
  }

  async finishFlagMaster(data: {
    gameId: string;
    answers: { questionId: string; answer: string; timeRemaining: number }[];
  }) {
    const response = await this.client.post<FlagMasterFinishResponse>(
      '/game/flag-master/finish',
      data
    );
    return response.data;
  }

  async getFlagMasterAvailability() {
    const response = await this.client.get<FlagMasterAvailability>(
      '/game/flag-master/availability'
    );
    return response.data;
  }
}

export const api = new ApiService();
