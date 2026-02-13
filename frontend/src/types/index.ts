// User types
export interface User {
  id: string;
  username: string;
  email: string;
  preferredLanguage: 'es' | 'en';
  highScore: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Game types
export type Category = 'MAP' | 'FLAG' | 'CAPITAL' | 'SILHOUETTE' | 'MIXED';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuestionDataObject {
  country?: string;
  capital?: string;
  flagUrl?: string;
  silhouetteUrl?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// questionData can be a string (from backend) or an object
export type QuestionData = string | QuestionDataObject;

export interface Question {
  id: string;
  category: Category;
  questionText: string;
  options: string[];
  correctAnswer: string;
  difficulty?: Difficulty;
  questionData?: QuestionData;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
}

export interface Answer {
  questionId: string;
  answer: string;
  timeRemaining: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface AnswerResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string;
  points: number;
  distance?: number;
}

export interface GameConfig {
  questionsCount: number;
  timePerQuestion: number;
  category: Category;
}

export interface GameState {
  status: 'idle' | 'loading' | 'playing' | 'reviewing' | 'finished';
  questions: Question[];
  currentIndex: number;
  answers: Answer[];
  results: AnswerResult[];
  score: number;
  timeRemaining: number;
  config: GameConfig | null;
}

export interface GameResult {
  gameId: string;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  isHighScore: boolean;
  details: AnswerResult[];
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

// Duel types
export interface DuelOpponent {
  userId: string;
  username: string;
}

export interface DuelState {
  status: 'idle' | 'queued' | 'matched' | 'countdown' | 'playing' | 'finished';
  duelId: string | null;
  opponent: DuelOpponent | null;
  myScore: number;
  opponentScore: number;
  countdown: number;
}

export interface DuelResult {
  oderId: string;
  username: string;
  score: number;
  correctCount: number;
  isWinner: boolean;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
