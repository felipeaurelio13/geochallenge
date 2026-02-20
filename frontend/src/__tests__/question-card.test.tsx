import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionCard } from '../components/QuestionCard';
import type { Question } from '../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === 'game.questionCapital') {
        return `¿Cuál es la capital de ${vars?.country ?? ''}?`;
      }

      if (key === 'game.questionMap') {
        return `¿Dónde está ${vars?.capital ?? ''}?`;
      }

      if (key === 'game.questionFlag') {
        return '¿A qué país pertenece esta bandera?';
      }

      if (key === 'game.questionSilhouette') {
        return '¿Qué país representa esta silueta?';
      }

      if (key === 'game.questionOf') {
        return `Pregunta ${vars?.current} de ${vars?.total}`;
      }

      if (key.startsWith('game.difficulty.')) {
        return key;
      }

      return key;
    },
  }),
}));

describe('QuestionCard', () => {
  it('usa questionData serializado en JSON para renderizar el enunciado de capital', () => {
    const question = {
      id: 'q1',
      category: 'CAPITAL',
      questionText: '',
      questionData: '{"country":"Chile"}',
      options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
      correctAnswer: 'Santiago',
      difficulty: 'MEDIUM',
    } as Question;

    render(<QuestionCard question={question} questionNumber={1} totalQuestions={10} compact />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('¿Cuál es la capital de Chile?');
  });
});
