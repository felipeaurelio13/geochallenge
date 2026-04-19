import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../services/api';
import type {
  GameState,
  Answer,
  AnswerResult,
  GameResult,
  Category,
  Question,
  GameType,
  MechanicUsage,
} from '../types';
import { cacheQuestions, getCachedQuestions, enqueuePendingSession } from '../hooks/useOfflineQuestions';

interface GameContextType {
  state: GameState;
  streakAlive: boolean;
  startGame: (category?: Category, questionCount?: number, gameType?: GameType) => Promise<void>;
  appendQuestions: (questions: Question[]) => void;
  setStreakAlive: (isAlive: boolean) => void;
  submitAnswer: (
    answer: string,
    coordinates?: { lat: number; lng: number },
    mechanicUsage?: MechanicUsage
  ) => Promise<AnswerResult>;
  nextQuestion: () => void;
  finishGame: () => Promise<GameResult>;
  resetGame: () => void;
  setTimeRemaining: (time: number) => void;
}

const initialState: GameState = {
  status: 'idle',
  questions: [],
  currentIndex: 0,
  answers: [],
  results: [],
  score: 0,
  timeRemaining: 10,
  config: null,
  isOffline: false,
};

const OFFLINE_FALLBACK_MIN_QUESTIONS = 10;

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const [streakAlive, setStreakAlive] = useState(true);
  const timerRef = useRef<number | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startGame = useCallback(async (category?: Category, questionCount?: number, gameType?: GameType) => {
    setState((prev) => ({ ...prev, status: 'loading' }));
    const resolvedCategory = (category ?? 'MIXED') as Category;
    const desiredCount = questionCount ?? 10;
    const modeOfflineEligible = gameType !== 'flash'; // flash requires server-side 60s feed

    const fallbackToOfflineCache = async (): Promise<boolean> => {
      if (!modeOfflineEligible) return false;
      const cached = await getCachedQuestions(resolvedCategory, desiredCount);
      if (cached.length < OFFLINE_FALLBACK_MIN_QUESTIONS) return false;
      setState({
        status: 'playing',
        questions: cached,
        currentIndex: 0,
        answers: [],
        results: [],
        score: 0,
        timeRemaining: 10,
        config: {
          questionsCount: cached.length,
          timePerQuestion: 10,
          category: resolvedCategory,
          gameType: (gameType ?? 'single') as GameType,
        },
        isOffline: true,
      });
      setStreakAlive(true);
      return true;
    };

    if (!isOnline() && modeOfflineEligible) {
      const served = await fallbackToOfflineCache();
      if (served) return;
    }

    try {
      const response = await api.startGame(category, questionCount, gameType);

      setState({
        status: 'playing',
        questions: response.questions,
        currentIndex: 0,
        answers: [],
        results: [],
        score: 0,
        timeRemaining: response.gameConfig.timePerQuestion,
        config: response.gameConfig,
        isOffline: false,
      });
      setStreakAlive(true);

      // cache for future offline use (fire-and-forget)
      if (modeOfflineEligible && response.questions?.length) {
        cacheQuestions(resolvedCategory, response.questions).catch(() => {
          // noop: cache failures must not affect gameplay
        });
      }
    } catch (error) {
      if (modeOfflineEligible) {
        const served = await fallbackToOfflineCache();
        if (served) return;
      }
      setState((prev) => ({ ...prev, status: 'idle' }));
      throw error;
    }
  }, []);

  const appendQuestions = useCallback((questions: Question[]) => {
    if (!questions.length) return;
    setState((prev) => ({
      ...prev,
      questions: [...prev.questions, ...questions],
    }));
  }, []);

  const submitAnswer = useCallback(
    async (
      answer: string,
      coordinates?: { lat: number; lng: number },
      mechanicUsage?: MechanicUsage
    ): Promise<AnswerResult> => {
      const { questions, currentIndex, timeRemaining, isOffline } = stateRef.current;
      const currentQuestion = questions[currentIndex];

      // Save answer locally
      const newAnswer: Answer = {
        questionId: currentQuestion.id,
        answer,
        timeRemaining,
        mechanicUsage,
        coordinates,
      };

      let answerResult: AnswerResult;

      if (isOffline || !isOnline()) {
        // Local-only validation (cannot contact server)
        const isCorrect =
          answer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
        answerResult = {
          questionId: currentQuestion.id,
          isCorrect,
          correctAnswer: currentQuestion.correctAnswer,
          userAnswer: answer,
          points: isCorrect ? 100 : 0,
          basePoints: isCorrect ? 100 : 0,
          timeBonus: 0,
        };
      } else {
        const result = await api.submitAnswer(newAnswer);
        answerResult = {
          questionId: currentQuestion.id,
          isCorrect: result.isCorrect,
          correctAnswer: result.correctAnswer,
          userAnswer: answer,
          points: result.points,
          basePoints: result.basePoints,
          timeBonus: result.timeBonus,
          comboBonus: result.comboBonus,
          accuracyBonus: result.accuracyBonus,
          distance: result.distance,
        };
      }

      setState((prev) => ({
        ...prev,
        status: 'reviewing',
        answers: [...prev.answers, newAnswer],
        results: [...prev.results, answerResult],
        score: prev.score + answerResult.points,
      }));

      return answerResult;
    },
    []
  );

  const nextQuestion = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentIndex + 1;

      if (nextIndex >= prev.questions.length) {
        return { ...prev, status: 'finished' };
      }

      return {
        ...prev,
        status: 'playing',
        currentIndex: nextIndex,
        timeRemaining: prev.config?.timePerQuestion || 10,
      };
    });
  }, []);

  const finishGame = useCallback(async (): Promise<GameResult> => {
    const { answers, config, isOffline, results, score } = stateRef.current;

    if (isOffline || !isOnline()) {
      // Queue for later sync; return a local-only summary
      if (config?.category) {
        enqueuePendingSession({
          category: config.category,
          answers,
          finishedAt: Date.now(),
        });
      }
      const correctCount = results.filter((r) => r.isCorrect).length;
      const totalQuestions = results.length || answers.length || 1;
      return {
        gameId: `offline-${Date.now()}`,
        totalScore: score,
        correctCount,
        totalQuestions,
        accuracy: Math.round((correctCount / totalQuestions) * 100),
        isHighScore: false,
        details: results,
      };
    }

    const result = await api.finishGame({
      answers,
      category: config?.category,
    });

    return result;
  }, []);

  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStreakAlive(true);
    setState(initialState);
  }, []);

  const setTimeRemaining = useCallback((time: number) => {
    setState((prev) => ({ ...prev, timeRemaining: Math.max(0, time) }));
  }, []);

  return (
    <GameContext.Provider
      value={{
        state,
        streakAlive,
        startGame,
        appendQuestions,
        setStreakAlive,
        submitAnswer,
        nextQuestion,
        finishGame,
        resetGame,
        setTimeRemaining,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
