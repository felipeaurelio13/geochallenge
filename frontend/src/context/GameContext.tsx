import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../services/api';
import type { GameState, Answer, AnswerResult, GameResult, Category, Question } from '../types';

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

// Check if in dev mode
const isDevMode = () => localStorage.getItem('devMode') === 'true';

// Sample questions for dev mode
const DEV_QUESTIONS: Question[] = [
  {
    id: 'dev-1',
    category: 'FLAG',
    questionText: '¿A qué país pertenece esta bandera?',
    options: ['Chile', 'Argentina', 'Peru', 'Colombia'],
    correctAnswer: 'Chile',
    difficulty: 'EASY',
    questionData: 'Chile',
    imageUrl: 'https://flagcdn.com/w320/cl.png',
  },
  {
    id: 'dev-2',
    category: 'CAPITAL',
    questionText: '¿Cuál es la capital de Francia?',
    options: ['París', 'Lyon', 'Marsella', 'Burdeos'],
    correctAnswer: 'París',
    difficulty: 'EASY',
    questionData: 'Francia',
  },
  {
    id: 'dev-3',
    category: 'MAP',
    questionText: '¿Dónde está Tokyo?',
    options: [],
    correctAnswer: 'Japan',
    difficulty: 'MEDIUM',
    questionData: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
  },
  {
    id: 'dev-4',
    category: 'FLAG',
    questionText: '¿A qué país pertenece esta bandera?',
    options: ['Brasil', 'Portugal', 'España', 'Italia'],
    correctAnswer: 'Brasil',
    difficulty: 'EASY',
    questionData: 'Brasil',
    imageUrl: 'https://flagcdn.com/w320/br.png',
  },
  {
    id: 'dev-5',
    category: 'CAPITAL',
    questionText: '¿Cuál es la capital de Japón?',
    options: ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya'],
    correctAnswer: 'Tokyo',
    difficulty: 'EASY',
    questionData: 'Japón',
  },
  {
    id: 'dev-6',
    category: 'FLAG',
    questionText: '¿A qué país pertenece esta bandera?',
    options: ['México', 'Italia', 'Irlanda', 'Hungría'],
    correctAnswer: 'México',
    difficulty: 'MEDIUM',
    questionData: 'México',
    imageUrl: 'https://flagcdn.com/w320/mx.png',
  },
  {
    id: 'dev-7',
    category: 'CAPITAL',
    questionText: '¿Cuál es la capital de Australia?',
    options: ['Canberra', 'Sydney', 'Melbourne', 'Brisbane'],
    correctAnswer: 'Canberra',
    difficulty: 'MEDIUM',
    questionData: 'Australia',
  },
  {
    id: 'dev-8',
    category: 'MAP',
    questionText: '¿Dónde está París?',
    options: [],
    correctAnswer: 'France',
    difficulty: 'EASY',
    questionData: 'París',
    latitude: 48.8566,
    longitude: 2.3522,
  },
  {
    id: 'dev-9',
    category: 'FLAG',
    questionText: '¿A qué país pertenece esta bandera?',
    options: ['Canadá', 'Estados Unidos', 'Reino Unido', 'Australia'],
    correctAnswer: 'Canadá',
    difficulty: 'EASY',
    questionData: 'Canadá',
    imageUrl: 'https://flagcdn.com/w320/ca.png',
  },
  {
    id: 'dev-10',
    category: 'CAPITAL',
    questionText: '¿Cuál es la capital de Egipto?',
    options: ['El Cairo', 'Alejandría', 'Luxor', 'Asuán'],
    correctAnswer: 'El Cairo',
    difficulty: 'MEDIUM',
    questionData: 'Egipto',
  },
];

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

    // Dev mode - use sample questions
    if (isDevMode()) {
      // Shuffle and pick 10 questions
      const shuffled = [...DEV_QUESTIONS].sort(() => Math.random() - 0.5);
      setState({
        status: 'playing',
        questions: shuffled,
        currentIndex: 0,
        answers: [],
        results: [],
        score: 0,
        timeRemaining: 10,
        config: {
          questionsCount: 10,
          timePerQuestion: 10,
          category: category || 'MIXED',
        },
      });
      return;
    }

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

      // Dev mode - calculate locally
      if (isDevMode()) {
        let isCorrect = false;
        let points = 0;

        if (currentQuestion.category === 'MAP' && coordinates && currentQuestion.latitude && currentQuestion.longitude) {
          // Calculate distance (simplified)
          const R = 6371;
          const dLat = ((currentQuestion.latitude - coordinates.lat) * Math.PI) / 180;
          const dLon = ((currentQuestion.longitude - coordinates.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((coordinates.lat * Math.PI) / 180) *
              Math.cos((currentQuestion.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          isCorrect = distance < 500;
          points = isCorrect ? Math.max(0, Math.round(150 - distance / 10)) : 0;
        } else {
          isCorrect = answer.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
          const basePoints = 100;
          const timeBonus = Math.round((timeRemaining / 10) * 50);
          points = isCorrect ? basePoints + timeBonus : 0;
        }

        const answerResult: AnswerResult = {
          questionId: currentQuestion.id,
          isCorrect,
          correctAnswer: currentQuestion.correctAnswer,
          userAnswer: answer,
          points,
        };

        setState((prev) => ({
          ...prev,
          status: 'reviewing',
          answers: [...prev.answers, newAnswer],
          results: [...prev.results, answerResult],
          score: prev.score + points,
        }));

        return answerResult;
      }

      // Submit to API
      const result = await api.submitAnswer(newAnswer);

      const answerResult: AnswerResult = {
        questionId: currentQuestion.id,
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        userAnswer: answer,
        points: result.points,
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
    // Dev mode - return local result
    if (isDevMode()) {
      const totalScore = state.results.reduce((sum, r) => sum + r.points, 0);
      const correctCount = state.results.filter((r) => r.isCorrect).length;
      return {
        gameId: 'dev-game-' + Date.now(),
        totalScore,
        correctCount,
        totalQuestions: state.questions.length,
        accuracy: Math.round((correctCount / state.questions.length) * 100),
        isHighScore: false,
        details: state.results,
      };
    }

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
