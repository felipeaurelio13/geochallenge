import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../services/api';
import type { GameState, Answer, AnswerResult, GameResult, Category } from '../types';

interface GameContextType {
  state: GameState;
  startGame: (category?: Category) => Promise<void>;
  submitAnswer: (answer: string, coordinates?: { lat: number; lng: number }) => Promise<AnswerResult>;
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
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const timerRef = useRef<number | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startGame = useCallback(async (category?: Category) => {
    setState((prev) => ({ ...prev, status: 'loading' }));

    try {
      const response = await api.startGame(category);

      setState({
        status: 'playing',
        questions: response.questions,
        currentIndex: 0,
        answers: [],
        results: [],
        score: 0,
        timeRemaining: response.gameConfig.timePerQuestion,
        config: response.gameConfig,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, status: 'idle' }));
      throw error;
    }
  }, []);

  const submitAnswer = useCallback(
    async (answer: string, coordinates?: { lat: number; lng: number }): Promise<AnswerResult> => {
      const currentQuestion = state.questions[state.currentIndex];
      const timeRemaining = state.timeRemaining;

      // Save answer locally
      const newAnswer: Answer = {
        questionId: currentQuestion.id,
        answer,
        timeRemaining,
        coordinates,
      };

      // Submit to API
      const result = await api.submitAnswer(newAnswer);

      const answerResult: AnswerResult = {
        questionId: currentQuestion.id,
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        userAnswer: answer,
        points: result.points,
        distance: result.distance,
      };

      setState((prev) => ({
        ...prev,
        status: 'reviewing',
        answers: [...prev.answers, newAnswer],
        results: [...prev.results, answerResult],
        score: prev.score + result.points,
      }));

      return answerResult;
    },
    [state.questions, state.currentIndex, state.timeRemaining]
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
    const result = await api.finishGame({
      answers: state.answers,
      category: state.config?.category,
    });

    return result;
  }, [state.answers, state.config?.category, state.results, state.questions.length]);

  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState(initialState);
  }, []);

  const setTimeRemaining = useCallback((time: number) => {
    setState((prev) => ({ ...prev, timeRemaining: Math.max(0, time) }));
  }, []);

  return (
    <GameContext.Provider
      value={{
        state,
        startGame,
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
