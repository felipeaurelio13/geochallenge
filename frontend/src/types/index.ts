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
export type Category = 'MAP' | 'FLAG' | 'CAPITAL' | 'SILHOUETTE' | 'MONUMENT' | 'CINEMA_GEO' | 'MIXED';
export type GameType = 'single' | 'streak' | 'flash' | 'practice';
export type GameplayMode = GameType | 'duel' | 'challenge';
export type DuelMode = 'classic' | 'geo-challenge';
export type CompetitiveLadder = 'CLASSIC' | 'GEO_CHALLENGE';
export type CompetitiveTier =
  | 'CALIBRATING'
  | 'EXPLORER'
  | 'PATHFINDER'
  | 'CARTOGRAPHER'
  | 'NAVIGATOR'
  | 'ATLAS_MASTER';
export type GameMechanicKey = 'intel5050' | 'focusTime' | 'streakShield';

export type GameVariant = 'CLASSIC' | 'STREAK' | 'FLASH' | 'FLAG_MASTER' | 'GEO_CHALLENGE' | 'PRACTICE' | 'EVENT_BOSS';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

// ─── GeoRetos ──────────────────────────────────────────────────────────────

export type GeoChallengeKind =
  | 'EXTREME'
  | 'HIGHER_LOWER'
  | 'COMMON_NEIGHBOR'
  | 'ODD_ONE_OUT'
  | 'NORTH_TO_SOUTH'
  | 'CAPITAL_PROXIMITY'
  | 'ORDER_BY_METRIC'
  | 'NEIGHBOR_COUNT'
  | 'BORDER_CHAIN';

export type GeoChallengeRegion = 'AFRICA' | 'AMERICAS' | 'ASIA' | 'EUROPE' | 'OCEANIA';

export type GeoChallengeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface LocalizedText {
  es: string;
  en: string;
}

export interface GeoChallengeOption {
  id: string;
  label: LocalizedText;
}

export interface GeoChallengeRound {
  id: string;
  kind: GeoChallengeKind;
  region: GeoChallengeRegion;
  difficulty: GeoChallengeDifficulty;
  prompt: LocalizedText;
  instruction: LocalizedText;
  selectionMode: 'single' | 'ordered';
  options: GeoChallengeOption[];
}

export interface GeoChallengeStartResponse {
  gameId: string;
  engineVersion: 'v2';
  sessionToken: string;
  timePerRound: number;
  dataVersion: string;
  dataUpdatedAt: string;
  rounds: GeoChallengeRound[];
}

export interface GeoChallengeAnswerResponse {
  roundId: string;
  isCorrect: boolean;
  correctOptionIds: string[];
  explanation: LocalizedText;
  points: number;
}

export interface GeoChallengeFinishResponse {
  gameId: string;
  correctCount: number;
  totalRounds: number;
  totalScore: number;
  details: Array<{ roundId: string; isCorrect: boolean }>;
}

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
  difficulty?: Difficulty;
  questionData?: QuestionData;
  imageUrl?: string;
  continent?: string;
  subregion?: string;
  isInsular?: boolean;
  isLandlocked?: boolean;
  populationTier?: string;
  areaTier?: string;
  geoChallenge?: GeoChallengeRound;
}

/** Socket.IO legacy payloads may include private fields */
export interface SocketPayloadQuestion extends PublicQuestion {
  correctAnswer?: string;
  latitude?: number;
  longitude?: number;
}

/** PublicQuestion: what the client actually receives. Never includes solution data. */
export interface PublicQuestion {
  id: string;
  category: Category;
  questionText: string;
  options: string[];
  difficulty?: Difficulty;
  questionData?: QuestionData;
  imageUrl?: string;
  continent?: string;
  subregion?: string;
  isInsular?: boolean;
  isLandlocked?: boolean;
  populationTier?: string;
  areaTier?: string;
  geoChallenge?: GeoChallengeRound;
}

export interface CategoryStat {
  category: string;
  totalGames: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  bestScore: number;
}

// ─── Flag Master ─────────────────────────────────────────────────────────────

export type FlagModifier = 'none' | 'grayscale' | 'crop' | 'similar' | 'combined';

export interface FlagMasterRound {
  id: string;
  category: 'FLAG';
  questionText: string;
  options: string[];
  difficulty: Difficulty;
  imageUrl?: string;
  questionData?: string;
  continent?: string;
  flagModifier: FlagModifier;
  multiplier: number;
  tier: number; // 1-5
  similarityGroupId?: string;
}

export interface FlagMasterStartResponse {
  gameId: string;
  totalRounds: number;
  timePerQuestion: number;
  basePoints: number;
  maxTimeBonus: number;
  rounds: FlagMasterRound[];
}

export interface FlagMasterRoundResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string;
  modifier: FlagModifier;
  multiplier: number;
  basePoints: number;
  timeBonus: number;
  modifierBonus: number;
  points: number;
  tier: number;
}

export interface FlagMasterFinishResponse {
  gameId: string;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  isHighScore: boolean;
  newAchievements: string[];
  rounds: FlagMasterRoundResult[];
  degraded?: boolean;
  message?: string;
}

export interface FlagMasterAvailability {
  canPlay: boolean;
  hardAvailable: number;
  mediumAvailable: number;
  required: number;
}

export interface DailyTourStop {
  index: number;
  region: GeoChallengeRegion;
  category: Category;
  difficulty?: Difficulty;
}

export interface DailyTourDetails {
  questionId: string;
  countryCode: string;
  category: Category;
  region: GeoChallengeRegion;
  difficulty: Difficulty | null;
  isCorrect: boolean;
  points: number;
}

export interface DailyResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  dailyStreak?: number;
  playedAt: string;
  previousStreak?: number;
  streakLost?: boolean;
  details?: DailyTourDetails[] | null;
}

export interface DailyStatus {
  today: string;
  completed: boolean;
  dailyStreak: number;
  result?: {
    score: number;
    correctCount: number;
    totalQuestions: number;
    playedAt: string;
  };
}

export interface EarnedAchievement {
  key: string;
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  icon: string;
  earnedAt: string;
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
  correctLocation?: { lat: number; lng: number };
}

export interface GameConfig {
  sessionId?: string;
  questionsCount: number;
  timePerQuestion: number;
  category: Category;
  gameType: GameType;
  mechanics?: MechanicsConfig;
  durationSeconds?: number;
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
  sessionId?: string;
  questions: PublicQuestion[];
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
  newAchievements?: string[];
  /** true cuando finishGame no pudo llegar al servidor y el resultado se guardó localmente para reintentar más tarde. */
  pendingSync?: boolean;
}

// Leaderboard types
export type LeaderboardScope = 'global' | 'season';

export type LeaderboardModeFilter = 'SINGLE' | 'DUEL' | 'CHALLENGE' | 'SURVIVAL';
export type LeaderboardCategoryFilter =
  | 'MAP'
  | 'FLAG'
  | 'CAPITAL'
  | 'SILHOUETTE'
  | 'MONUMENT'
  | 'CINEMA_GEO'
  | 'MIXED';

export type LeaderboardVariantFilter = 'CLASSIC' | 'STREAK' | 'FLASH' | 'FLAG_MASTER' | 'GEO_CHALLENGE';

export interface LeaderboardFilters {
  mode?: LeaderboardModeFilter | null;
  category?: LeaderboardCategoryFilter | null;
  variant?: LeaderboardVariantFilter | null;
  minGames?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  gamesPlayed?: number;
  bestScore?: number;
}

// Duel types
export interface DuelOpponent {
  userId: string;
  username: string;
  rating?: number;
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

export interface CompetitionLadderSummary {
  rating: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  provisional: boolean;
  placementGamesRemaining: number;
  rank: number | null;
  tier: CompetitiveTier;
}

export interface CompetitionRecentMatch {
  duelMatchId: string;
  ladder: CompetitiveLadder;
  opponent: {
    id: string;
    username: string;
  };
  result: 'win' | 'draw' | 'loss';
  ratingBefore: number;
  ratingDelta: number;
  ratingAfter: number;
  createdAt: string;
}

export interface CompetitionOverview {
  ladders: Record<CompetitiveLadder, CompetitionLadderSummary>;
  recentMatches: CompetitionRecentMatch[];
}

export interface CompetitionLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  tier: CompetitiveTier;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface CompetitionLeaderboardResponse {
  ladder: CompetitiveLadder;
  leaderboard: CompetitionLeaderboardEntry[];
  me: CompetitionLadderSummary;
}

export type DuelRatingEvent =
  | {
      status: 'updated';
      ladder: CompetitiveLadder;
      ratingBefore: number;
      ratingDelta: number;
      ratingAfter: number;
      peakRating: number;
      gamesPlayed: number;
      provisional: boolean;
      placementGamesRemaining: number;
      tier: CompetitiveTier;
    }
  | {
      status: 'not-rated';
    };

// Survival types
export interface SurvivalPlayerInfo {
  userId: string;
  username: string;
  lives: number;
  streak: number;
  score: number;
  eliminated?: boolean;
  eliminatedRound?: number | null;
}

export interface SurvivalPlayerResult {
  userId: string;
  username: string;
  isCorrect: boolean;
  isTimeout: boolean;
  livesChange: number;
  newLives: number;
  lifeEarnedReason?: string;
  eliminatedThisRound: boolean;
  score: number;
  streak: number;
}

export interface SurvivalRanking {
  userId: string;
  username: string;
  finalRank: number;
  score: number;
  correctCount: number;
  eliminatedRound: number | null;
}

export interface SurvivalState {
  status: 'idle' | 'queued' | 'filling' | 'countdown' | 'playing' | 'spectating' | 'finished';
  matchId: string | null;
  category: Category | null;
  players: SurvivalPlayerInfo[];
  fillTimeRemaining: number;
  countdown: number;
  currentRound: number;
  currentQuestion: Question | null;
  difficulty: Difficulty | null;
  timeLimit: number;
  rankings: SurvivalRanking[];
  totalRounds: number;
  finishReason: string | null;
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

// Distinto de DuelOpponent (matchmaking): este es el resumen para stats/head-to-head.
// OJO: antes ambos se llamaban DuelOpponent y TS fusionaba las declaraciones.
export interface DuelOpponentSummary {
  id: string;
  username: string;
  totalMatches: number;
}

export interface HeadToHeadData {
  opponent: DuelOpponentSummary;
  periods: DuelPeriodStats;
  recentMatches: DuelMatchRecord[];
}

// ─── Mastery / Passport ────────────────────────────────────────────────────

export type MasteryLevel = 'UNSEEN' | 'LEARNING' | 'FAMILIAR' | 'STRONG' | 'MASTERED';

export interface SkillMastery {
  category: Category;
  availableQuestions: number;
  attempts: number;
  correct: number;
  accuracy: number;
  masteryScore: number;
  level: MasteryLevel;
}

export interface CountryMastery {
  countryCode: string;
  name: string;
  continent: string;
  stamped: boolean;
  mastered: boolean;
  score: number;
  attempts: number;
  correct: number;
  skills: SkillMastery[];
}

export interface MasterySummary {
  worldProgressPercent: number;
  totalCountries: number;
  stampedCountries: number;
  masteredCountries: number;
  skills: {
    category: Category;
    attempts: number;
    correct: number;
    accuracy: number;
    masteryScore: number;
  }[];
}

export interface PassportResponse {
  summary: MasterySummary;
  countries: CountryMastery[];
}

export interface AdaptivePracticeStartResponse {
  sessionId: string;
  questions: PublicQuestion[];
  gameConfig: GameConfig;
}

// ─── World Event ─────────────────────────────────────────────────────────────

export type WorldEventRegion = 'AFRICA' | 'AMERICAS' | 'ASIA' | 'EUROPE' | 'OCEANIA';

export interface WorldEventInfo {
  eventId: string;
  version: string;
  region: WorldEventRegion;
  startsAt: string;
  endsAt: string;
}

export interface WorldEventProgress {
  correctInRegion: number;
  correctRequired: number;
  distinctCategories: number;
  categoriesRequired: number;
  dailyCompleted: boolean;
  bossUnlocked: boolean;
}

export interface WorldEventBossStatus {
  unlocked: boolean;
  cleared: boolean;
  attempts: number;
  bestCorrect: number;
  bestScore: number;
  activeAttempt: {
    id: string;
    currentQuestionIndex: number;
    expiresAt: string;
  } | null;
}

export interface WorldEventCurrentResponse {
  event: WorldEventInfo;
  progress: WorldEventProgress;
  boss: WorldEventBossStatus;
  serverNow: string;
}

export interface WorldEventBossQuestion {
  questionId: string;
  category: Category;
  questionText: string;
  options: string[];
  imageUrl: string | null;
  questionData: string;
  difficulty: Difficulty | null;
}

export interface WorldEventBossStartResponse {
  resumed: boolean;
  attemptId: string;
  eventId: string;
  region: WorldEventRegion;
  questionIndex: number;
  totalQuestions: number;
  correctCount: number;
  score: number;
  expiresAt: string;
  question: WorldEventBossQuestion;
  timeLimit: number;
  boss: {
    hitsRequired: number;
    hits: number;
  };
}

export interface WorldEventBossAnswerResponse {
  questionId: string;
  isCorrect: boolean;
  points: number;
  correctAnswer: string;
  questionIndex: number;
  nextQuestionIndex: number;
  correctCount: number;
  score: number;
  totalQuestions: number;
  isFinal: boolean;
  cleared?: boolean;
}
