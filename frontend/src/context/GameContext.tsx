import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import type {
  Answer,
  AnswerResult,
  Category,
  GameFilters,
  GameResult,
  GameState,
  GameType,
  MechanicUsage,
  Question,
} from '../types';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { clampTimeRemainingForScoring, getQuestionDuration } from '../utils/questionTiming';
import i18n from 'i18next';

interface GameContextType {
  state: GameState;
  streakAlive: boolean;
  startGame: (category?: Category, questionCount?: number, gameType?: GameType, filters?: GameFilters, acceptShortGame?: boolean) => Promise<void>;
  startPractice: (countryCode?: string) => Promise<void>;
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
  /** Devuelve true si el reemplazo llegó con éxito, false si también falló (ver QuestionCard retry/skip UI). */
  replaceCurrentQuestion: (filters?: GameFilters) => Promise<boolean>;
  /**
   * Achievements newly unlocked by the most recent `finishGame()` call.
   * Populated even though `GamePage` (owned separately) discards the
   * `finishGame()` return value — `ResultsPage` reads it from here instead
   * of requiring a prop/navigation-state plumbing change in `GamePage`.
   */
  lastNewAchievements: string[];
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
};

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const [streakAlive, setStreakAlive] = useState(true);
  const [lastNewAchievements, setLastNewAchievements] = useState<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Timing server-authoritative: avisa al backend cuando una pregunta pasa a
  // ser la actual (incluye la primera y las posteriores, y el reemplazo
  // in-place de replaceCurrentQuestion porque cambia la referencia del array).
  // Best-effort: si no hay sesión o el request falla, el servidor usa el
  // primer answer como inicio (ventana completa) — nunca afecta el gameplay.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const question = state.questions[state.currentIndex];
    if (!question) return;
    const sessionId = state.sessionId ?? state.config?.sessionId;
    if (!sessionId) return;
    void api.notifyQuestionStarted(question.id, sessionId);
  }, [
    state.status,
    state.currentIndex,
    state.questions,
    state.sessionId,
    state.config?.sessionId,
  ]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startGame = useCallback(async (category?: Category, questionCount?: number, gameType?: GameType, filters?: GameFilters, acceptShortGame?: boolean) => {
    setState((prev) => ({ ...prev, status: 'loading' }));
    if (!isOnline()) {
      setState((prev) => ({ ...prev, status: 'idle' }));
      throw new Error(i18n.t('game.connectionRequired'));
    }

    try {
      const response = await api.startGame(category, questionCount, gameType, undefined, undefined, filters, acceptShortGame);

      setState({
        status: 'playing',
        sessionId: response.sessionId,
        questions: response.questions,
        currentIndex: 0,
        answers: [],
        results: [],
        score: 0,
        timeRemaining: getQuestionDuration(response.questions?.[0]?.category, response.gameConfig.timePerQuestion),
        config: {
          ...response.gameConfig,
          sessionId: response.sessionId,
        },
      });
      setStreakAlive(true);
    } catch (error) {
      setState((prev) => ({ ...prev, status: 'idle' }));
      throw error;
    }
  }, []);

  const startPractice = useCallback(async (countryCode?: string) => {
    setState((prev) => ({ ...prev, status: 'loading' }));

    try {
      const response = await api.startAdaptivePractice(countryCode);

      setState({
        status: 'playing',
        sessionId: response.sessionId,
        questions: response.questions,
        currentIndex: 0,
        answers: [],
        results: [],
        score: 0,
        timeRemaining: getQuestionDuration(response.questions?.[0]?.category, response.gameConfig.timePerQuestion),
        config: {
          ...response.gameConfig,
          sessionId: response.sessionId,
          gameType: 'practice',
        },
      });
      setStreakAlive(true);
    } catch (error) {
      setState((prev) => ({ ...prev, status: 'idle' }));
      throw error;
    }
  }, []);

  const appendQuestions = useCallback((questions: Question[]) => {
    if (!questions.length) return;
    setState((prev) => {
      const existingIds = new Set(prev.questions.map((q) => q.id));
      const newQuestions = questions.filter((q) => !existingIds.has(q.id));
      if (!newQuestions.length) return prev;
      return { ...prev, questions: [...prev.questions, ...newQuestions] };
    });
  }, []);

  const submitAnswer = useCallback(
    async (
      answer: string,
      coordinates?: { lat: number; lng: number },
      mechanicUsage?: MechanicUsage
    ): Promise<AnswerResult> => {
      const { questions, currentIndex, timeRemaining, config } = stateRef.current;
      const currentQuestion = questions[currentIndex];
      const baseDuration = config?.timePerQuestion ?? 10;

      // Clamp the reported remaining time to the backend scoring window.
      const reportedTimeRemaining = clampTimeRemainingForScoring(
        currentQuestion?.category,
        timeRemaining,
        baseDuration,
      );

      // Save answer locally
      const newAnswer: Answer = {
        questionId: currentQuestion.id,
        answer,
        timeRemaining: reportedTimeRemaining,
        mechanicUsage,
        coordinates,
      };

      if (!isOnline()) throw new Error(i18n.t('game.connectionRequired'));
      const sessionId = stateRef.current.sessionId ?? stateRef.current.config?.sessionId;
      const result = await api.submitAnswer({
        sessionId,
        questionId: currentQuestion.id,
        answer,
        timeRemaining: reportedTimeRemaining,
        mechanicUsage,
        coordinates,
      });
      const answerResult: AnswerResult = {
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
        correctLocation: (result as { correctLocation?: { lat: number; lng: number } }).correctLocation,
      };

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

      const baseDuration = prev.config?.timePerQuestion || 10;
      return {
        ...prev,
        status: 'playing',
        currentIndex: nextIndex,
        timeRemaining: getQuestionDuration(prev.questions[nextIndex]?.category, baseDuration),
      };
    });
  }, []);

  const replaceCurrentQuestion = useCallback(async (filters?: GameFilters): Promise<boolean> => {
    const { questions, currentIndex, config } = stateRef.current;
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion || !isOnline()) return false;

    try {
      const response = await api.startGame(
        currentQuestion.category as Category,
        1,
        (config?.gameType ?? 'single') as GameType,
        questions.map((q) => q.id),
        [],
        filters
      );
      const replacement = response.questions?.[0];
      if (!replacement) return false;

      setState((prev) => {
        const updated = [...prev.questions];
        updated[prev.currentIndex] = replacement;
        return {
          ...prev,
          questions: updated,
          timeRemaining: getQuestionDuration(replacement.category, prev.config?.timePerQuestion ?? 10),
        };
      });
      return true;
    } catch {
      // El llamador (GamePage) decide qué mostrar cuando el reemplazo también falla:
      // pausa el timer y ofrece Reintentar/Saltar en vez de dejar la pregunta en blanco.
      return false;
    }
  }, []);

  const finishGame = useCallback(async (): Promise<GameResult> => {
    const { answers, config } = stateRef.current;
    if (!isOnline()) throw new Error(i18n.t('game.connectionRequired'));
    const sessionId = stateRef.current.sessionId ?? stateRef.current.config?.sessionId;
    const result = await api.finishGame({ sessionId, answers, category: config?.category, gameType: config?.gameType });
    setLastNewAchievements(result.newAchievements ?? []);
    return result;
  }, []);

  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStreakAlive(true);
    setLastNewAchievements([]);
    setState(initialState);
  }, []);

  const setTimeRemaining = useCallback((time: number) => {
    setState((prev) => ({ ...prev, timeRemaining: Math.max(0, time) }));
  }, []);

  const allImageUrls = useMemo(
    () => state.questions.map((q) => q.imageUrl ?? ''),
    [state.questions]
  );
  useImagePreloader(allImageUrls); // skip=1 default: Q1 ya carga via eager img tag

  return (
    <GameContext.Provider
      value={{
        state,
        streakAlive,
        startGame,
        startPractice,
        appendQuestions,
        setStreakAlive,
        submitAnswer,
        nextQuestion,
        finishGame,
        resetGame,
        setTimeRemaining,
        replaceCurrentQuestion,
        lastNewAchievements,
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
