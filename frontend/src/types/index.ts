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
export type GameType = 'single' | 'streak' | 'flash';
export type GameplayMode = GameType | 'duel' | 'challenge';
export type GameMechanicKey = 'intel5050' | 'focusTime' | 'streakShield';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GameFilters {
  continent?: string;
  isInsular?: boolean;
  isLandlocked?: boolean;
  difficulty?: Difficulty;
}

export function hasActiveFilters(f?: GameFilters): boolean {
  if (!f) return false;
  return !!(f.continent || f.isInsular || f.isLandlocked || f.difficulty);
}

export function filtersToParams(f?: GameFilters): Record<string, string> {
  if (!f) return {};
  const p: Record<string, string> = {};
  if (f.continent) p.continent = f.continent;
  if (f.isInsular) p.isInsular = 'true';
  if (f.isLandlocked) p.isLandlocked = 'true';
  if (f.difficulty) p.difficulty = f.difficulty;
  return p;
}

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
  mechanicUsage?: MechanicUsage;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface MechanicUsage {
  key: GameMechanicKey;
  action: 'trigger';
  questionId?: string;
  roundIndex?: number;
  value?: number;
}

export interface AnswerResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string;
  points: number;
  basePoints?: number;
  timeBonus?: number;
  comboBonus?: number;
  accuracyBonus?: number;
  distance?: number;
}

export interface GameConfig {
  questionsCount: number;
  timePerQuestion: number;
  category: Category;
  gameType: GameType;
  mechanics?: MechanicsConfig;
}

export interface MechanicsConfig {
  enabled: boolean;
  allowed: GameMechanicKey[];
  limits: Partial<Record<GameMechanicKey, number>>;
}

export interface MechanicsState {
  disabledOptionIndexes: number[];
  available: Record<GameMechanicKey, number>;
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
  isOffline?: boolean;
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
  userId: string;
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

// Duel history types
export interface DuelMatchRecord {
  id: string;
  opponentId: string;
  opponentUsername: string;
  result: 'win' | 'loss' | 'draw';
  myScore: number;
  opponentScore: number;
  category?: Category;
  createdAt: string;
}

export interface DuelStats {
  wins: number;
  draws: number;
  losses: number;
  total: number;
}

export type DuelPeriod = 'week' | 'month' | 'year' | 'all';

export interface DuelPeriodStats {
  week: DuelStats;
  month: DuelStats;
  year: DuelStats;
  all: DuelStats;
}

export interface DuelOpponent {
  id: string;
  username: string;
  totalMatches: number;
}

export interface HeadToHeadData {
  opponent: DuelOpponent;
  periods: DuelPeriodStats;
  recentMatches: DuelMatchRecord[];
}
