import axios, { AxiosInstance, AxiosError } from 'axios';
import type { User, Question, GameResult, LeaderboardEntry, Category } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
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
          localStorage.removeItem('token');
          window.location.href = '/login';
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
  async startGame(category?: Category, questionCount?: number) {
    const response = await this.client.get<{
      gameConfig: {
        questionsCount: number;
        timePerQuestion: number;
        category: Category;
      };
      questions: Question[];
    }>('/game/start', {
      params: { category, questionCount },
    });
    return response.data;
  }

  async submitAnswer(data: {
    questionId: string;
    answer: string;
    timeRemaining: number;
    coordinates?: { lat: number; lng: number };
  }) {
    const response = await this.client.post<{
      isCorrect: boolean;
      correctAnswer: string;
      points: number;
      timeBonus: number;
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
  async getLeaderboard(limit?: number) {
    const response = await this.client.get<{
      leaderboard: LeaderboardEntry[];
      totalPlayers: number;
      topScore: number | null;
      userRank: { rank: number; score: number } | null;
    }>('/leaderboard', {
      params: { limit },
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
}

export const api = new ApiService();
