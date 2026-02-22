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

  it('aumenta el espacio visual de la silueta en modo compacto', () => {
    const question = {
      id: 'q2',
      category: 'SILHOUETTE',
      questionText: '',
      questionData: '',
      imageUrl: 'https://example.com/silhouette.png',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      difficulty: 'MEDIUM',
    } as Question;

    const { container } = render(
      <QuestionCard question={question} questionNumber={2} totalQuestions={10} compact />
    );

    const silhouetteImage = container.querySelector('img');
    expect(silhouetteImage).toHaveClass('h-full');
  });


  it('mantiene ratio fijo y object-contain en banderas para evitar recortes', () => {
    const question = {
      id: 'q4',
      category: 'FLAG',
      questionText: '',
      questionData: '',
      imageUrl: 'https://flagcdn.com/w320/lr.png',
      options: ['Liberia', 'Tanzania', 'Gabon', 'Zimbabwe'],
      correctAnswer: 'Liberia',
      difficulty: 'HARD',
    } as Question;

    const { container } = render(
      <QuestionCard question={question} questionNumber={4} totalQuestions={10} compact />
    );

    const flagImage = container.querySelector('img');
    const flagContainer = flagImage?.parentElement;

    expect(flagContainer?.className).toContain('media-box');
    expect(flagImage).toHaveClass('object-contain');
    expect(flagImage).toHaveClass('h-full');
    expect(flagImage).toHaveClass('w-full');
  });


  it('compacta bandera y dificultad en una sola fila para ganar espacio vertical', () => {
    const question = {
      id: 'q5',
      category: 'FLAG',
      questionText: '',
      questionData: '',
      imageUrl: 'https://flagcdn.com/w320/pe.png',
      options: ['Perú', 'Bolivia', 'Ecuador', 'Paraguay'],
      correctAnswer: 'Perú',
      difficulty: 'MEDIUM',
    } as Question;

    const { container } = render(
      <QuestionCard question={question} questionNumber={5} totalQuestions={10} compact />
    );

    const flagImage = container.querySelector('img');
    const flagContainer = flagImage?.parentElement;
    const heading = screen.getByRole('heading', { level: 2 });
    const difficultyBadge = screen.getByText('game.difficulty.medium');

    expect(flagContainer?.className).toContain('media-box--compact');
    expect(heading.className).toContain('text-[clamp(1.05rem,4vw,1.28rem)]');
    expect(difficultyBadge.className).toContain('absolute');
    expect(difficultyBadge.className).toContain('top-2');
  });

  it('aplica tipografía más compacta al enunciado del mapa', () => {
    const question = {
      id: 'q3',
      category: 'MAP',
      questionText: '',
      questionData: 'Maseru',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      difficulty: 'MEDIUM',
    } as Question;

    render(<QuestionCard question={question} questionNumber={3} totalQuestions={10} compact />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('text-[clamp(1rem,3.8vw,1.22rem)]', 'leading-snug');
  });
});
